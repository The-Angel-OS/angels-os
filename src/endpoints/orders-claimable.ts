/**
 * Claimable Orders Endpoint — GET /api/orders/claimable
 *
 * Returns queued Angel Token orders that match the caller's Holon capabilities.
 * Vendors browse this list and claim orders they want to fulfill.
 *
 * Auth: Must have a Holon with acceptingOrders: true.
 * No customer PII is exposed — just product/capability/revenue info.
 *
 * @see src/utilities/angelTokens.ts — Angel Token lifecycle
 */
import type { PayloadHandler } from 'payload'
import { matchCapabilities, matchMaterials } from '@/utilities/orderRoutingEngine'

export const ordersClaimableHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    // Find the caller's Holon(s)
    const userTenantIds: number[] = []
    const memberships = await payload.find({
      collection: 'tenant-memberships' as any,
      where: {
        user: { equals: user.id },
        status: { equals: 'active' },
      },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    })

    for (const m of memberships.docs as any[]) {
      const tenantId = typeof m.tenant === 'object' ? m.tenant?.id : m.tenant
      if (tenantId) userTenantIds.push(tenantId)
    }

    if (userTenantIds.length === 0) {
      return Response.json({ claimable: [], message: 'No tenant memberships found.' })
    }

    // Find Holons owned by user's tenants
    const holonDocs = await payload.find({
      collection: 'holon-capabilities' as any,
      where: {
        tenant: { in: userTenantIds },
        acceptingOrders: { equals: true },
        constitutionalCompliance: { equals: true },
      },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    })

    if (holonDocs.docs.length === 0) {
      return Response.json({
        claimable: [],
        message: 'No active Holons found. Register your workshop capabilities first.',
      })
    }

    // Aggregate all capabilities across user's Holons
    const allCaps = holonDocs.docs.flatMap((doc: any) =>
      (doc.capabilities || []).map((c: any) => ({
        skill: c.skill,
        equipment: c.equipment,
        materials: c.materials,
      })),
    )

    // Query all queued Angel Tokens
    const queuedOrders = await payload.find({
      collection: 'orders' as any,
      where: {
        'fulfillment.fulfillmentStatus': { equals: 'pending_match' },
        'fulfillment.tokenStatus': { equals: 'active' },
      },
      depth: 2,
      limit: 100,
      overrideAccess: true,
    })

    // Filter to orders matching this vendor's capabilities
    const claimable: Array<{
      orderId: number
      orderItemIndex: number
      angelTokenId: string
      productTitle: string
      requiredSkills: string[]
      price: number
      vendorShare: number
      queuedAt: string
      queueReason: string
      configurationSummary: string | null
    }> = []

    for (const order of queuedOrders.docs as any[]) {
      const fulfillment = order.fulfillment || []
      const items = order.items || []

      for (const entry of fulfillment) {
        if (entry.fulfillmentStatus !== 'pending_match' || entry.tokenStatus !== 'active') continue
        if (!entry.queuedAt) continue

        const item = items[entry.orderItemIndex]
        const product = typeof item?.product === 'object' ? item.product : null
        if (!product) continue

        // Extract required skills
        const skills: string[] = []
        const materials: string[] = []
        const reqCaps = product.requiredCapabilities || []
        for (const cap of reqCaps as any[]) {
          if (cap.skill) skills.push(cap.skill)
          if (cap.materials && Array.isArray(cap.materials)) materials.push(...cap.materials)
        }

        if (skills.length === 0) continue

        // Check if vendor's capabilities match
        if (!matchCapabilities(skills, allCaps)) continue
        if (!matchMaterials(materials.length > 0 ? materials : undefined, allCaps)) continue

        // Build configuration summary (no PII)
        let configurationSummary: string | null = null
        if (entry.selectedConfiguration && typeof entry.selectedConfiguration === 'object') {
          const config = entry.selectedConfiguration as Record<string, unknown>
          const parts: string[] = []
          if (config.color) parts.push(`Color: ${config.color}`)
          if (config.size) parts.push(`Size: ${config.size}`)
          if (config.customText) parts.push(`Custom text: Yes`)
          if (config.material) parts.push(`Material: ${config.material}`)
          if (config.finish) parts.push(`Finish: ${config.finish}`)
          configurationSummary = parts.length > 0 ? parts.join(', ') : null
        }

        const price = item.price || product.priceInUSD || 0
        claimable.push({
          orderId: order.id,
          orderItemIndex: entry.orderItemIndex,
          angelTokenId: entry.angelTokenId || 'unknown',
          productTitle: product.title || 'Unnamed',
          requiredSkills: skills,
          price,
          vendorShare: Math.round(price * 0.6 * 100) / 100, // 60% per UltimateFair
          queuedAt: entry.queuedAt,
          queueReason: entry.queueReason || '',
          configurationSummary,
        })
      }
    }

    // Sort by oldest first (FIFO — first in, first served)
    claimable.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))

    return Response.json({
      claimable,
      totalAvailable: claimable.length,
      totalVendorRevenue: Math.round(claimable.reduce((sum, c) => sum + c.vendorShare, 0) * 100) / 100,
    })
  } catch (err) {
    console.error('Claimable orders error:', err)
    return Response.json({ error: 'Failed to fetch claimable orders.' }, { status: 500 })
  }
}
