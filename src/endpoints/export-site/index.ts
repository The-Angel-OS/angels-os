/**
 * Site Export Endpoint
 *
 * Exports the entire tenant's site data (pages, posts, products, media, comments, etc.)
 * into a ZIP or JSON archive for portability to another Angel OS instance.
 *
 * TODO: Implement full export:
 * - Accept tenantId or tenantSlug
 * - Fetch all tenant-scoped collections (pages, posts, products, categories, media, comments, header, footer)
 * - Resolve media URLs and optionally inline or bundle assets
 * - Output as ZIP (with JSON manifests + media files) or JSON (references only)
 * - Require super_admin or tenant_admin access
 *
 * Usage (future): POST /api/export-site or GET /next/export-site?tenant=default
 */

import type { PayloadHandler } from 'payload'

export const exportSite: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || !('roles' in user) || !Array.isArray(user.roles)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const roles = (user.roles ?? []) as string[]
  const isSuperAdmin = roles.includes('super_admin')
  const isTenantAdmin = roles.includes('tenant_admin') || roles.includes('admin')
  if (!isSuperAdmin && !isTenantAdmin) {
    return Response.json({ message: 'Forbidden: requires admin role' }, { status: 403 })
  }

  const tenantSlug = req.headers.get('x-tenant-id') || 'default'

  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
  })

  const tenant = tenants.docs?.[0]
  if (!tenant) {
    return Response.json({ message: 'Tenant not found' }, { status: 404 })
  }

  const tenantId = tenant.id

  const [pages, posts, products, categories, comments, header, footer] = await Promise.all([
    payload.find({
      collection: 'pages',
      where: { tenant: { equals: tenantId } },
      limit: 1000,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'posts',
      where: { tenant: { equals: tenantId } },
      limit: 1000,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      limit: 1000,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'categories',
      where: { tenant: { equals: tenantId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'comments',
      where: { tenant: { equals: tenantId } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'header',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'footer',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const manifest = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    counts: {
      pages: pages.totalDocs,
      posts: posts.totalDocs,
      products: products.totalDocs,
      categories: categories.totalDocs,
      comments: comments.totalDocs,
    },
  }

  return Response.json({
    message: 'Site export scaffold. Full ZIP/archive implementation pending.',
    manifest,
    data: {
      tenant,
      pages: pages.docs,
      posts: posts.docs,
      products: products.docs,
      categories: categories.docs,
      comments: comments.docs,
      header: header.docs?.[0],
      footer: footer.docs?.[0],
    },
  })
}
