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

const link = (label: string, url: string) => ({
  link: { type: 'custom' as const, label, url },
})

function buildRichText(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [
          { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

export const updateAllNavHandler: PayloadHandler = async (req) => {
  const user = req.user
  if (!user || !(user as any).roles?.includes('super_admin')) {
    return Response.json({ error: 'Unauthorized — super_admin required' }, { status: 403 })
  }

  const payload = req.payload
  const results: Array<{ tenant: string; headerId: number; status: string; donatePage?: string }> = []

  // Fetch all tenants
  const tenants = await payload.find({
    collection: 'tenants',
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true, name: true },
  })

  for (const tenant of tenants.docs) {
    const tenantId = tenant.id as number
    const slug = (tenant as any).slug || 'unknown'
    const tenantName = tenant.name || slug

    // ── Header nav ─────────────────────────────────────────
    const headers = await payload.find({
      collection: 'header',
      where: { tenant: { equals: tenantId } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    const headerNav = [
      link('Home', '/'),
      link('Shop', '/shop'),
      link('Posts', '/posts'),
      link('Events', '/events'),
      link('Donate', '/donate'),
      link('Dashboard', '/dashboard'),
    ]

    const footerNav = [
      link('Home', '/'),
      link('Posts', '/posts'),
      link('Donate', '/donate'),
      link('Dashboard', '/dashboard'),
      { link: { type: 'custom' as const, label: 'Angel OS', newTab: true, url: 'https://github.com/The-Angel-OS/angels-os' } },
    ]

    let headerStatus = ''

    if (headers.docs.length > 0) {
      const primaryHeader = headers.docs[0]
      await payload.update({
        collection: 'header',
        id: primaryHeader.id,
        data: { navItems: headerNav } as any,
        overrideAccess: true,
      })
      for (let i = 1; i < headers.docs.length; i++) {
        await payload.delete({ collection: 'header', id: headers.docs[i].id, overrideAccess: true })
      }
      headerStatus = `nav updated (${headers.docs.length - 1} dupes removed)`

      results.push({ tenant: slug, headerId: primaryHeader.id as number, status: headerStatus })
    } else {
      const newHeader = await payload.create({
        collection: 'header',
        data: { tenant: tenantId, label: 'Main Header', navItems: headerNav } as any,
        overrideAccess: true,
      })
      results.push({ tenant: slug, headerId: newHeader.id as number, status: 'header created' })
    }

    // ── Footer nav ─────────────────────────────────────────
    const footers = await payload.find({
      collection: 'footer',
      where: { tenant: { equals: tenantId } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    if (footers.docs.length > 0) {
      await payload.update({
        collection: 'footer',
        id: footers.docs[0].id,
        data: { navItems: footerNav } as any,
        overrideAccess: true,
      })
      for (let i = 1; i < footers.docs.length; i++) {
        await payload.delete({ collection: 'footer', id: footers.docs[i].id, overrideAccess: true })
      }
    } else {
      await payload.create({
        collection: 'footer',
        data: { tenant: tenantId, label: 'Main Footer', navItems: footerNav } as any,
        overrideAccess: true,
      })
    }

    // ── Donate page ────────────────────────────────────────
    const existingDonate = await payload.find({
      collection: 'pages',
      where: {
        slug: { equals: 'donate' },
        tenant: { equals: tenantId },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingDonate.docs.length === 0) {
      await payload.create({
        collection: 'pages',
        depth: 0,
        overrideAccess: true,
        data: {
          tenant: tenantId,
          slug: 'donate',
          title: 'Donate',
          _status: 'published',
          hero: {
            type: 'lowImpact',
            richText: buildRichText([
              `Support ${tenantName}`,
            ]),
          },
          layout: [
            {
              blockType: 'content',
              columns: [{
                size: 'full' as const,
                richText: buildRichText([
                  '100% of every donation goes to the Justice Fund — community support, wrongful conviction advocacy, and guild infrastructure. No platform fees on donations. This is constitutional.',
                ]),
              }],
            },
            {
              blockType: 'donation',
              presetAmounts: '5,10,25,50,100',
              showDonorFields: true,
            },
          ],
          meta: {
            title: `Donate — ${tenantName}`,
            description: `Support ${tenantName}. 100% of donations go to the Justice Fund.`,
          },
        } as any,
      })
      // Update the result for this tenant
      const lastResult = results[results.length - 1]
      if (lastResult) lastResult.donatePage = 'created'
    } else {
      const lastResult = results[results.length - 1]
      if (lastResult) lastResult.donatePage = 'already exists'
    }
  }

  return Response.json({
    success: true,
    message: `Updated ${results.length} tenants: nav + donate pages`,
    results,
  })
}
