/**
 * Order Claim Endpoint — POST /api/order-ops/claim
 *
 * Allows a vendor to claim a queued Angel Token order.
 * This is the vendor-initiated alternative to auto-matching —
 * vendors browse available orders and choose which to fulfill.
 *
 * Auth: Must own a Holon with matching capabilities.
 *
 * @see src/endpoints/orders-claimable.ts — browse available orders
 * @see src/utilities/angelTokens.ts — Angel Token lifecycle
 */
import type { PayloadHandler } from 'payload'
import { matchCapabilities } from '@/utilities/orderRoutingEngine'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { logError } from '@/utilities/logError'

export const orderClaimHandler: PayloadHandler = async (req) => {
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

  const { orderId, orderItemIndex, holonId } = body

  if (!orderId || orderItemIndex === undefined || !holonId) {
    return Response.json({
      error: 'orderId, orderItemIndex, and holonId are required.',
    }, { status: 400 })
  }

  let holonTenantId: number | undefined
  try {
    // Verify Holon ownership — must belong to a tenant the user is a member of
    const holon = await payload.findByID({
      collection: 'holon-capabilities' as any,
      id: holonId as number,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!holon) {
      return Response.json({ error: 'Holon not found.' }, { status: 404 })
    }

    holonTenantId = typeof holon.tenant === 'object' ? holon.tenant?.id : holon.tenant
    const membership = await payload.find({
      collection: 'tenant-memberships' as any,
      where: {
        user: { equals: user.id },
        tenant: { equals: holonTenantId },
        status: { equals: 'active' },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (membership.docs.length === 0) {
      return Response.json({
        error: 'You are not a member of the tenant that owns this Holon.',
      }, { status: 403 })
    }

    // Fetch order
    const order = await payload.findByID({
      collection: 'orders' as any,
      id: orderId as number,
      depth: 2,
      overrideAccess: true,
    }) as any

    if (!order) {
      return Response.json({ error: 'Order not found.' }, { status: 404 })
    }

    // Find the fulfillment entry
    const fulfillment = (order.fulfillment || []).slice()
    const fi = fulfillment.findIndex(
      (f: any) => f.orderItemIndex === (orderItemIndex as number),
    )

    if (fi < 0) {
      return Response.json({
        error: 'No fulfillment entry found for this item index.',
      }, { status: 404 })
    }

    const entry = fulfillment[fi]

    // Race condition guard — must still be pending_match and active
    if (entry.fulfillmentStatus !== 'pending_match' || entry.tokenStatus !== 'active') {
      return Response.json({
        error: 'This order item is no longer available for claiming.',
      }, { status: 409 })
    }

    // Verify capability match
    const item = (order.items || [])[orderItemIndex as number]
    const product = typeof item?.product === 'object' ? item.product : null
    if (product?.requiredCapabilities) {
      const skills = (product.requiredCapabilities as any[])
        .map((c: any) => c.skill)
        .filter(Boolean)

      if (skills.length > 0) {
        const holonCaps = (holon.capabilities || []).map((c: any) => ({
          skill: c.skill,
          equipment: c.equipment,
          materials: c.materials,
        }))

        if (!matchCapabilities(skills, holonCaps)) {
          return Response.json({
            error: `Your Holon doesn't have the required capabilities: ${skills.join(', ')}`,
          }, { status: 400 })
        }
      }
    }

    // Claim the order — update fulfillment entry
    fulfillment[fi] = {
      ...entry,
      fulfillmentStatus: 'matched',
      assignedHolon: holonId,
      sourceTenant: holonTenantId,
      matchScore: 100, // Manual claim = perfect match (vendor chose it)
      matchedAt: new Date().toISOString(),
      // Keep Angel Token fields — token redeems on delivery
    }

    await payload.update({
      collection: 'orders' as any,
      id: orderId as number,
      data: { fulfillment } as any,
      overrideAccess: true,
    })

    // Increment Holon's active order count
    await payload.update({
      collection: 'holon-capabilities' as any,
      id: holonId as number,
      data: { activeOrderCount: (holon.activeOrderCount || 0) + 1 } as any,
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      message: `Order #${orderId} claimed by ${holon.businessName || 'your Holon'}. Accept the order to begin production.`,
      angelTokenId: entry.angelTokenId,
      productTitle: product?.title || 'Product',
    })
  } catch (err) {
    console.error('Order claim error:', err)
    await logError({
      source: 'order-claim',
      message: `Failed to claim order #${orderId}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId: holonTenantId,
      userId: user.id,
    })
    return Response.json({ error: 'Failed to claim order.' }, { status: 500 })
  }
}
