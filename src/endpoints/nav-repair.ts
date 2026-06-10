/**
 * Nav Repair — GET /api/provision-ops/nav-repair
 *
 * Backfills missing DEFAULT_HEADER_NAV / DEFAULT_FOOTER_NAV links onto existing
 * tenants whose nav predates a newly-added default (e.g. Contact). Idempotent:
 * existing items (and their row ids) are preserved; only absent default links are
 * appended. Tenants with no header/footer doc get one created with the defaults.
 *
 * Auth: super_admin OR ?key=CRON_SECRET. Optional ?tenant=<slug> to scope to one;
 * otherwise repairs all tenants.
 */
import type { PayloadHandler } from 'payload'
import { DEFAULT_HEADER_NAV, DEFAULT_FOOTER_NAV } from '@/utilities/defaultNavItems'
import { backfillNavItems } from '@/utilities/navRepair'

export const navRepairHandler: PayloadHandler = async (req) => {
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
    // Resolve which tenants to repair.
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

    const results: Array<{ tenant: string | number; header: string[]; footer: string[]; created: string[] }> = []

    for (const t of tenants) {
      const summary = { tenant: t.slug || t.id, header: [] as string[], footer: [] as string[], created: [] as string[] }

      for (const which of [
        { collection: 'header' as const, defaults: DEFAULT_HEADER_NAV, label: 'Main Header', bucket: 'header' as const },
        { collection: 'footer' as const, defaults: DEFAULT_FOOTER_NAV, label: 'Main Footer', bucket: 'footer' as const },
      ]) {
        const existing = await payload.find({
          collection: which.collection,
          where: { tenant: { equals: t.id } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const doc = existing.docs?.[0] as { id: number | string; navItems?: unknown[] } | undefined

        if (!doc) {
          // No nav doc yet — create with the (now complete) defaults.
          await payload.create({
            collection: which.collection,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { tenant: t.id, label: which.label, navItems: which.defaults } as any,
            depth: 0,
            overrideAccess: true,
          })
          summary.created.push(which.collection)
          continue
        }

        const { items, added } = backfillNavItems(doc.navItems || [], which.defaults)
        if (added.length > 0) {
          await payload.update({
            collection: which.collection,
            id: doc.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { navItems: items } as any,
            depth: 0,
            overrideAccess: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrideLock: true as any,
          })
          summary[which.bucket] = added
        }
      }

      results.push(summary)
    }

    const changed = results.filter((r) => r.header.length || r.footer.length || r.created.length)
    return Response.json({ ok: true, tenantsScanned: results.length, tenantsChanged: changed.length, results: changed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[nav-repair] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
