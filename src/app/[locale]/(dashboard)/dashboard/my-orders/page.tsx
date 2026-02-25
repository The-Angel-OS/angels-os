import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { MyOrders, type CustomerOrderItem } from './MyOrders'

/**
 * Customer Order History — /dashboard/my-orders
 *
 * Shows all orders placed BY the current user (as buyer, not seller).
 * Displays Angel Token status, fulfillment progress, and cancel/refund controls.
 *
 * Visible to ALL authenticated users (not just business owners).
 *
 * Sprint 19 — Customer Angel Token UI
 */
export default async function MyOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Authenticate user
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h2 className="text-xl font-semibold mb-2">Sign in to view your orders</h2>
        <p className="text-muted-foreground mb-6">You need to be logged in to see your order history.</p>
        <a
          href={`/${locale}/login`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign In
        </a>
      </div>
    )
  }

  // Fetch all orders placed by this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawOrders: any[] = []
  try {
    const result = await payload.find({
      collection: 'orders' as any,
      where: {
        orderedBy: { equals: user.id },
      },
      limit: 200,
      depth: 2,
      sort: '-createdAt',
      overrideAccess: true,
    })
    rawOrders = result.docs as any[]
  } catch {
    rawOrders = []
  }

  // Transform orders into customer-friendly format
  const customerOrders: CustomerOrderItem[] = []

  for (const order of rawOrders) {
    const items = order.items || []
    const fulfillment = order.fulfillment || []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const product = typeof item?.product === 'object' ? item.product : null
      const entry = fulfillment.find((f: any) => f.orderItemIndex === i)

      // Build configuration summary
      let configurationSummary: string | null = null
      if (entry?.selectedConfiguration && typeof entry.selectedConfiguration === 'object') {
        const config = entry.selectedConfiguration as Record<string, unknown>
        const parts: string[] = []
        if (config.color) parts.push(`Color: ${config.color}`)
        if (config.size) parts.push(`Size: ${config.size}`)
        if (config.customText) parts.push(`Custom text: "${config.customText}"`)
        if (config.material) parts.push(`Material: ${config.material}`)
        if (config.finish) parts.push(`Finish: ${config.finish}`)
        configurationSummary = parts.length > 0 ? parts.join(', ') : null
      }

      // Extract product image
      let productImageUrl: string | null = null
      if (product?.gallery?.[0]?.image) {
        const img = product.gallery[0].image
        productImageUrl = typeof img === 'object' ? img.url || null : null
      } else if (product?.meta?.image) {
        const img = product.meta.image
        productImageUrl = typeof img === 'object' ? img.url || null : null
      }

      customerOrders.push({
        orderId: order.id,
        orderItemIndex: i,
        productTitle: product?.title || item?.title || 'Product',
        productImageUrl,
        quantity: item.quantity || 1,
        price: item.price || product?.priceInUSD || 0,
        fulfillmentStatus: entry?.fulfillmentStatus || 'pending_match',
        tokenStatus: entry?.tokenStatus || null,
        angelTokenId: entry?.angelTokenId || null,
        queueReason: entry?.queueReason || null,
        trackingNumber: entry?.trackingNumber || null,
        trackingUrl: entry?.trackingUrl || null,
        shippedAt: entry?.shippedAt || null,
        configurationSummary,
        createdAt: order.createdAt,
      })
    }
  }

  return <MyOrders orders={customerOrders} locale={locale} />
}
