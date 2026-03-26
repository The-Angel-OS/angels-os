/**
 * One-shot admin endpoint to update all tenant header/footer navigation.
 * POST /api/admin-ops/update-all-nav
 *
 * Applies the standard nav pattern to every tenant:
 *   Header: Home, Shop, Book (service-providers only), Posts, Events, Donate, Dashboard
 *   Footer: Home, Posts, Donate, Dashboard, Angel OS
 *
 * Requires super_admin role.
 */
import type { PayloadHandler } from 'payload'

const link = (label: string, url: string) => ({
  link: { type: 'custom' as const, label, url },
})

export const updateAllNavHandler: PayloadHandler = async (req) => {
  const user = req.user
  if (!user || !(user as any).roles?.includes('super_admin')) {
    return Response.json({ error: 'Unauthorized — super_admin required' }, { status: 403 })
  }

  const payload = req.payload
  const results: Array<{ tenant: string; headerId: number; status: string }> = []

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

    // Find existing header for this tenant
    const headers = await payload.find({
      collection: 'header',
      where: { tenant: { equals: tenantId } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    // Standard nav items for all tenants
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

    if (headers.docs.length > 0) {
      // Update first header, delete duplicates
      const primaryHeader = headers.docs[0]
      await payload.update({
        collection: 'header',
        id: primaryHeader.id,
        data: { navItems: headerNav } as any,
        overrideAccess: true,
      })

      // Clean up duplicate headers
      for (let i = 1; i < headers.docs.length; i++) {
        await payload.delete({
          collection: 'header',
          id: headers.docs[i].id,
          overrideAccess: true,
        })
      }

      results.push({ tenant: slug, headerId: primaryHeader.id as number, status: `updated (${headers.docs.length - 1} duplicates removed)` })
    } else {
      // Create header
      const newHeader = await payload.create({
        collection: 'header',
        data: { tenant: tenantId, label: 'Main Header', navItems: headerNav } as any,
        overrideAccess: true,
      })
      results.push({ tenant: slug, headerId: newHeader.id as number, status: 'created' })
    }

    // Update or create footer
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
      // Clean up duplicate footers
      for (let i = 1; i < footers.docs.length; i++) {
        await payload.delete({
          collection: 'footer',
          id: footers.docs[i].id,
          overrideAccess: true,
        })
      }
    } else {
      await payload.create({
        collection: 'footer',
        data: { tenant: tenantId, label: 'Main Footer', navItems: footerNav } as any,
        overrideAccess: true,
      })
    }
  }

  return Response.json({
    success: true,
    message: `Updated navigation for ${results.length} tenants`,
    results,
  })
}
