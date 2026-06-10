/**
 * Contact Form Repair — GET /api/provision-ops/contact-form-repair
 *
 * Backfills the real Payload Form Builder contact form (with the LEO/AI-Bus
 * submission hook) onto existing tenants whose /contact page is still a plain
 * text page. Idempotent. Auth: super_admin OR ?key=CRON_SECRET. Optional
 * ?tenant=<slug> to scope to one.
 */
import type { PayloadHandler } from 'payload'
import { ensureTenantContactForm } from '@/utilities/ensureTenantContactForm'

export const contactFormRepairHandler: PayloadHandler = async (req) => {
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

  const tenantSlug = url.searchParams.get('tenant')

  try {
    const tenantsRes = await payload.find({
      collection: 'tenants',
      where: tenantSlug ? { slug: { equals: tenantSlug } } : {},
      limit: tenantSlug ? 1 : 1000,
      depth: 0,
      overrideAccess: true,
    })
    const tenants = tenantsRes.docs as Array<{ id: number | string; slug?: string }>
    if (tenants.length === 0) {
      return Response.json({ error: tenantSlug ? `No tenant "${tenantSlug}"` : 'No tenants' }, { status: 404 })
    }

    const results: Array<{ tenant: string | number; formCreated: boolean; pageWired: boolean; note: string }> = []
    for (const t of tenants) {
      try {
        const r = await ensureTenantContactForm(payload, t.id, req)
        results.push({ tenant: t.slug || t.id, formCreated: r.formCreated, pageWired: r.pageWired, note: r.note })
      } catch (e) {
        results.push({ tenant: t.slug || t.id, formCreated: false, pageWired: false, note: `error: ${e instanceof Error ? e.message : e}` })
      }
    }

    const changed = results.filter((r) => r.formCreated || r.pageWired)
    return Response.json({ ok: true, tenantsScanned: results.length, tenantsChanged: changed.length, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[contact-form-repair] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
