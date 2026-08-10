/**
 * HolonCapabilities Hooks — Auto-Match Angel Tokens on Registration
 *
 * When a new Holon registers or an existing one starts accepting orders,
 * automatically check the Angel Token queue for matching orders and
 * assign them to the new maker.
 *
 * This is the mechanism that fulfills the core Angel Token promise:
 * "Your order will be fulfilled as soon as a qualified maker joins."
 *
 * @see src/utilities/angelTokens.ts — Angel Token lifecycle
 * @see src/utilities/orderRoutingEngine.ts — matching engine
 */
import type { CollectionAfterChangeHook } from 'payload'
import {
  findMatchingHolons,
  type HolonNode,
  type OrderRequirement,
} from '@/utilities/orderRoutingEngine'

/**
 * After a Holon is created or updated, check if it can fulfill queued Angel Tokens.
 *
 * Triggers when:
 * - A new Holon is created with acceptingOrders: true
 * - An existing Holon's acceptingOrders changes to true
 * - A Holon's capabilities are updated (might now match previously unmatched orders)
 */
export const afterHolonChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  // Only trigger if the Holon is now accepting orders
  if (!doc.acceptingOrders || !doc.constitutionalCompliance) return

  // On update, only trigger if acceptingOrders just became true OR capabilities changed
  if (operation === 'update' && previousDoc) {
    const wasAccepting = previousDoc.acceptingOrders
    const capsChanged = JSON.stringify(previousDoc.capabilities) !== JSON.stringify(doc.capabilities)
    if (wasAccepting && !capsChanged) return // No meaningful change
  }

  try {
    // Build this Holon as a HolonNode for the routing engine
    const holonNode: HolonNode = {
      id: doc.id,
      tenantId: typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant,
      businessName: doc.businessName || doc.nodeName || `Holon #${doc.id}`,
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
      acceptingOrders: true,
      constitutionalCompliance: true,
    }

    // Query all orders that have queued Angel Tokens (pending_match with queuedAt)
    const queuedOrders = await req.payload.find({
      collection: 'orders',
      where: {
        'fulfillment.fulfillmentStatus': { equals: 'pending_match' },
        'fulfillment.tokenStatus': { equals: 'active' },
      },
      depth: 2,
      limit: 200,
      overrideAccess: true,
    })

    if (queuedOrders.docs.length === 0) return

    let matchedCount = 0

    for (const order of queuedOrders.docs as any[]) {
      const fulfillment = (order.fulfillment || []).slice()
      const items = order.items || []
      let orderUpdated = false

      for (let fi = 0; fi < fulfillment.length; fi++) {
        const entry = fulfillment[fi]

        // Skip non-queued entries
        if (entry.fulfillmentStatus !== 'pending_match' || entry.tokenStatus !== 'active') continue
        if (!entry.queuedAt) continue

        // Get the product for this item
        const item = items[entry.orderItemIndex]
        const product = typeof item?.product === 'object' ? item.product : null
        if (!product) continue

        // Extract required skills from product
        const skills: string[] = []
        const materials: string[] = []
        const equipment: string[] = []
        const reqCaps = product.requiredCapabilities || []
        for (const cap of reqCaps as any[]) {
          if (cap.skill) skills.push(cap.skill)
          if (cap.equipment) equipment.push(cap.equipment)
          if (cap.materials && Array.isArray(cap.materials)) {
            materials.push(...cap.materials)
          }
        }

        if (skills.length === 0) continue // Can't match without skills

        // Check if this new Holon matches
        const requirement: OrderRequirement = {
          skills,
          materials: materials.length > 0 ? materials : undefined,
          equipment: equipment.length > 0 ? equipment : undefined,
          buyerLocation: { lat: 27.9659, lng: -82.8001 }, // Default Clearwater FL
        }

        const matches = findMatchingHolons(requirement, [holonNode], { maxResults: 1 })

        if (matches.length > 0) {
          const match = matches[0]
          fulfillment[fi] = {
            ...entry,
            fulfillmentStatus: 'matched',
            assignedHolon: holonNode.id,
            sourceTenant: holonNode.tenantId,
            matchScore: Math.round(match.totalScore),
            matchedAt: new Date().toISOString(),
            // Keep Angel Token fields — token redeems on delivery, not on match
          }
          orderUpdated = true
          matchedCount++
        }
      }

      if (orderUpdated) {
        await req.payload.update({
          collection: 'orders',
          id: order.id,
          data: { fulfillment } as any,
          req,
          overrideAccess: true,
        })

        // Create AI Bus message for visibility
        try {
          const tenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant
          await req.payload.create({
            collection: 'messages',
            data: {
              content: `Angel Token matched! Order #${order.id} has been assigned to ${holonNode.businessName}. The maker can now accept and begin production.`,
              messageType: 'system',
              tenant: tenantId,
              author: (req.user?.id as number) ?? 1,
            } as any,
            req,
          })
        } catch {
          // Non-blocking — message creation failure shouldn't stop matching
        }
      }
    }

    // matchedCount available here if needed for future telemetry
  } catch (err) {
    // Non-blocking: hook failure shouldn't prevent Holon registration
    console.error('[Angel Token Auto-Match] Error during queue drain:', err)
  }
}
