import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { ProductManager } from './ProductManager'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  // Fetch products for this tenant
  const products = await payload.find({
    collection: 'products',
    where: tenantFilter,
    limit: 100,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // Serialize for client component
  const serializedProducts = products.docs.map((p: any) => ({
    id: p.id,
    title: p.title || 'Untitled',
    slug: p.slug || '',
    priceInUSD: p.priceInUSD ?? null,
    inventory: p.inventory ?? null,
    status: p._status || 'draft',
    categories: Array.isArray(p.categories)
      ? p.categories.map((c: any) =>
          typeof c === 'object' ? c.title || 'Unknown' : 'Unknown',
        )
      : [],
    galleryCount: Array.isArray(p.gallery) ? p.gallery.length : 0,
    firstImageUrl:
      Array.isArray(p.gallery) && p.gallery.length > 0
        ? typeof p.gallery[0]?.image === 'object'
          ? p.gallery[0].image?.url || null
          : null
        : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))

  return (
    <ProductManager
      products={serializedProducts}
      totalProducts={products.totalDocs}
    />
  )
}
