import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import configPromise from '@payload-config'
import { OrderDetail, type OrderDetailView } from './OrderDetail'

export const dynamic = 'force-dynamic'

/**
 * Order Detail Page — /dashboard/my-orders/[id]
 *
 * Full drill-down view for a single customer order.
 * Shows: Angel Token badge, fulfillment timeline, maker assignment,
 * configuration summary, tracking, and cancel confirmation dialog.
 *
 * Sprint 39 — Customer Angel Token UI
 */
export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect(`/${locale}/login`)
  }

  // Fetch order — must belong to this user
  let order: any = null
  try {
    const result = await payload.find({
      collection: 'orders' as any,
      where: {
        and: [
          { id: { equals: Number(id) } },
          { orderedBy: { equals: user.id } },
        ],
      },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })
    order = result.docs[0] ?? null
  } catch {
    order = null
  }

  if (!order) {
    redirect(`/${locale}/dashboard/my-orders`)
  }

  // ── Transform raw order into typed OrderDetailView ──────────────

  const items: OrderDetailView['items'] = []
  const rawItems = order.items || []
  const fulfillment = order.fulfillment || []

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i]
    const product = typeof item?.product === 'object' ? item.product : null
    const entry = (fulfillment as any[]).find((f: any) => f.orderItemIndex === i) ?? null

    // Configuration summary
    let configurationSummary: string | null = null
    let configurationFields: { label: string; value: string }[] = []
    if (entry?.selectedConfiguration && typeof entry.selectedConfiguration === 'object') {
      const config = entry.selectedConfiguration as Record<string, unknown>
      const fieldMap: Record<string, string> = {
        color: 'Color',
        size: 'Size',
        material: 'Material',
        finish: 'Finish',
        customText: 'Custom Text',
      }
      for (const [key, label] of Object.entries(fieldMap)) {
        if (config[key]) {
          configurationFields.push({ label, value: String(config[key]) })
        }
      }
      configurationSummary = configurationFields.map((f) => `${f.label}: ${f.value}`).join(', ') || null
    }

    // Product image
    let productImageUrl: string | null = null
    if (product?.gallery?.[0]?.image) {
      const img = product.gallery[0].image
      productImageUrl = typeof img === 'object' ? img.url || null : null
    } else if (product?.meta?.image) {
      const img = product.meta.image
      productImageUrl = typeof img === 'object' ? img.url || null : null
    }

    // Timeline: compute which steps have occurred
    const statusOrder = [
      'pending_match',
      'matched',
      'accepted',
      'in_production',
      'shipped',
      'delivered',
    ]
    const currentStatus: string = entry?.fulfillmentStatus || 'pending_match'
    const currentIdx = statusOrder.indexOf(currentStatus)
    const isCancelled = currentStatus === 'cancelled'

    items.push({
      orderItemIndex: i,
      productTitle: product?.title || item?.title || 'Product',
      productImageUrl,
      quantity: item.quantity || 1,
      price: item.price || product?.priceInUSD || 0,
      fulfillmentStatus: currentStatus,
      isCancelled,
      tokenStatus: entry?.tokenStatus || null,
      angelTokenId: entry?.angelTokenId || null,
      queueReason: entry?.queueReason || null,
      trackingNumber: entry?.trackingNumber || null,
      trackingUrl: entry?.trackingUrl || null,
      shippedAt: entry?.shippedAt || null,
      matchedAt: entry?.matchedAt || null,
      acceptedAt: entry?.acceptedAt || null,
      productionStartedAt: entry?.productionStartedAt || null,
      makerName: entry?.makerName || null,
      makerTenant: entry?.makerTenant || null,
      configurationSummary,
      configurationFields,
      timelineCurrentIdx: isCancelled ? -1 : currentIdx,
    })
  }

  const view: OrderDetailView = {
    orderId: order.id,
    createdAt: order.createdAt,
    totalAmount: order.totalPrice || order.total || order.amount || 0,
    currency: order.currency || 'USD',
    items,
  }

  return <OrderDetail order={view} locale={locale} />
}
