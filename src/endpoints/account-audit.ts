/**
 * Account Audit — GET /api/provision-ops/account-audit
 *
 * READ-ONLY. Classifies every user into buckets (system / founder / test / member
 * / orphan) so we can SEE the account pool before any cleanup. Nothing is mutated
 * or deleted. Auth: super_admin OR ?key=CRON_SECRET.
 */
import type { PayloadHandler } from 'payload'
import { FOUNDER_ACCOUNTS } from '@/endpoints/seed/seed-helpers'
import { classifyAccount, type AccountBucket, type AuditUser } from '@/utilities/accountAudit'

export const accountAuditHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  try {
    // Users with at least one ACTIVE tenant-membership → "real members".
    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: { status: { equals: 'active' } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const withMembership = new Set<string>()
    for (const m of memberships.docs as unknown as Array<Record<string, unknown>>) {
      const u = m.user
      const id = u && typeof u === 'object' ? (u as { id: unknown }).id : u
      if (id != null) withMembership.add(String(id))
    }

    const founderEmails = new Set(FOUNDER_ACCOUNTS.map((f) => f.email.toLowerCase()))

    const users = await payload.find({
      collection: 'users',
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    const counts: Record<AccountBucket, number> = { system: 0, founder: 0, test: 0, member: 0, orphan: 0 }
    const samples: Record<AccountBucket, string[]> = { system: [], founder: [], test: [], member: [], orphan: [] }
    let orphanOldest: string | null = null
    let orphanNewest: string | null = null

    for (const u of users.docs as unknown as Array<Record<string, unknown>>) {
      const au: AuditUser = {
        id: u.id as number | string,
        email: (u.email as string) ?? null,
        isSystemUser: (u.isSystemUser as boolean) ?? false,
        roles: (u.roles as string[]) ?? null,
      }
      const bucket = classifyAccount(au, founderEmails, withMembership)
      counts[bucket]++
      if (samples[bucket].length < 10) samples[bucket].push(au.email || `#${au.id}`)
      if (bucket === 'orphan') {
        const created = (u.createdAt as string) || ''
        if (created) {
          if (!orphanOldest || created < orphanOldest) orphanOldest = created
          if (!orphanNewest || created > orphanNewest) orphanNewest = created
        }
      }
    }

    const total = users.totalDocs
    return Response.json({
      ok: true,
      total,
      counts,
      cleanupCandidates: counts.orphan + counts.test,
      protectedTotal: counts.system + counts.founder + counts.member,
      orphanCreatedRange: { oldest: orphanOldest, newest: orphanNewest },
      samples,
      note: 'READ-ONLY. orphan/test are cleanup-eligible; system/founder/member are protected.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[account-audit] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
