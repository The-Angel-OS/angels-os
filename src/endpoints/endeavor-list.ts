/**
 * Endeavor List — GET /api/provision-ops/endeavor-list
 *
 * READ-ONLY diagnostic. Lists every endeavor with the fields that decide whether
 * it shows in federation Discovery: name, tenant slug, networkVisible, ministry
 * status, federationId, domain. Surfaces the "real portal missing from Discovery"
 * cases — networkVisible:false, no tenant, or a name collision across tenants.
 *
 * Auth: super_admin OR ?key=CRON_SECRET. Nothing mutated.
 */
import type { PayloadHandler } from 'payload'

export const endeavorListHandler: PayloadHandler = async (req) => {
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
    const res = await payload.find({
      collection: 'endeavors',
      limit: 1000,
      depth: 1, // resolve tenant for slug
      overrideAccess: true,
      sort: 'name',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (res.docs as any[]).map((e) => {
      const tenant = e.tenant && typeof e.tenant === 'object' ? e.tenant : null
      const fed = e.federation || {}
      return {
        id: e.id,
        name: e.name,
        tenantSlug: tenant?.slug ?? (e.tenant != null ? `#${e.tenant}` : null),
        tenantDomain: tenant?.domain ?? null,
        networkVisible: fed.networkVisible === true,
        ministryStatus: fed.ministryStatus ?? null,
        federationId: fed.federationId ?? null,
        fedDomain: fed.domain ?? null,
        status: e.status ?? null,
      }
    })

    // Highlight the likely culprits: visible vs hidden, and duplicate names.
    const byName = new Map<string, number>()
    for (const r of rows) byName.set(r.name, (byName.get(r.name) || 0) + 1)
    const duplicateNames = [...byName.entries()].filter(([, n]) => n > 1).map(([name]) => name)

    return Response.json({
      ok: true,
      total: rows.length,
      visibleInDiscovery: rows.filter((r) => r.networkVisible).length,
      hiddenFromDiscovery: rows.filter((r) => !r.networkVisible).map((r) => ({ name: r.name, tenantSlug: r.tenantSlug })),
      duplicateNames,
      endeavors: rows,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[endeavor-list] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
