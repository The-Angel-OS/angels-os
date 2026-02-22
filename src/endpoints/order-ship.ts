/**
 * Order Ship Endpoint — POST /api/orders/ship
 *
 * Convenience endpoint for the common "mark as shipped" flow.
 * Validates the in_production → shipped transition, sets tracking info,
 * and timestamps the shipment.
 *
 * Body: { orderId, itemIndex, trackingNumber, trackingUrl? }
 * Auth: assigned vendor or admin.
 *
 * @see order-fulfill.ts — general fulfillment state machine
 */
import type { PayloadHandler } from 'payload'
import { validateFulfillmentTransition } from '@/utilities/orderRoutingEngine'

export const orderShipHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId, itemIndex, trackingNumber, trackingUrl } = body

  if (!orderId) {
    return Response.json({ error: 'orderId is required.' }, { status: 400 })
  }
  if (itemIndex === undefined || itemIndex === null) {
    return Response.json({ error: 'itemIndex is required.' }, { status: 400 })
  }
  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return Response.json({ error: 'trackingNumber is required for shipping.' }, { status: 400 })
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

  // Find fulfillment entry
  const fulfillment = ((order.fulfillment as any[]) || []).slice()
  const entryIndex = fulfillment.findIndex((f: any) => f.orderItemIndex === itemIndex)

  if (entryIndex < 0) {
    return Response.json({ error: 'No fulfillment assignment found for this item.' }, { status: 400 })
  }

  const entry = fulfillment[entryIndex]
  const currentStatus = entry.fulfillmentStatus || 'pending_match'

  // Validate transition to shipped
  if (!validateFulfillmentTransition(currentStatus, 'shipped')) {
    return Response.json(
      {
        error: `Cannot ship from "${currentStatus}". Order must be in "in_production" status first.`,
        currentStatus,
      },
      { status: 400 },
    )
  }

  // Verify vendor ownership
  const assignedHolonId = typeof entry.assignedHolon === 'object' ? entry.assignedHolon?.id : entry.assignedHolon
  if (assignedHolonId) {
    try {
      const holon = await payload.findByID({
        collection: 'holon-capabilities' as any,
        id: assignedHolonId,
        depth: 0,
        overrideAccess: true,
      }) as any

      const holonTenant = typeof holon.tenant === 'object' ? holon.tenant?.id : holon.tenant
      const userTenants = ((user as any).tenants || []).map((t: any) =>
        typeof t.tenant === 'object' ? t.tenant?.id : t.tenant,
      )

      const isAdmin = Array.isArray((user as any).roles) && (user as any).roles.includes('admin')
      if (!isAdmin && !userTenants.includes(holonTenant)) {
        return Response.json(
          { error: 'Only the assigned vendor can ship this order.' },
          { status: 403 },
        )
      }
    } catch {
      return Response.json({ error: 'Assigned holon not found.' }, { status: 404 })
    }
  }

  // Update fulfillment entry
  const now = new Date().toISOString()
  fulfillment[entryIndex] = {
    ...entry,
    fulfillmentStatus: 'shipped',
    shippedAt: now,
    trackingNumber,
    ...(trackingUrl ? { trackingUrl } : {}),
  }

  await payload.update({
    collection: 'orders' as any,
    id: orderId as number,
    data: { fulfillment } as any,
    overrideAccess: true,
  })

  return Response.json({
    success: true,
    message: 'Order marked as shipped.',
    shippedAt: now,
    trackingNumber,
    ...(trackingUrl ? { trackingUrl } : {}),
  })
}
