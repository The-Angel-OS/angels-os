/**
 * Vendor Orders Endpoint — GET /api/order-ops/vendor
 *
 * Returns the vendor's order inbox grouped by status + revenue summary.
 * Auth: user must have a registered holon.
 *
 * @see src/utilities/orderRoutingEngine.ts — vendor share calculation
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const ordersVendorHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'orders')
  if (rateLimited) return rateLimited

  // Find holons owned by user's tenants
  const userTenants = ((user as any).tenants || []).map((t: any) =>
    typeof t.tenant === 'object' ? t.tenant?.id : t.tenant,
  )

  if (userTenants.length === 0) {
    return Response.json({ error: 'No tenant found. Register a holon first.' }, { status: 400 })
  }

  // Find all holons for user's tenants
  const holonDocs = await payload.find({
    collection: 'holon-capabilities' as any,
    where: {
      tenant: { in: userTenants },
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const holonIds = holonDocs.docs.map((h: any) => h.id)

  if (holonIds.length === 0) {
    return Response.json({
      incoming: [],
      active: [],
      completed: [],
      revenue: { total: 0, vendorShare: 0, orderCount: 0 },
    })
  }

  // Query orders that have fulfillment entries assigned to our holons — scoped to user's tenants
  // We need to search orders with fulfillment.assignedHolon in our holon IDs
  const allOrders = await payload.find({
    collection: 'orders' as any,
    where: {
      'fulfillment.assignedHolon': { in: holonIds },
      tenant: { in: userTenants },
    },
    limit: 100,
    depth: 2,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // Categorize fulfillment entries
  const incoming: any[] = []
  const active: any[] = []
  const completed: any[] = []
  let totalRevenue = 0
  let vendorShareTotal = 0
  let completedCount = 0

  for (const order of allOrders.docs as any[]) {
    const fulfillment = order.fulfillment || []
    const items = order.items || []

    for (const entry of fulfillment) {
      const assignedId = typeof entry.assignedHolon === 'object'
        ? entry.assignedHolon?.id
        : entry.assignedHolon

      if (!holonIds.includes(assignedId)) continue

      const item = items[entry.orderItemIndex] || {}
      const itemPrice = item.price || item.priceInUSD || 0

      const summary = {
        orderId: order.id,
        orderItemIndex: entry.orderItemIndex,
        productTitle: typeof item.product === 'object' ? item.product?.title : 'Product',
        quantity: item.quantity || 1,
        price: itemPrice,
        fulfillmentStatus: entry.fulfillmentStatus,
        matchScore: entry.matchScore,
        matchedAt: entry.matchedAt,
        acceptedAt: entry.acceptedAt,
        shippedAt: entry.shippedAt,
        trackingNumber: entry.trackingNumber,
        estimatedCompletion: entry.estimatedCompletion,
        vendorShare: Math.round(itemPrice * 0.6 * 100) / 100,
        designAssets: entry.designAssets || [],
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
          totalRevenue += itemPrice
          vendorShareTotal += summary.vendorShare
          completedCount++
          break
        // rejected items are excluded from all views
      }
    }
  }

  return Response.json({
    incoming,
    active,
    completed,
    revenue: {
      total: Math.round(totalRevenue * 100) / 100,
      vendorShare: Math.round(vendorShareTotal * 100) / 100,
      orderCount: completedCount,
    },
  })
}
