import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { buildTenantFilter } from '@/utilities/buildTenantFilter'
import { ProducerPanel } from './ProducerPanel'

/**
 * Producer Dashboard — /dashboard/producer
 *
 * Central hub for producers/vendors: incoming orders, production queue,
 * fulfillment status, and earnings summary. Mobile-first, LEO-augmented.
 */
export default async function DashboardProducerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })
  const { tenantId } = await resolveTenantFromHeaders()

  // Load products + orders in parallel (independent queries)
  const [productsResult, ordersResult] = await Promise.all([
    payload.find({
      collection: 'products',
      where: tenantId != null
        ? { or: [{ vendor: { equals: tenantId } }, { tenant: { equals: tenantId } }] }
        : buildTenantFilter(undefined),
      limit: 50,
      depth: 1,
      sort: '-createdAt',
      overrideAccess: true,
    }).catch(() => ({ docs: [] as any[] })),
    payload.find({
      collection: 'orders' as any,
      where: buildTenantFilter(tenantId),
      limit: 100,
      depth: 2,
      sort: '-createdAt',
      overrideAccess: true,
    }).catch(() => ({ docs: [] as any[] })),
  ])

  const products = productsResult.docs as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = ordersResult.docs as any[]

  // Categorize orders by status
  const pendingOrders = orders.filter((o) => ['pending', 'pending_match', 'matched'].includes(o.status))
  const activeOrders = orders.filter((o) => ['accepted', 'in_production', 'processing'].includes(o.status))
  const shippedOrders = orders.filter((o) => ['shipped', 'delivered', 'completed'].includes(o.status))

  // Earnings
  const totalEarnings = shippedOrders.reduce((sum, o) => {
    const amount = o.amount || 0
    return sum + Math.round(amount * 0.6) // 60% producer share
  }, 0)

  return (
    <ProducerPanel
      products={products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p._status || 'draft',
        priceInUSD: p.priceInUSD,
        productionType: p.productionType,
        isLimitedEdition: p.isLimitedEdition,
      }))}
      pendingOrders={pendingOrders.length}
      activeOrders={activeOrders.length}
      shippedOrders={shippedOrders.length}
      totalEarnings={totalEarnings}
      locale={locale}
    />
  )
}
