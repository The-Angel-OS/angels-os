/**
 * Ensure Founders — GET /api/provision-ops/ensure-founders
 *
 * Idempotently syncs the FOUNDER_ACCOUNTS to super_admin. A lightweight slice of
 * the full seed (just the founder role-sync) so founder logins always have the
 * platform-wide chooser without re-running the heavy 9-phase seed.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> (so it can heal a founder who isn't
 * yet super_admin — the chicken-and-egg the full seed endpoint can't solve).
 */
import type { PayloadHandler } from 'payload'
import { FOUNDER_ACCOUNTS } from '@/endpoints/seed/seed-helpers'

export const ensureFoundersHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // Direct find+update (NOT findOrCreateUser): the shared helper passes a `req`,
  // which triggers Payload's document-locking check — and payload_locked_documents
  // currently fails on a newer collection's missing rel column (migration drift),
  // which is also why the full seed can't run. We update with overrideLock:true +
  // overrideAccess:true and no req to skip the broken lock query entirely.
  const synced: Array<{ email: string; id: string | number; alreadyAdmin: boolean }> = []
  const failed: Array<{ email: string; error: string }> = []
  for (const founder of FOUNDER_ACCOUNTS) {
    try {
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: founder.email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const u = existing.docs?.[0] as { id: string | number; roles?: string[] } | undefined
      if (!u) {
        failed.push({ email: founder.email, error: 'no such user (login once first)' })
        continue
      }
      const alreadyAdmin = Array.isArray(u.roles) && u.roles.includes('super_admin')
      if (!alreadyAdmin) {
        const roles = Array.from(new Set([...(u.roles || []), 'super_admin', 'customer']))
        await payload.update({
          collection: 'users',
          id: u.id,
          data: { roles } as never,
          overrideAccess: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overrideLock: true as any, // skip the broken payload_locked_documents query
        })
      }
      synced.push({ email: founder.email, id: u.id, alreadyAdmin })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      payload.logger?.warn?.(`[ensure-founders] ${founder.email}: ${msg}`)
      failed.push({ email: founder.email, error: msg })
    }
  }

  return Response.json({ ok: failed.length === 0, synced, failed })
}
