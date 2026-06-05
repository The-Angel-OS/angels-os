/**
 * Dashboard Prefs — POST /api/dashboard-ops/prefs
 *
 * Persists the authenticated user's dashboard widget preferences (collapsed /
 * dismissed / order) to `users.dashboardPrefs`, server-side, so they follow the
 * user across devices and the Nimue client. Merges with existing prefs.
 *
 *   Body: { collapsed?: string[], dismissed?: string[], order?: string[] }
 *   → { ok: true, dashboardPrefs }
 */
import type { PayloadHandler } from 'payload'

export interface DashboardPrefs {
  collapsed?: string[]
  dismissed?: string[]
  order?: string[]
}

const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string'))) : undefined

export const dashboardPrefsHandler: PayloadHandler = async (req) => {
  const { user, payload } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = ((user as { dashboardPrefs?: DashboardPrefs }).dashboardPrefs as DashboardPrefs) || {}
  const next: DashboardPrefs = {
    collapsed: strArr(body.collapsed) ?? existing.collapsed ?? [],
    dismissed: strArr(body.dismissed) ?? existing.dismissed ?? [],
    order: strArr(body.order) ?? existing.order ?? [],
  }

  try {
    await payload.update({
      collection: 'users',
      id: (user as { id: number | string }).id,
      data: { dashboardPrefs: next } as never,
      overrideAccess: true,
    })
  } catch (e) {
    payload.logger.error(`[dashboard-prefs] save failed: ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: 'Could not save preferences' }, { status: 500 })
  }

  return Response.json({ ok: true, dashboardPrefs: next })
}
