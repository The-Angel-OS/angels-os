/**
 * Market-Vendor Template — POST /api/provision-ops/market-vendor-template
 *
 * Applies the generic market-vendor / small-retail site (provisionMarketVendorSite) to
 * a tenant: stamps Home / Find Us (market calendar) / Guides / About / Contact, fleshes
 * out blog posts, and ensures a product catalog. The SEED that replicate_site clones out
 * to local market vendors. Defaults to HAYS_PROFILE for the hays-cactus tenant.
 *
 * ⚠️ Market vendors are COMMERCIAL — provision on the kendev.co node (commercial Diocese).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 * Body: { tenantSlug, profile?: MarketVendorProfile, overwrite?: boolean }
 *
 * @see src/utilities/provisionMarketVendorSite.ts
 */
import type { PayloadHandler } from 'payload'
import {
  provisionMarketVendorSite,
  HAYS_PROFILE,
  type MarketVendorProfile,
} from '@/utilities/provisionMarketVendorSite'

export const marketVendorTemplateHandler: PayloadHandler = async (req) => {
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

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* empty body → validation below */
  }

  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug.trim() : ''
  if (!tenantSlug) return Response.json({ error: 'tenantSlug is required' }, { status: 400 })

  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const tenant = tenants.docs?.[0] as { id: number | string; name?: string } | undefined
    if (!tenant) return Response.json({ error: `No tenant "${tenantSlug}"` }, { status: 404 })

    // Default to the Hays reference profile for hays-cactus; otherwise require one.
    const incoming = body.profile as Partial<MarketVendorProfile> | undefined
    const base = tenantSlug === 'hays-cactus' ? HAYS_PROFILE : { vendorName: tenant.name || tenantSlug }
    const profile: MarketVendorProfile = { ...base, ...(incoming || {}) }

    const overwrite = body.overwrite === true || url.searchParams.get('overwrite') === 'true'
    const result = await provisionMarketVendorSite(payload, tenant.id, profile, { overwrite })
    return Response.json({ ok: true, tenant: tenantSlug, overwrite, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[market-vendor-template] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
