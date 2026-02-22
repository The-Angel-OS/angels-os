import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
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

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  // Load products for this tenant (vendor = tenantId)
  let products: any[] = []
  try {
    const result = await payload.find({
      collection: 'products',
      where: {
        or: [
          { vendor: { equals: tenantId } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 50,
      depth: 1,
      sort: '-createdAt',
      overrideAccess: true,
    })
    products = result.docs as any[]
  } catch {
    products = []
  }

  // Load orders where this tenant is the vendor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orders: any[] = []
  try {
    const result = await payload.find({
      collection: 'orders' as any,
      where: { tenant: { equals: tenantId } },
      limit: 100,
      depth: 2,
      sort: '-createdAt',
      overrideAccess: true,
    })
    orders = result.docs as any[]
  } catch {
    orders = []
  }

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
