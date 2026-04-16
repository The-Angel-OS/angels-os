/**
 * Transporter System — Sprint 44
 *
 * Beams products and services between Enterprises in the Angel OS Federation.
 *
 * Like Star Trek's transporter, this system dematerializes a product listing
 * from one Enterprise and rematerializes it on another — preserving the design,
 * pricing, and required capabilities while establishing a revenue-split
 * relationship between the origin (designer) and destination (retailer/fulfiller).
 *
 * ## How It Works
 *
 * 1. **Beam Out (Export)**: Enterprise A marks a product with `networkListing: true`
 *    and defines `requiredCapabilities`. The product becomes visible in the
 *    Federation catalog for any Enterprise to "beam in."
 *
 * 2. **Beam In (Import)**: Enterprise B discovers the product in the catalog and
 *    requests a transport. The system creates a linked copy on Enterprise B's
 *    storefront with a `transportOrigin` reference back to Enterprise A.
 *
 * 3. **Fulfillment Routing**: When a customer orders the beamed product on
 *    Enterprise B, the order routing engine matches the `requiredCapabilities`
 *    to a capable Holon node — which could be Enterprise A, Enterprise B,
 *    or Enterprise C (a third-party manufacturer).
 *
 * 4. **Revenue Split**: The Constitutional 70/20/4/1/5 split applies, with the
 *    70% "provider portion" further divided among `participants` (designer,
 *    manufacturer, retailer) per the product's revenue split configuration.
 *
 * ## Holon Puzzle Pieces
 *
 * Each Enterprise contributes different facets to the network:
 * - **manufacturer**: Can produce goods (has equipment, materials, skills)
 * - **retailer**: Has a storefront and customer base
 * - **creator**: Designs products, creates content, licenses IP
 * - **community**: Provides gathering spaces, events, coordination
 * - **guardian-angel**: Advocates for beneficiaries (nonprofits, legal aid)
 *
 * A full-spectrum Enterprise (like Clearwater Cruisin) covers 4-5 of these.
 * A specialist (like Hays Cactus Farm) covers 1-2. Together they form a complete
 * economic Holon — self-sustaining within a geographic radius.
 *
 * @see orderRoutingEngine.ts — Matches orders to capable Holon nodes
 * @see HolonCapabilities collection — Manufacturing network registry
 * @see Products collection — networkListing, fulfillmentMode, requiredCapabilities
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransportManifest {
  /** The product being beamed */
  productId: number
  /** Origin Enterprise (designer/creator) */
  originTenantId: number
  /** Destination Enterprise (retailer/storefront) */
  destinationTenantId: number
  /** Which capabilities are required to fulfill this product */
  requiredCapabilities: TransportCapability[]
  /** Revenue split participants for the beamed copy */
  participants: TransportParticipant[]
}

export interface TransportCapability {
  skill: string
  equipment?: string
  materials?: string[]
}

export interface TransportParticipant {
  role: 'designer' | 'manufacturer' | 'licensor' | 'affiliate' | 'retailer'
  tenantId: number
  percentage: number
  label: string
}

export interface TransportResult {
  success: boolean
  /** The newly created product ID on the destination Enterprise */
  beamedProductId?: number
  /** The transport manifest used */
  manifest: TransportManifest
  /** Human-readable status */
  message: string
}

export interface BeamableProduct {
  id: number
  title: string
  slug: string
  originTenant: { id: number; name: string; slug: string }
  requiredCapabilities: TransportCapability[]
  priceInUSD: number
  productionType: string
  fulfillmentMode: string
}

// ---------------------------------------------------------------------------
// Core Logic
// ---------------------------------------------------------------------------

/**
 * Build a transport manifest for beaming a product between Enterprises.
 *
 * The manifest defines the origin, destination, required capabilities,
 * and default revenue split. The designer gets 40% of the provider portion,
 * the retailer gets 30%, and the manufacturer gets 30%.
 */
export function buildTransportManifest(
  product: {
    id: number
    requiredCapabilities?: TransportCapability[]
  },
  originTenantId: number,
  destinationTenantId: number,
): TransportManifest {
  return {
    productId: product.id,
    originTenantId,
    destinationTenantId,
    requiredCapabilities: product.requiredCapabilities || [],
    participants: [
      {
        role: 'designer',
        tenantId: originTenantId,
        percentage: 40,
        label: 'Original designer',
      },
      {
        role: 'retailer',
        tenantId: destinationTenantId,
        percentage: 30,
        label: 'Storefront retailer',
      },
      {
        role: 'manufacturer',
        tenantId: 0, // Resolved at fulfillment time by order routing engine
        percentage: 30,
        label: 'Fulfilling manufacturer (TBD)',
      },
    ],
  }
}

/**
 * Validate that a product is eligible for transport.
 *
 * A product can only be beamed if:
 * 1. It has `networkListing: true`
 * 2. It has `requiredCapabilities` defined (so a fulfiller can be matched)
 * 3. The origin and destination are different Enterprises
 */
export function validateTransportEligibility(
  product: {
    networkListing?: boolean
    requiredCapabilities?: TransportCapability[]
    fulfillmentMode?: string
  },
  originTenantId: number,
  destinationTenantId: number,
): { eligible: boolean; reason?: string } {
  if (!product.networkListing) {
    return { eligible: false, reason: 'Product is not listed on the federation network' }
  }

  if (originTenantId === destinationTenantId) {
    return { eligible: false, reason: 'Cannot transport a product to the same Enterprise' }
  }

  if (!product.requiredCapabilities || product.requiredCapabilities.length === 0) {
    // Products without capabilities can still be beamed, but only as
    // self-fulfilled items (the origin Enterprise handles production)
    if (product.fulfillmentMode === 'network') {
      return {
        eligible: false,
        reason: 'Network-routed products must define requiredCapabilities for fulfillment matching',
      }
    }
  }

  return { eligible: true }
}

/**
 * Calculate the revenue split for a beamed product order.
 *
 * Constitutional split: 70% provider / 20% platform / 4% ops / 1% contributors / 5% justice
 * The 70% provider portion is divided among the transport participants.
 *
 * @param orderTotal - Total order amount in cents
 * @param participants - Revenue split participants from the transport manifest
 * @returns Breakdown of how each cent is distributed
 */
export function calculateTransportRevenueSplit(
  orderTotal: number,
  participants: TransportParticipant[],
): {
  platform: number
  operations: number
  contributors: number
  justiceFund: number
  participantShares: Array<{ role: string; tenantId: number; amount: number; label: string }>
} {
  const providerPortion = Math.floor(orderTotal * 0.70)
  const platform = Math.floor(orderTotal * 0.20)
  const operations = Math.floor(orderTotal * 0.04)
  const contributors = Math.floor(orderTotal * 0.01)
  const justiceFund = orderTotal - providerPortion - platform - operations - contributors

  const participantShares = participants.map((p) => ({
    role: p.role,
    tenantId: p.tenantId,
    amount: Math.floor(providerPortion * (p.percentage / 100)),
    label: p.label,
  }))

  // Distribute rounding remainder to the designer
  const sharedTotal = participantShares.reduce((sum, s) => sum + s.amount, 0)
  const remainder = providerPortion - sharedTotal
  if (remainder > 0 && participantShares.length > 0) {
    participantShares[0].amount += remainder
  }

  return { platform, operations, contributors, justiceFund, participantShares }
}

/**
 * Check if a destination Enterprise has the capabilities to self-fulfill
 * a beamed product (making it a retailer AND manufacturer in one).
 */
export function canSelfFulfill(
  requiredCapabilities: TransportCapability[],
  destinationCapabilities: Array<{ skill: string; equipment?: string; materials?: string[] }>,
): boolean {
  if (requiredCapabilities.length === 0) return true

  return requiredCapabilities.every((req) => {
    const normalizedReq = req.skill.toLowerCase().replace(/\s+/g, '-')
    return destinationCapabilities.some((cap) => {
      const normalizedCap = cap.skill.toLowerCase().replace(/\s+/g, '-')
      if (normalizedCap !== normalizedReq) return false

      // Check materials if specified
      if (req.materials && req.materials.length > 0) {
        const capMaterials = (cap.materials || []).map((m) => m.toLowerCase())
        return req.materials.every((m) => capMaterials.includes(m.toLowerCase()))
      }

      return true
    })
  })
}
