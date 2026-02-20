import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { VendorOrders } from './VendorOrders'

/**
 * Vendor Orders Dashboard — /dashboard/orders
 *
 * Server component that loads the vendor's orders via the
 * fulfillment system and renders the client-side order management UI.
 *
 * Minimal, mobile-first. LEO is the real interface — this is scaffolding.
 */
export default async function DashboardOrdersPage({
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

  // Find holons for this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holonDocs = await payload.find({
    collection: 'holon-capabilities' as any,
    where: { tenant: { equals: tenantId } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const holonIds = holonDocs.docs.map((h: any) => h.id)
  const hasHolon = holonIds.length > 0

  // If no holons, show empty state
  if (!hasHolon) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Vendor Orders</h1>
        <p className="text-muted-foreground mb-6">
          Register your Holon node first to start receiving orders from the network.
        </p>
        <a
          href={`/${locale}/dashboard/holon`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Register Holon Node
        </a>
      </div>
    )
  }

  // Query orders with fulfillment assigned to our holons
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orders: any[] = []
  try {
    const result = await payload.find({
      collection: 'orders' as any,
      where: {
        'fulfillment.assignedHolon': { in: holonIds },
      },
      limit: 100,
      depth: 2,
      sort: '-createdAt',
      overrideAccess: true,
    })
    orders = result.docs as any[]
  } catch {
    // Orders collection may not have data yet
    orders = []
  }

  // Categorize fulfillment entries
  const incoming: any[] = []
  const active: any[] = []
  const completed: any[] = []
  let vendorShareTotal = 0

  for (const order of orders) {
    const fulfillment = order.fulfillment || []
    const items = order.items || []

    for (const entry of fulfillment) {
      const assignedId = typeof entry.assignedHolon === 'object'
        ? entry.assignedHolon?.id
        : entry.assignedHolon

      if (!holonIds.includes(assignedId)) continue

      const item = items[entry.orderItemIndex] || {}
      const itemPrice = item.price || item.priceInUSD || 0
      const share = Math.round(itemPrice * 0.6 * 100) / 100

      const summary = {
        orderId: order.id,
        orderItemIndex: entry.orderItemIndex,
        productTitle: typeof item.product === 'object' ? item.product?.title : 'Product',
        quantity: item.quantity || 1,
        price: itemPrice,
        fulfillmentStatus: entry.fulfillmentStatus,
        matchScore: entry.matchScore,
        trackingNumber: entry.trackingNumber,
        vendorShare: share,
      }

      switch (entry.fulfillmentStatus) {
        case 'matched':
          incoming.push(summary)
          break
        case 'accepted':
        case 'in_production':
          active.push(summary)
          break
        case 'shipped':
        case 'delivered':
          completed.push(summary)
          vendorShareTotal += share
          break
      }
    }
  }

  return (
    <VendorOrders
      incoming={incoming}
      active={active}
      completed={completed}
      vendorShareTotal={vendorShareTotal}
      locale={locale}
    />
  )
}
