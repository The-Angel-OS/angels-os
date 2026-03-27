/**
 * One-shot admin endpoint to update all tenant navigation + create donate pages.
 * POST /api/admin-ops/update-all-nav
 *
 * For every tenant:
 *   1. Updates header nav: Home, Shop, Posts, Events, Donate, Dashboard
 *   2. Updates footer nav: Home, Posts, Donate, Dashboard, Angel OS
 *   3. Creates a "Donate" page (slug: donate) with a DonationBlock if none exists
 *   4. Cleans up duplicate header/footer docs
 *
 * Requires super_admin role.
 */
import type { PayloadHandler } from 'payload'
import { DEFAULT_HEADER_NAV, DEFAULT_FOOTER_NAV } from '@/utilities/defaultNavItems'
import { buildRichText } from '@/utilities/buildRichText'

export const updateAllNavHandler: PayloadHandler = async (req) => {
  const user = req.user
  if (!user || !(user as any).roles?.includes('super_admin')) {
    return Response.json({ error: 'Unauthorized — super_admin required' }, { status: 403 })
  }

  const payload = req.payload
  const results: Array<{ tenant: string; headerId: number; status: string; donatePage?: string }> = []

  const tenants = await payload.find({
    collection: 'tenants',
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true, name: true },
  })

  // Process tenants concurrently
  await Promise.allSettled(
    tenants.docs.map(async (tenant) => {
      const tenantId = tenant.id as number
      const slug = (tenant as any).slug || 'unknown'
      const tenantName = tenant.name || slug

      // Fetch header, footer, and donate page in parallel
      const [headers, footers, existingDonate] = await Promise.all([
        payload.find({ collection: 'header', where: { tenant: { equals: tenantId } }, limit: 10, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'footer', where: { tenant: { equals: tenantId } }, limit: 10, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'pages', where: { slug: { equals: 'donate' }, tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true }),
      ])

      // Update/create header + footer + donate page concurrently
      const ops: Promise<unknown>[] = []

      // ── Header ───────────────────────────────────────────
      let headerStatus: string
      let headerId: number

      if (headers.docs.length > 0) {
        const primary = headers.docs[0]
        headerId = primary.id as number
        ops.push(payload.update({ collection: 'header', id: primary.id, data: { navItems: DEFAULT_HEADER_NAV } as any, overrideAccess: true }))
        // Delete duplicates concurrently
        if (headers.docs.length > 1) {
          ops.push(...headers.docs.slice(1).map((d) => payload.delete({ collection: 'header', id: d.id, overrideAccess: true })))
        }
        headerStatus = `nav updated (${headers.docs.length - 1} dupes removed)`
      } else {
        const created = await payload.create({
          collection: 'header',
          data: { tenant: tenantId, label: 'Main Header', navItems: DEFAULT_HEADER_NAV } as any,
          overrideAccess: true,
        })
        headerId = created.id as number
        headerStatus = 'header created'
      }

      // ── Footer ───────────────────────────────────────────
      if (footers.docs.length > 0) {
        ops.push(payload.update({ collection: 'footer', id: footers.docs[0].id, data: { navItems: DEFAULT_FOOTER_NAV } as any, overrideAccess: true }))
        if (footers.docs.length > 1) {
          ops.push(...footers.docs.slice(1).map((d) => payload.delete({ collection: 'footer', id: d.id, overrideAccess: true })))
        }
      } else {
        ops.push(payload.create({ collection: 'footer', data: { tenant: tenantId, label: 'Main Footer', navItems: DEFAULT_FOOTER_NAV } as any, overrideAccess: true }))
      }

      // ── Donate page ──────────────────────────────────────
      let donatePageStatus = 'already exists'
      if (existingDonate.docs.length === 0) {
        ops.push(
          payload.create({
            collection: 'pages',
            depth: 0,
            overrideAccess: true,
            data: {
              tenant: tenantId,
              slug: 'donate',
              title: 'Donate',
              _status: 'published',
              hero: { type: 'lowImpact', richText: buildRichText([`Support ${tenantName}`]) },
              layout: [
                {
                  blockType: 'content',
                  columns: [{ size: 'full' as const, richText: buildRichText(['100% of every donation goes to the Justice Fund — community support, wrongful conviction advocacy, and guild infrastructure. No platform fees on donations. This is constitutional.']) }],
                },
                { blockType: 'donation', presetAmounts: '5,10,25,50,100', showDonorFields: true },
              ],
              meta: { title: `Donate — ${tenantName}`, description: `Support ${tenantName}. 100% of donations go to the Justice Fund.` },
            } as any,
          }),
        )
        donatePageStatus = 'created'
      }

      await Promise.all(ops)

      results.push({ tenant: slug, headerId, status: headerStatus, donatePage: donatePageStatus })
    }),
  )

  return Response.json({
    success: true,
    message: `Updated ${results.length} tenants: nav + donate pages`,
    results,
  })
}
