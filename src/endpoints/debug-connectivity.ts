/**
 * Debug Connectivity — GET /api/debug/connectivity
 *
 * Answers "which database / which node is this deployment actually running as?"
 * at runtime — invaluable when standing up federation peers (Node A vs Node B)
 * and you can't tell from the outside which DB the env points at.
 *
 * Safe by default: the public response shows only the database NAME (e.g. `kendev`
 * vs `angels`), whether the DB is reachable, whether it has data (empty/present),
 * the node's URL, and federation config — never credentials or API keys. The DB
 * host and exact row counts are revealed only to a super-admin or to a caller that
 * passes `?key=<CRON_SECRET>` (so you can probe even before login works).
 */
import type { PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export const debugConnectivityHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const key = url.searchParams.get('key')

  const isAdmin = Boolean(user && checkRole(ADMIN_ROLES, user))
  const keyOk = Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  const authorized = isAdmin || keyOk

  const uri = process.env.DATABASE_URI || ''
  const database = (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || 'unknown'
  const dbHost = (uri.match(/@([^/:]+)/) || [])[1] || 'unknown'

  // Connectivity probe — a count proves we can actually reach + read the DB, and
  // reveals which dataset this is (empty kendev vs populated angels).
  let connected = false
  let userTotal: number | null = null
  let tenantTotal: number | null = null
  try {
    const u = await payload.count({ collection: 'users', overrideAccess: true })
    userTotal = u.totalDocs
    connected = true
    if (authorized) {
      const t = await payload.count({ collection: 'tenants', overrideAccess: true })
      tenantTotal = t.totalDocs
    }
  } catch {
    connected = false
  }

  return Response.json(
    {
      ok: connected,
      node: {
        serverUrl: process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || null,
        nodeEnv: process.env.NODE_ENV || null,
        region: process.env.VERCEL_REGION || null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      },
      database,
      connected,
      // Always-safe signal: does this DB have data, without revealing counts.
      data: userTotal == null ? 'unknown' : userTotal > 0 ? 'present' : 'empty',
      federation: {
        registryUrl: process.env.FEDERATION_REGISTRY_URL || null,
        agentAutoRespond: process.env.FEDERATION_AGENT_AUTORESPOND !== 'false',
      },
      // Sensitive — only for super-admin or ?key=CRON_SECRET callers:
      ...(authorized
        ? { dbHost, users: userTotal, tenants: tenantTotal, authorizedVia: isAdmin ? 'super_admin' : 'cron_key' }
        : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
