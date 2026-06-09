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
import { createLocalReq } from 'payload'
import { FOUNDER_ACCOUNTS, findOrCreateUser } from '@/endpoints/seed/seed-helpers'

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

  // System-level req so the role update isn't constrained by the caller's tenant.
  const localReq = await createLocalReq({}, payload)

  const synced: Array<{ email: string; id: string | number }> = []
  const failed: Array<{ email: string; error: string }> = []
  for (const founder of FOUNDER_ACCOUNTS) {
    try {
      // No tenantId → preserves each founder's existing tenants array; only
      // roles/name are reconciled. Password is set on first-create only.
      const u = await findOrCreateUser(payload, localReq, {
        email: founder.email,
        name: founder.name,
        password: process.env.FOUNDER_PASSWORD || 'angelos',
        roles: ['super_admin', 'customer'],
      })
      synced.push({ email: u.email, id: u.id })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      payload.logger?.warn?.(`[ensure-founders] ${founder.email}: ${msg}`)
      failed.push({ email: founder.email, error: msg })
    }
  }

  return Response.json({ ok: failed.length === 0, synced, failed })
}
