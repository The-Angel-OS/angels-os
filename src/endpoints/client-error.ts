/**
 * Client Error — POST /api/log-ops/client-error
 *
 * HTTP entry point so client components can route a *user-action* failure to the
 * same place as server errors: `logError` → application-logs + (when a tenant is
 * resolved) the AI Bus `errors` channel.
 *
 * Rule (see project_deep_link_navigation): user actions → logError; high-frequency
 * polls → console.error (don't spam the AI Bus). This endpoint is for the former.
 *
 * Auth: requires a logged-in user (errors are scoped to a person doing a thing).
 * Tenant is resolved server-side from the optional `spaceId` so the client never
 * has to know it.
 */
import type { PayloadHandler } from 'payload'
import { logError } from '@/utilities/logError'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

/** Is this user a member of (or super_admin over) the tenant? Gates AI-Bus routing. */
function userInTenant(user: unknown, tenantId: string | number): boolean {
  const u = user as { roles?: string[]; tenants?: Array<{ tenant?: unknown }>; servesTenant?: unknown } | null
  if (!u) return false
  if (Array.isArray(u.roles) && u.roles.includes('super_admin')) return true
  const serves = typeof u.servesTenant === 'object' && u.servesTenant ? (u.servesTenant as { id?: unknown }).id : u.servesTenant
  if (serves != null && String(serves) === String(tenantId)) return true
  return (u.tenants || []).some((t) => {
    const tid = typeof t?.tenant === 'object' && t?.tenant ? (t.tenant as { id?: unknown }).id : t?.tenant
    return tid != null && String(tid) === String(tenantId)
  })
}

const cap = (s: string | undefined, n: number) => (typeof s === 'string' ? s.slice(0, n) : undefined)

export const clientErrorHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  // Rate-limit per requester — a client can't flood the log / AI Bus / Gotify.
  const limited = applyRateLimit(req, 'client-error')
  if (limited) return limited

  let body: Record<string, unknown> = {}
  try {
    body = req.json ? await req.json() : {}
  } catch {
    body = {}
  }

  // Size caps — attacker-controlled text must not bloat the DB or a bus message.
  const source = cap(typeof body.source === 'string' && body.source ? body.source : 'client', 120)!
  const message = cap(
    typeof body.message === 'string' && body.message ? body.message : 'Unspecified client error',
    500,
  )!
  const details = cap(typeof body.details === 'string' ? body.details : undefined, 4000)
  const url = cap(typeof body.url === 'string' ? body.url : undefined, 500)
  const spaceId = body.spaceId != null ? String(body.spaceId) : undefined

  // Resolve tenant from the space (enables AI Bus routing) — fail-soft.
  let tenantId: string | number | undefined
  if (spaceId) {
    try {
      const space = await payload.findByID({
        collection: 'spaces',
        id: spaceId,
        depth: 0,
        overrideAccess: true,
      })
      const t = (space as { tenant?: unknown })?.tenant
      tenantId = typeof t === 'object' && t ? (t as { id: string | number }).id : (t as string | number | undefined)
    } catch {
      // No tenant context — logError still persists to application-logs.
    }
  }

  // Membership gate: only route to a tenant's AI Bus errors channel if this user
  // actually belongs to it. Otherwise a logged-in user could inject attacker-
  // controlled system messages into ANY tenant's bus by passing a foreign spaceId.
  // Non-members still get their error persisted to application-logs (no tenantId).
  if (tenantId != null && !userInTenant(user, tenantId)) tenantId = undefined

  await logError({
    source,
    message,
    details,
    url,
    userId: user.id,
    tenantId,
  }).catch(() => {
    // logError is itself fail-soft; never let logging fail the request.
  })

  return Response.json({ ok: true })
}
