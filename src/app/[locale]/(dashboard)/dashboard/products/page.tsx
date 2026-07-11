import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { ProductManager } from './ProductManager'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolvePageSize } from '@/utilities/pageSize'

export const dynamic = 'force-dynamic'

export default async function DashboardProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string; limit?: string }>
}) {
  const { locale } = await params
  const { q = '', status = 'all', page: pageParam, limit: limitParam } = await searchParams
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()
  const pageSize = resolvePageSize(limitParam)
  const page = Math.max(1, Number(pageParam) || 1)

  // Server-side filter + pagination — spans the whole tenant catalog (was: load
  // 100 and filter in the browser, which silently capped past 100 products).
  const and: Where[] = [tenantFilter as Where]
  if (status === 'published' || status === 'draft') and.push({ _status: { equals: status } })
  if (q.trim()) and.push({ title: { like: q.trim() } })

  const products = await payload.find({
    collection: 'products',
    where: { and },
    limit: pageSize,
    page,
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
      page={products.page || 1}
      totalPages={products.totalPages}
      hasFilter={!!(q || status !== 'all')}
    />
  )
}
