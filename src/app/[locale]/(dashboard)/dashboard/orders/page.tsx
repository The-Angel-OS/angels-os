import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
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
  const { tenantId, tenantFilter } = await resolveTenantFromHeaders()

  // Find holons for this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holonDocs = await payload.find({
    collection: 'holon-capabilities' as any,
    where: tenantFilter,
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const holonIds = holonDocs.docs.map((h: any) => h.id)
  const hasHolon = holonIds.length > 0

  // If no holons, show empty state
  if (!hasHolon) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Your order hub is ready!</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Register your Holon node to connect with the network and start receiving orders. Once connected, incoming orders will appear right here.
          </p>
          <div className="flex flex-col items-center gap-3">
            <a
              href={`/${locale}/dashboard/holon`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Register Holon Node
            </a>
            <a
              href={`/${locale}/dashboard/spaces`}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;How do I set up my Holon node to receive orders?&quot;
            </a>
          </div>
        </div>
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
