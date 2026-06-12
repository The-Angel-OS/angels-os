/**
 * Tenant doctor — GET /api/provision-ops/tenant-doctor
 *
 * Read-only diagnosis for "the admin shows no Header/Footer/SiteSettings but the
 * site renders fine" and "collections don't filter by the selected tenant". Reports,
 * for THIS deployment's DB:
 *   - which tenant the request host resolves to (what the live site actually serves)
 *   - every tenant (id / slug / name / domain)
 *   - for header/footer/site-settings/settings: how many docs exist and which tenant
 *     OWNS each — so a doc parked under the wrong tenant (e.g. 'default' vs a named
 *     platform tenant) is obvious.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Mutates nothing.
 */
import type { PayloadHandler } from 'payload'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'

const tenantRef = (doc: Record<string, unknown>): string => {
  const t = doc.tenant
  if (t == null) return 'NONE'
  return String(typeof t === 'object' ? (t as { id?: unknown }).id : t)
}

export const tenantDoctorHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  const host = req.headers?.get('host') || req.headers?.get('x-forwarded-host') || ''
  const hostTenant = host ? await fetchTenantByDomain(host).catch(() => null) : null

  const tenants = await payload.find({ collection: 'tenants' as any, limit: 200, depth: 0, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
  const tenantList = (tenants.docs as any[]).map((t) => ({ id: t.id, slug: t.slug, name: t.name, domain: t.domain ?? null })) // eslint-disable-line @typescript-eslint/no-explicit-any
  const nameById = new Map(tenantList.map((t) => [String(t.id), `${t.name} (${t.slug})`]))

  const owners = async (collection: string) => {
    try {
      const res = await payload.find({ collection: collection as any, limit: 200, depth: 0, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
      const byTenant: Record<string, number> = {}
      for (const d of res.docs as Record<string, unknown>[]) {
        const ref = tenantRef(d)
        const label = nameById.get(ref) || ref
        byTenant[label] = (byTenant[label] || 0) + 1
      }
      return { total: res.totalDocs, byTenant }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  return Response.json({
    host,
    defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'default',
    hostResolvesTo: hostTenant ? { id: hostTenant.id, slug: hostTenant.slug, name: (hostTenant as any).name, domain: (hostTenant as any).domain ?? null } : null, // eslint-disable-line @typescript-eslint/no-explicit-any
    tenants: tenantList,
    docs: {
      header: await owners('header'),
      footer: await owners('footer'),
      'site-settings': await owners('site-settings'),
      settings: await owners('settings'),
    },
  })
}
