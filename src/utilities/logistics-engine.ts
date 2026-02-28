/**
 * Logistics Engine — The Bread-Breaker & Soul Fleet Matchmaker
 *
 * Pure utility for routing resources between LogisticsNodes via Transports.
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * Two core algorithms:
 *   1. findNearestTransport(pickupGeo, shipmentSize) — finds idle transports
 *      within range, sorted by proximity, filtered by capacity.
 *
 *   2. matchSupplyToDemand(supplyNode, demandNode) — the "Bread-Breaker" —
 *      automatically creates a shipment manifest when inventory matches need.
 *
 * @see src/collections/Logistics/ — Schema definitions
 * @see src/utilities/orderRoutingEngine.ts — Holon manufacturing routing (sister engine)
 * @see tests/unit/utilities/logisticsEngine.test.ts — Unit tests
 */

// ---------------------------------------------------------------------------
// Types — mirror collection shapes without importing Payload
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number
  lng: number
}

export interface InventoryItem {
  item: string
  category?: string
  quantity: number
  unit?: string
  expiresAt?: string
  perishable?: boolean
  requiresRefrigeration?: boolean
}

export interface NeedItem {
  item: string
  category?: string
  quantity: number
  urgency?: 'standard' | 'urgent' | 'sos'
}

export interface LogisticsNodeData {
  id: number
  name: string
  handle?: string
  type: string
  governanceMode: 'regulated' | 'autonomous'
  location: GeoPoint & { city?: string; state?: string }
  geohash?: string
  serviceRadius: number
  inventory?: InventoryItem[]
  needs?: NeedItem[]
  status: 'active' | 'inactive' | 'seasonal'
  trustScore: number
}

export interface TransportData {
  id: number
  vehicleName: string
  ownerId: number
  transportType: string
  capacity: number
  status: 'idle' | 'en_route' | 'loading' | 'returning' | 'offline' | 'maintenance'
  currentLocation?: GeoPoint & { updatedAt?: string }
  maxRange: number
  specialCapabilities?: string[]
  completedDeliveries: number
  rating: number
}

export interface TransportMatch {
  transport: TransportData
  distanceMiles: number
  capacityFit: number       // ratio of shipment size to capacity (0-1, lower = more room)
  reliabilityScore: number  // weighted rating + delivery count
  totalScore: number        // composite ranking score (0-100)
}

export interface ManifestItem {
  item: string
  category?: string
  quantity: number
  unit?: string
  perishable?: boolean
  requiresRefrigeration?: boolean
}

export interface ShipmentProposal {
  origin: LogisticsNodeData
  destination: LogisticsNodeData
  manifest: ManifestItem[]
  totalSize: number
  priority: 'standard' | 'urgent' | 'sos'
  distanceMiles: number
  matchScore: number
  matchType: 'auto'
  requiresRefrigeration: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Earth's radius in miles (for Haversine) */
const EARTH_RADIUS_MI = 3959

/** Minimum match score to auto-generate a shipment proposal */
export const MIN_AUTO_MATCH_SCORE = 30

/** Scoring weights for transport ranking */
export const TRANSPORT_WEIGHTS = {
  proximity: 0.40,
  capacityFit: 0.25,
  reliability: 0.20,
  capabilities: 0.15,
} as const

// ---------------------------------------------------------------------------
// Distance — Haversine formula (mirrors orderRoutingEngine)
// ---------------------------------------------------------------------------

export function calculateDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// ---------------------------------------------------------------------------
// Transport Matching — "Soul Fleet Dispatch"
// ---------------------------------------------------------------------------

/**
 * Find the nearest idle transports that can handle a given shipment.
 *
 * @param pickupGeo - Where the goods need to be picked up
 * @param shipmentSize - Required cargo capacity in standard units
 * @param transports - All available transports in the network
 * @param options - Optional filters
 * @returns Sorted matches (best first), or empty array if nothing qualifies
 */
export function findNearestTransport(
  pickupGeo: GeoPoint,
  shipmentSize: number,
  transports: TransportData[],
  options?: {
    maxResults?: number
    requireRefrigeration?: boolean
    maxDistance?: number
  },
): TransportMatch[] {
  const maxResults = options?.maxResults ?? 5
  const maxDistance = options?.maxDistance ?? Infinity

  const matches: TransportMatch[] = []

  for (const transport of transports) {
    // Gate 1: Must be idle
    if (transport.status !== 'idle') continue

    // Gate 2: Must have sufficient capacity
    if (transport.capacity < shipmentSize) continue

    // Gate 3: Must have a known location
    if (!transport.currentLocation?.lat || !transport.currentLocation?.lng) continue

    // Gate 4: Special capability check
    if (options?.requireRefrigeration) {
      const hasCold = transport.specialCapabilities?.includes('refrigerated') ||
                      transport.specialCapabilities?.includes('temp_controlled')
      if (!hasCold) continue
    }

    // Calculate distance
    const dist = calculateDistance(pickupGeo, transport.currentLocation)

    // Gate 5: Within driver's max range and optional distance cap
    if (dist > transport.maxRange) continue
    if (dist > maxDistance) continue

    // Score components
    const proximityScore = Math.max(0, 100 - (dist / transport.maxRange) * 100)
    const capacityFit = shipmentSize / transport.capacity // lower = more room
    const capacityScore = (1 - capacityFit) * 100 // more room = higher score
    const reliabilityScore = (transport.rating / 5) * 70 +
      Math.min(transport.completedDeliveries / 50, 1) * 30
    const capabilityBonus = (transport.specialCapabilities?.length ?? 0) > 0 ? 15 : 0

    const totalScore =
      proximityScore * TRANSPORT_WEIGHTS.proximity +
      capacityScore * TRANSPORT_WEIGHTS.capacityFit +
      reliabilityScore * TRANSPORT_WEIGHTS.reliability +
      capabilityBonus * TRANSPORT_WEIGHTS.capabilities

    matches.push({
      transport,
      distanceMiles: Math.round(dist * 10) / 10,
      capacityFit: Math.round(capacityFit * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore * 10) / 10,
      totalScore: Math.round(totalScore * 10) / 10,
    })
  }

  // Sort by total score descending
  matches.sort((a, b) => b.totalScore - a.totalScore)

  return matches.slice(0, maxResults)
}

// ---------------------------------------------------------------------------
// Supply-Demand Matching — "The Bread-Breaker Algorithm"
// ---------------------------------------------------------------------------

/**
 * Match a supply node's inventory against a demand node's needs.
 *
 * Returns a ShipmentProposal if there's a meaningful match, or null if
 * the supply doesn't meet any of the demand.
 *
 * The algorithm:
 *   1. For each need at the demand node, check if the supply node has
 *      matching items (by category first, then fuzzy item name).
 *   2. Allocate the minimum of (available quantity, needed quantity).
 *   3. Score the match based on fill rate, distance, and urgency.
 *   4. Only propose if score >= MIN_AUTO_MATCH_SCORE.
 *
 * @param supplyNode - Node that HAS resources
 * @param demandNode - Node that NEEDS resources
 * @returns A shipment proposal or null if no viable match
 */
export function matchSupplyToDemand(
  supplyNode: LogisticsNodeData,
  demandNode: LogisticsNodeData,
): ShipmentProposal | null {
  // Gate: both nodes must be active
  if (supplyNode.status !== 'active' || demandNode.status !== 'active') return null

  // Gate: supply must have inventory, demand must have needs
  if (!supplyNode.inventory?.length || !demandNode.needs?.length) return null

  const manifest: ManifestItem[] = []
  let highestUrgency: 'standard' | 'urgent' | 'sos' = 'standard'
  let requiresRefrigeration = false
  let totalNeeded = 0
  let totalFilled = 0

  // Clone inventory quantities so we can "spend" them across multiple needs
  const availableQty = new Map<number, number>()
  supplyNode.inventory.forEach((inv, i) => availableQty.set(i, inv.quantity))

  for (const need of demandNode.needs) {
    totalNeeded += need.quantity

    // Track highest urgency across all needs
    if (need.urgency === 'sos') highestUrgency = 'sos'
    else if (need.urgency === 'urgent' && highestUrgency !== 'sos') highestUrgency = 'urgent'

    // Find matching inventory items
    for (let i = 0; i < supplyNode.inventory.length; i++) {
      const inv = supplyNode.inventory[i]
      const remaining = availableQty.get(i) ?? 0
      if (remaining <= 0) continue

      // Match: same category, or fuzzy name match
      const categoryMatch = need.category && inv.category && need.category === inv.category
      const nameMatch = fuzzyItemMatch(need.item, inv.item)
      if (!categoryMatch && !nameMatch) continue

      // Allocate what we can
      const allocate = Math.min(remaining, need.quantity - totalFilled)
      if (allocate <= 0) continue

      availableQty.set(i, remaining - allocate)
      totalFilled += allocate

      if (inv.perishable) requiresRefrigeration = true

      manifest.push({
        item: inv.item,
        category: inv.category ?? need.category,
        quantity: allocate,
        unit: inv.unit ?? 'units',
        perishable: inv.perishable,
        requiresRefrigeration: inv.requiresRefrigeration,
      })
    }
  }

  // No matches at all
  if (manifest.length === 0) return null

  // Score the match
  const fillRate = totalNeeded > 0 ? totalFilled / totalNeeded : 0
  const distance = calculateDistance(supplyNode.location, demandNode.location)

  // Urgency multiplier
  const urgencyMultiplier = highestUrgency === 'sos' ? 1.5 : highestUrgency === 'urgent' ? 1.2 : 1.0

  // Distance penalty (closer is better, max 200 miles for full score)
  const distanceScore = Math.max(0, 100 - (distance / 200) * 100)

  // Trust bonus
  const trustBonus = Math.min((supplyNode.trustScore + demandNode.trustScore) / 2, 10)

  const matchScore = Math.round(
    (fillRate * 60 + distanceScore * 0.3 + trustBonus) * urgencyMultiplier,
  )

  // Below threshold? Don't propose
  if (matchScore < MIN_AUTO_MATCH_SCORE) return null

  // Estimate total cargo size (1 unit per item as rough default)
  const totalSize = manifest.reduce((sum, m) => sum + m.quantity, 0)

  return {
    origin: supplyNode,
    destination: demandNode,
    manifest,
    totalSize,
    priority: highestUrgency,
    distanceMiles: Math.round(distance * 10) / 10,
    matchScore: Math.min(matchScore, 100),
    matchType: 'auto',
    requiresRefrigeration,
  }
}

// ---------------------------------------------------------------------------
// Fuzzy item name matching
// ---------------------------------------------------------------------------

/**
 * Loose match: checks if items refer to the same thing.
 * "canned soup" matches "Soup, Canned" etc.
 */
export function fuzzyItemMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).sort().join(' ')
  const na = normalize(a)
  const nb = normalize(b)
  // Exact normalized match
  if (na === nb) return true
  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true
  // Word overlap — if >50% of words match
  const wordsA = new Set(na.split(' '))
  const wordsB = new Set(nb.split(' '))
  const overlap = [...wordsA].filter((w) => wordsB.has(w)).length
  const minWords = Math.min(wordsA.size, wordsB.size)
  return minWords > 0 && overlap / minWords >= 0.5
}

// ---------------------------------------------------------------------------
// Geohash prefix matching (for spatial indexing queries)
// ---------------------------------------------------------------------------

/**
 * Check if two nodes share a geohash prefix of given length.
 * Prefix 5 ≈ ±2.4 km, prefix 4 ≈ ±20 km, prefix 3 ≈ ±78 km.
 */
export function geohashProximity(
  a: string | undefined,
  b: string | undefined,
  prefixLength = 4,
): boolean {
  if (prefixLength <= 0) return true // trivially: everything shares a 0-length prefix
  if (!a || !b || a.length < prefixLength || b.length < prefixLength) return false
  return a.slice(0, prefixLength) === b.slice(0, prefixLength)
}

// ---------------------------------------------------------------------------
// Shipment State Machine validation
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['matched', 'cancelled'],
  matched: ['dispatched', 'cancelled', 'pending'], // can unmatch
  dispatched: ['in_transit', 'failed', 'cancelled'],
  in_transit: ['delivered', 'failed'],
  delivered: [], // terminal
  cancelled: [], // terminal
  failed: ['pending'], // can retry
}

export function validateShipmentTransition(
  currentStatus: string,
  newStatus: string,
): { valid: boolean; reason?: string } {
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed) return { valid: false, reason: `Unknown status: ${currentStatus}` }
  if (allowed.includes(newStatus)) return { valid: true }
  return {
    valid: false,
    reason: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
  }
}

// ---------------------------------------------------------------------------
// Network-wide matching — scan all supply nodes against all demand nodes
// ---------------------------------------------------------------------------

/**
 * Scan the entire network for supply-demand matches.
 * Returns proposals sorted by score (highest first).
 *
 * Useful as a cron job or triggered after inventory updates.
 */
export function scanNetworkForMatches(
  supplyNodes: LogisticsNodeData[],
  demandNodes: LogisticsNodeData[],
  options?: { maxProposals?: number; minScore?: number },
): ShipmentProposal[] {
  const maxProposals = options?.maxProposals ?? 20
  const minScore = options?.minScore ?? MIN_AUTO_MATCH_SCORE
  const proposals: ShipmentProposal[] = []

  for (const supply of supplyNodes) {
    for (const demand of demandNodes) {
      // Don't match a node with itself
      if (supply.id === demand.id) continue

      const proposal = matchSupplyToDemand(supply, demand)
      if (proposal && proposal.matchScore >= minScore) {
        proposals.push(proposal)
      }
    }
  }

  // Sort by score descending, then by priority (SOS first)
  proposals.sort((a, b) => {
    const priorityOrder = { sos: 0, urgent: 1, standard: 2 }
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pDiff !== 0) return pDiff
    return b.matchScore - a.matchScore
  })

  return proposals.slice(0, maxProposals)
}
