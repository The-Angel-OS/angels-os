/**
 * Church Template — POST /api/provision-ops/church-template
 *
 * Applies the prototype church site (provisionChurchSite) to a tenant: stamps the
 * standard parish pages (Home, Worship, Sermons, Events, Giving, About, Ministries,
 * Prayer Requests, Contact) from existing blocks. Idempotent — existing pages by
 * slug are skipped.
 *
 * ⚠️ Real/public church sites belong on the spacesangels.com (angels) node, NOT
 * kendev.co (commercial). Run this against https://www.spacesangels.com so it lands
 * on the angels DB.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 * Body: { tenantSlug, profile?: ChurchProfile }  (profile optional — generic defaults)
 *
 * @see src/utilities/provisionChurchSite.ts
 */
import type { PayloadHandler } from 'payload'
import { provisionChurchSite, type ChurchProfile } from '@/utilities/provisionChurchSite'

export const churchTemplateHandler: PayloadHandler = async (req) => {
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
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs?.[0] as { id: number | string; name?: string } | undefined
    if (!tenant) return Response.json({ error: `No tenant "${tenantSlug}"` }, { status: 404 })

    const incoming = (body.profile as Partial<ChurchProfile>) || {}
    const profile: ChurchProfile = {
      churchName: incoming.churchName || tenant.name || tenantSlug,
      ...incoming,
    }

    const overwrite = body.overwrite === true || url.searchParams.get('overwrite') === 'true'
    const result = await provisionChurchSite(payload, tenant.id, profile, { overwrite })
    return Response.json({ ok: true, tenant: tenantSlug, overwrite, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[church-template] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
