/**
 * Order Routing Endpoint — POST /api/orders/route
 *
 * Triggers the routing engine to find and assign the best vendor
 * for an order (or a specific item within an order).
 *
 * When no matching Holon exists, issues an Angel Token — a paid
 * claim on future production that queues until a maker joins.
 *
 * Auth: order owner or admin.
 *
 * @see src/utilities/orderRoutingEngine.ts — matching engine
 * @see src/utilities/angelTokens.ts — token lifecycle
 */
import type { PayloadHandler } from 'payload'
import {
  findMatchingHolons,
  type HolonNode,
  type OrderRequirement,
} from '@/utilities/orderRoutingEngine'
import { createAngelTokenEntry } from '@/utilities/angelTokens'

export const orderRouteHandler: PayloadHandler = async (req) => {
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

  const { orderId, itemIndex, preferredHolonId } = body

  if (!orderId) {
    return Response.json({ error: 'orderId is required.' }, { status: 400 })
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

  // Verify ownership — order owner or admin
  const orderedBy = order.orderedBy as Record<string, unknown> | number | undefined
  const orderUserId = typeof orderedBy === 'object' ? orderedBy?.id : orderedBy
  const isAdmin = Array.isArray((user as any).roles) && (user as any).roles.includes('admin')
  if (String(orderUserId) !== String(user.id) && !isAdmin) {
    return Response.json({ error: 'You do not have permission to route this order.' }, { status: 403 })
  }

  // Get order items to determine required capabilities
  const items = (order.items as Array<Record<string, unknown>>) || []
  const targetItems =
    itemIndex !== undefined ? [items[itemIndex as number]].filter(Boolean) : items

  if (targetItems.length === 0) {
    return Response.json({ error: 'No items to route.' }, { status: 400 })
  }

  // If preferredHolonId is set, assign directly
  if (preferredHolonId) {
    try {
      const holon = await payload.findByID({
        collection: 'holon-capabilities' as any,
        id: preferredHolonId as number,
        depth: 0,
        overrideAccess: true,
      })

      if (!holon) {
        return Response.json({ error: 'Preferred vendor not found.' }, { status: 404 })
      }

      // Update fulfillment for target items
      const fulfillment = ((order.fulfillment as any[]) || []).slice()
      for (const item of targetItems) {
        const idx = items.indexOf(item)
        const existing = fulfillment.findIndex((f: any) => f.orderItemIndex === idx)
        const entry = {
          orderItemIndex: idx,
          assignedHolon: preferredHolonId,
          fulfillmentStatus: 'matched',
          matchScore: 100,
          matchedAt: new Date().toISOString(),
        }
        if (existing >= 0) {
          fulfillment[existing] = { ...fulfillment[existing], ...entry }
        } else {
          fulfillment.push(entry)
        }
      }

      await payload.update({
        collection: 'orders' as any,
        id: orderId as number,
        data: { fulfillment } as any,
        overrideAccess: true,
      })

      return Response.json({
        success: true,
        message: `Order routed to preferred vendor.`,
        assignedHolon: preferredHolonId,
        matchScore: 100,
      })
    } catch {
      return Response.json({ error: 'Failed to assign preferred vendor.' }, { status: 500 })
    }
  }

  // Auto-route: find matching holons via the routing engine
  try {
    // Gather required skills, equipment, and materials from products
    const skills: string[] = []
    const materials: string[] = []
    const equipment: string[] = []
    for (const item of targetItems) {
      const product = item.product as Record<string, unknown> | undefined
      if (product?.requiredCapabilities && Array.isArray(product.requiredCapabilities)) {
        for (const cap of product.requiredCapabilities as any[]) {
          if (cap.skill) skills.push(cap.skill)
          if (cap.equipment) equipment.push(cap.equipment)
          if (cap.materials && Array.isArray(cap.materials)) {
            materials.push(...cap.materials)
          }
        }
      }
    }

    // Products without requiredCapabilities can still queue — they just need
    // general manufacturing or self-fulfillment capability
    const effectiveSkills = skills.length > 0 ? skills : ['general-manufacturing']

    // Get buyer location (from order or fallback)
    const buyerLocation = { lat: 27.9659, lng: -82.8001 } // Default Clearwater FL

    // Query all accepting holons
    const holonDocs = await payload.find({
      collection: 'holon-capabilities' as any,
      where: {
        acceptingOrders: { equals: true },
        constitutionalCompliance: { equals: true },
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    // Convert to HolonNode format
    const holons: HolonNode[] = holonDocs.docs.map((doc: any) => ({
      id: doc.id,
      tenantId: typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant,
      businessName: doc.businessName || doc.nodeName,
      nodeType: doc.nodeType || 'general',
      capabilities: (doc.capabilities || []).map((c: any) => ({
        skill: c.skill,
        equipment: c.equipment,
        materials: c.materials,
        maxVolume: c.maxVolume,
        turnaroundHours: c.turnaroundHours,
      })),
      serviceRadius: doc.serviceRadius || 100,
      location: doc.location || { lat: 0, lng: 0 },
      rating: doc.rating || 0,
      activeOrderCount: doc.activeOrderCount || 0,
      acceptingOrders: doc.acceptingOrders !== false,
      constitutionalCompliance: doc.constitutionalCompliance !== false,
    }))

    const requirement: OrderRequirement = {
      skills: effectiveSkills,
      materials: materials.length > 0 ? materials : undefined,
      equipment: equipment.length > 0 ? equipment : undefined,
      buyerLocation,
    }

    const matches = findMatchingHolons(requirement, holons, { maxResults: 5 })

    // ─── No matches? Issue Angel Tokens — queue for future fulfillment ───
    if (matches.length === 0) {
      const fulfillment = ((order.fulfillment as any[]) || []).slice()
      const angelTokenIds: string[] = []

      for (const item of targetItems) {
        const idx = items.indexOf(item)
        const existing = fulfillment.findIndex((f: any) => f.orderItemIndex === idx)

        // Extract configuration from order item if available
        const selectedConfiguration = (item as any).selectedConfiguration ||
          (item as any).variant || undefined

        const tokenEntry = createAngelTokenEntry({
          orderItemIndex: idx,
          requiredSkills: skills,
          selectedConfiguration,
        })

        angelTokenIds.push(tokenEntry.angelTokenId)

        if (existing >= 0) {
          fulfillment[existing] = { ...fulfillment[existing], ...tokenEntry }
        } else {
          fulfillment.push(tokenEntry)
        }
      }

      await payload.update({
        collection: 'orders' as any,
        id: orderId as number,
        data: { fulfillment } as any,
        overrideAccess: true,
      })

      const skillList = skills.length > 0 ? skills.join(', ') : 'general manufacturing'

      return Response.json({
        success: true,
        queued: true,
        message: `Order queued as Angel Token(s). Waiting for a maker with: ${skillList}. You'll be notified when one joins.`,
        angelTokenIds,
        queueReason: `Waiting for a maker with: ${skillList}`,
      })
    }

    // ─── Match found — assign best vendor ────────────────────────────
    const best = matches[0]
    const fulfillment = ((order.fulfillment as any[]) || []).slice()
    for (const item of targetItems) {
      const idx = items.indexOf(item)
      const existing = fulfillment.findIndex((f: any) => f.orderItemIndex === idx)
      const entry = {
        orderItemIndex: idx,
        assignedHolon: best.holon.id,
        sourceTenant: best.holon.tenantId,
        fulfillmentStatus: 'matched',
        matchScore: Math.round(best.totalScore),
        matchedAt: new Date().toISOString(),
      }
      if (existing >= 0) {
        fulfillment[existing] = { ...fulfillment[existing], ...entry }
      } else {
        fulfillment.push(entry)
      }
    }

    await payload.update({
      collection: 'orders' as any,
      id: orderId as number,
      data: { fulfillment } as any,
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      message: `Order matched to ${best.holon.businessName || 'vendor'} (score: ${Math.round(best.totalScore)}/100).`,
      assignedHolon: best.holon.id,
      matchScore: Math.round(best.totalScore),
      alternatives: matches.slice(1).map((m) => ({
        holonId: m.holon.id,
        businessName: m.holon.businessName,
        score: Math.round(m.totalScore),
        distance: Math.round(m.distance * 10) / 10,
      })),
    })
  } catch (err) {
    console.error('Order routing error:', err)
    return Response.json({ error: 'Failed to route order.' }, { status: 500 })
  }
}
