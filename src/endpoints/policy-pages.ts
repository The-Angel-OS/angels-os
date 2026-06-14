/**
 * Policy Pages — POST /api/provision-ops/policy-pages
 *
 * Stamps the standard legal pages (Privacy, Terms, Cookie, and — when the endeavor
 * takes payments — Refund) onto a tenant and links them in the footer. Idempotent.
 * Every endeavor taking money or collecting consent needs these.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 * Body: { tenantSlug, profile?: PolicyProfile, overwrite?: boolean }
 *
 * @see src/utilities/ensurePolicyPages.ts
 */
import type { PayloadHandler } from 'payload'
import { ensurePolicyPages, type PolicyProfile } from '@/utilities/ensurePolicyPages'

export const policyPagesHandler: PayloadHandler = async (req) => {
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

    const incoming = (body.profile as Partial<PolicyProfile>) || {}
    const profile: PolicyProfile = {
      orgName: incoming.orgName || tenant.name || tenantSlug,
      ...incoming,
    }

    const overwrite = body.overwrite === true || url.searchParams.get('overwrite') === 'true'
    const result = await ensurePolicyPages(payload, tenant.id, profile, { overwrite })
    return Response.json({ ok: true, tenant: tenantSlug, overwrite, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[policy-pages] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
