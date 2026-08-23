/**
 * Order Fulfillment Update Endpoint — POST /api/order-ops/fulfill
 *
 * Updates fulfillment status for an assigned order item.
 * Validates state machine transitions and required fields.
 *
 * Auth: assigned vendor only (or admin).
 *
 * @see src/utilities/orderRoutingEngine.ts — state machine
 */
import type { PayloadHandler } from 'payload'
import { validateFulfillmentTransition, validateFulfillmentUpdate } from '@/utilities/orderRoutingEngine'
import type { FulfillmentUpdate } from '@/utilities/orderRoutingEngine'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { managedTenantIds, isPlatformAdmin } from '@/access/portalManager'

export const orderFulfillHandler: PayloadHandler = async (req) => {
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

  const { orderId, itemIndex, status, trackingNumber, trackingUrl, rejectionReason } = body

  if (!orderId) {
    return Response.json({ error: 'orderId is required.' }, { status: 400 })
  }
  if (itemIndex === undefined || itemIndex === null) {
    return Response.json({ error: 'itemIndex is required.' }, { status: 400 })
  }
  if (!status) {
    return Response.json({ error: 'status is required.' }, { status: 400 })
  }

  // Validate the update payload
  const update: FulfillmentUpdate = {
    status: status as FulfillmentUpdate['status'],
    trackingNumber: trackingNumber as string | undefined,
    trackingUrl: trackingUrl as string | undefined,
    rejectionReason: rejectionReason as string | undefined,
  }

  const validationError = validateFulfillmentUpdate(update)
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 })
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
      // Managed tenants, not merely joined ones — enrol-on-arrival makes any
      // signed-in visitor a tenant_member of a portal they simply looked at.
      const userTenants = await managedTenantIds(req)

      const isAdmin = isPlatformAdmin(user)
      if (!isAdmin && !userTenants.includes(holonTenant)) {
        return Response.json(
          { error: 'Only the assigned vendor can update fulfillment status.' },
          { status: 403 },
        )
      }
    } catch {
      return Response.json({ error: 'Assigned holon not found.' }, { status: 404 })
    }
  }

  // Validate state transition
  const currentStatus = entry.fulfillmentStatus || 'pending_match'
  if (!validateFulfillmentTransition(currentStatus, status as any)) {
    return Response.json(
      { error: `Invalid transition: "${currentStatus}" → "${status}". Check valid state machine transitions.` },
      { status: 400 },
    )
  }

  // Build updated entry
  const now = new Date().toISOString()
  const updatedEntry: Record<string, unknown> = {
    ...entry,
    fulfillmentStatus: status,
  }

  if (status === 'shipped') {
    updatedEntry.shippedAt = now
    updatedEntry.trackingNumber = trackingNumber
    if (trackingUrl) updatedEntry.trackingUrl = trackingUrl
  }

  if (status === 'rejected') {
    updatedEntry.rejectionReason = rejectionReason
    // Reset to pending_match for re-routing
    updatedEntry.fulfillmentStatus = 'rejected'
  }

  fulfillment[entryIndex] = updatedEntry

  await payload.update({
    collection: 'orders' as any,
    id: orderId as number,
    data: { fulfillment } as any,
    overrideAccess: true,
  })

  // If rejected, increment the holon's active order count back down
  if (status === 'rejected' && assignedHolonId) {
    try {
      const holon = await payload.findByID({
        collection: 'holon-capabilities' as any,
        id: assignedHolonId,
        depth: 0,
        overrideAccess: true,
      }) as any
      const currentCount = holon.activeOrderCount || 0
      if (currentCount > 0) {
        await payload.update({
          collection: 'holon-capabilities' as any,
          id: assignedHolonId,
          data: { activeOrderCount: currentCount - 1 } as any,
          overrideAccess: true,
        })
      }
    } catch {
      // Non-critical — log but don't fail
      console.warn('Failed to update holon active order count after rejection')
    }
  }

  return Response.json({
    success: true,
    message: `Fulfillment updated to "${status}".`,
    fulfillmentStatus: status,
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(trackingUrl ? { trackingUrl } : {}),
  })
}
