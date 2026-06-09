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

export const clientErrorHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = req.json ? await req.json() : {}
  } catch {
    body = {}
  }

  const source = typeof body.source === 'string' && body.source ? body.source : 'client'
  const message =
    typeof body.message === 'string' && body.message ? body.message : 'Unspecified client error'
  const details = typeof body.details === 'string' ? body.details : undefined
  const url = typeof body.url === 'string' ? body.url : undefined
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
