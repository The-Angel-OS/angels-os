/**
 * Pages From Spec — POST /api/provision-ops/pages-from-spec
 *
 * Generic site provisioner: create a set of pages on a tenant from a JSON spec
 * (content/cta/donation blocks). The reusable building block for site migrations
 * (replicate_site). Idempotent — existing slugs skipped unless overwrite=true.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 * Body: { tenantSlug, pages: PageFromSpec[], overwrite?: boolean }
 *
 * @see src/utilities/provisionPagesFromSpec.ts
 */
import type { PayloadHandler } from 'payload'
import { provisionPagesFromSpec, type PageFromSpec } from '@/utilities/provisionPagesFromSpec'

export const pagesFromSpecHandler: PayloadHandler = async (req) => {
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
    /* validated below */
  }

  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug.trim() : ''
  if (!tenantSlug) return Response.json({ error: 'tenantSlug is required' }, { status: 400 })
  const pages = body.pages as PageFromSpec[] | undefined
  if (!Array.isArray(pages) || pages.length === 0) {
    return Response.json({ error: 'pages[] is required' }, { status: 400 })
  }

  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs?.[0] as { id: number | string } | undefined
    if (!tenant) return Response.json({ error: `No tenant "${tenantSlug}"` }, { status: 404 })

    const overwrite = body.overwrite === true || url.searchParams.get('overwrite') === 'true'
    const result = await provisionPagesFromSpec(payload, tenant.id, pages, { overwrite })
    return Response.json({ ok: true, tenant: tenantSlug, overwrite, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[pages-from-spec] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
