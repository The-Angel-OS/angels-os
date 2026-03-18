/**
 * Order Accept Endpoint — POST /api/order-ops/accept
 *
 * Vendor accepts an assigned order (status: matched → accepted).
 * Auth: user's tenant must own the assigned holon.
 *
 * @see src/utilities/orderRoutingEngine.ts — state machine
 */
import type { PayloadHandler } from 'payload'
import { validateFulfillmentTransition } from '@/utilities/orderRoutingEngine'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const orderAcceptHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'orders')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId, itemIndex, estimatedCompletionDate } = body

  if (!orderId) {
    return Response.json({ error: 'orderId is required.' }, { status: 400 })
  }
  if (itemIndex === undefined || itemIndex === null) {
    return Response.json({ error: 'itemIndex is required.' }, { status: 400 })
  }

  // Validate date if provided
  if (estimatedCompletionDate) {
    const date = new Date(String(estimatedCompletionDate))
    if (isNaN(date.getTime())) {
      return Response.json({ error: 'estimatedCompletionDate must be a valid ISO 8601 date.' }, { status: 400 })
    }
  }

  // Fetch order
  let order: Record<string, unknown>
  try {
    order = (await payload.findByID({
      collection: 'orders' as any,
      id: orderId as number,
      depth: 2,
      overrideAccess: true,
    })) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Order not found.' }, { status: 404 })
  }

  // Find the fulfillment entry for this item
  const fulfillment = ((order.fulfillment as any[]) || []).slice()
  const entryIndex = fulfillment.findIndex((f: any) => f.orderItemIndex === itemIndex)

  if (entryIndex < 0) {
    return Response.json({ error: 'No fulfillment assignment found for this item.' }, { status: 400 })
  }

  const entry = fulfillment[entryIndex]

  // Verify the assigned holon belongs to the user's tenant
  const assignedHolonId = typeof entry.assignedHolon === 'object' ? entry.assignedHolon?.id : entry.assignedHolon
  if (assignedHolonId) {
    try {
      const holon = await payload.findByID({
        collection: 'holon-capabilities' as any,
        id: assignedHolonId,
        depth: 0,
        overrideAccess: true,
      }) as any

      // Check tenant ownership
      const holonTenant = typeof holon.tenant === 'object' ? holon.tenant?.id : holon.tenant
      const userTenants = ((user as any).tenants || []).map((t: any) =>
        typeof t.tenant === 'object' ? t.tenant?.id : t.tenant,
      )

      const isAdmin = Array.isArray((user as any).roles) && (user as any).roles.includes('admin')
      if (!isAdmin && !userTenants.includes(holonTenant)) {
        return Response.json(
          { error: 'You do not have permission to accept this order. Your tenant must own the assigned holon.' },
          { status: 403 },
        )
      }
    } catch {
      return Response.json({ error: 'Assigned holon not found.' }, { status: 404 })
    }
  }

  // Validate state transition
  const currentStatus = entry.fulfillmentStatus || 'pending_match'
  if (!validateFulfillmentTransition(currentStatus, 'accepted')) {
    return Response.json(
      { error: `Cannot accept: current status is "${currentStatus}". Order must be in "matched" status.` },
      { status: 400 },
    )
  }

  // Update fulfillment entry
  fulfillment[entryIndex] = {
    ...entry,
    fulfillmentStatus: 'accepted',
    acceptedAt: new Date().toISOString(),
    ...(estimatedCompletionDate ? { estimatedCompletion: estimatedCompletionDate } : {}),
  }

  await payload.update({
    collection: 'orders' as any,
    id: orderId as number,
    data: { fulfillment } as any,
    overrideAccess: true,
  })

  // Calculate vendor share (60% default)
  const items = (order.items as any[]) || []
  const item = items[itemIndex as number]
  const itemPrice = item?.price || item?.priceInUSD || 0
  const vendorShare = Math.round(itemPrice * 0.6 * 100) / 100

  return Response.json({
    success: true,
    message: `Order accepted. Estimated vendor share (60%): $${vendorShare.toFixed(2)}.`,
    fulfillmentStatus: 'accepted',
    vendorShare,
    ...(estimatedCompletionDate ? { estimatedCompletion: estimatedCompletionDate } : {}),
  })
}
