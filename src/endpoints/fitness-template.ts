/**
 * Fitness Template — POST /api/provision-ops/fitness-template
 *
 * Applies the generic gym/studio site (provisionFitnessSite) to a tenant: stamps the
 * standard pages (Home, Classes, Pricing, Coaches, Get Started, Contact) from existing
 * blocks and seeds recurring membership plans. One template for CrossFit, yoga,
 * Pilates, martial arts — any membership-based fitness endeavor. Idempotent.
 *
 * ⚠️ Gyms/studios are COMMERCIAL endeavors (paying customers) — provision on the
 * kendev.co node (commercial Diocese), the mirror of churches on spacesangels.com.
 * Run this against https://kendev.co (or the gym's own kendev subdomain) so it lands
 * on the kendev DB and dues route through that node's commercial arm.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 * Body: { tenantSlug, profile?: FitnessProfile, overwrite?: boolean }
 *
 * @see src/utilities/provisionFitnessSite.ts
 */
import type { PayloadHandler } from 'payload'
import { provisionFitnessSite, type FitnessProfile } from '@/utilities/provisionFitnessSite'

export const fitnessTemplateHandler: PayloadHandler = async (req) => {
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

    const incoming = (body.profile as Partial<FitnessProfile>) || {}
    const profile: FitnessProfile = {
      gymName: incoming.gymName || tenant.name || tenantSlug,
      ...incoming,
    }

    const overwrite = body.overwrite === true || url.searchParams.get('overwrite') === 'true'
    const result = await provisionFitnessSite(payload, tenant.id, profile, { overwrite })
    return Response.json({ ok: true, tenant: tenantSlug, overwrite, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[fitness-template] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
