/**
 * Order Routing Engine — Sprint 4
 *
 * Pure utility for matching orders to capable Holon nodes.
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * Scoring algorithm:
 * - Capability match: 40% (binary gate, then quality of fit)
 * - Proximity: 30% (closer = higher, must be within serviceRadius)
 * - Rating: 20% (community trust 0-5)
 * - Answer 53 fairness: 10% (bias toward underutilized nodes)
 *
 * @see tests/unit/utilities/orderRoutingEngine.test.ts — 91 tests
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HolonCapability {
  skill: string
  equipment?: string
  materials?: string[]
  maxVolume?: string
  turnaroundHours?: number
}

export interface HolonNode {
  id: number
  tenantId: number
  businessName?: string
  nodeType: string
  capabilities: HolonCapability[]
  serviceRadius: number
  location: { lat: number; lng: number; city?: string; region?: string }
  rating: number
  activeOrderCount: number
  acceptingOrders: boolean
  constitutionalCompliance: boolean
}

export interface OrderRequirement {
  skills: string[]
  materials?: string[]
  equipment?: string[]
  buyerLocation: { lat: number; lng: number }
  maxDistance?: number
}

export interface HolonMatch {
  holon: HolonNode
  distance: number
  capabilityScore: number
  proximityScore: number
  ratingScore: number
  fairnessScore: number
  totalScore: number
}

export type FulfillmentStatus =
  | 'pending_match'
  | 'matched'
  | 'accepted'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'rejected'
  | 'cancelled'

export type AngelTokenStatus = 'active' | 'redeemed' | 'refunded'

export interface FulfillmentEntry {
  orderItemIndex: number
  fulfillmentStatus: FulfillmentStatus
  angelTokenId?: string
  tokenStatus?: AngelTokenStatus
  queuedAt?: string
  queueReason?: string
  assignedHolon?: number
  sourceTenant?: number
  matchScore?: number
  matchedAt?: string
  selectedConfiguration?: Record<string, unknown>
}

export interface FulfillmentUpdate {
  status: FulfillmentStatus
  trackingNumber?: string
  trackingUrl?: string
  rejectionReason?: string
  estimatedCompletion?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEIGHT_CAPABILITY = 0.4
export const WEIGHT_PROXIMITY = 0.3
export const WEIGHT_RATING = 0.2
export const WEIGHT_FAIRNESS = 0.1

export const FULFILLMENT_STATES: FulfillmentStatus[] = [
  'pending_match',
  'matched',
  'accepted',
  'in_production',
  'shipped',
  'delivered',
  'rejected',
  'cancelled',
]

export const VALID_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending_match: ['matched', 'cancelled'],
  matched: ['accepted', 'rejected'],
  accepted: ['in_production', 'rejected'],
  in_production: ['shipped', 'rejected'],
  shipped: ['delivered'],
  delivered: [],
  rejected: ['pending_match'],
  cancelled: [], // Terminal — refund issued
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/** Haversine distance in miles between two lat/lng coordinates. */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Guard: NaN/Infinity coordinates → 0 (same-point fallback)
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) ||
      !Number.isFinite(lat2) || !Number.isFinite(lng2)) return 0
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const result = R * c
  return Number.isFinite(result) ? result : 0
}

// ---------------------------------------------------------------------------
// Capability Matching
// ---------------------------------------------------------------------------

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/\s+/g, '-')
}

/** Check if holon has all required skills. */
export function matchCapabilities(
  required: string[],
  holonCaps: HolonCapability[],
): boolean {
  const holonSkills = holonCaps.map((c) => normalizeSkill(c.skill))
  return required.every((req) => holonSkills.includes(normalizeSkill(req)))
}

/** Check if holon has all required materials across its capabilities. */
export function matchMaterials(
  required: string[] | undefined,
  holonCaps: HolonCapability[],
): boolean {
  if (!required || required.length === 0) return true
  const allMaterials = holonCaps.flatMap((c) =>
    (c.materials || []).map((m) => m.toLowerCase().trim()),
  )
  return required.every((req) => allMaterials.includes(req.toLowerCase().trim()))
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function calculateCapabilityScore(
  required: string[],
  holonCaps: HolonCapability[],
): number {
  if (!matchCapabilities(required, holonCaps)) return 0
  const holonSkills = holonCaps.map((c) => normalizeSkill(c.skill))
  const matchCount = required.filter((r) =>
    holonSkills.includes(normalizeSkill(r)),
  ).length
  return (matchCount / required.length) * 100
}

export function calculateProximityScore(
  distance: number,
  serviceRadius: number,
): number {
  if (serviceRadius === 0) return 80 // Digital node
  if (distance > serviceRadius) return 0
  return Math.max(0, (1 - distance / serviceRadius) * 100)
}

/**
 * Answer 53 fairness: bias toward underutilized nodes.
 * New vendor (0 orders) = 100. Busy vendor = lower, offset by rating.
 */
export function calculateFairnessScore(
  activeOrderCount: number,
  rating: number,
): number {
  const clampedOrders = Math.max(0, activeOrderCount || 0)
  const clampedRating = Math.max(0, Math.min(5, rating || 0))
  const utilizationPenalty = Math.min(clampedOrders * 2, 80)
  const ratingBonus = (clampedRating / 5) * 20
  return Math.max(0, Math.min(100, 100 - utilizationPenalty + ratingBonus))
}

export function calculateMatchScore(
  capabilityScore: number,
  proximityScore: number,
  ratingScore: number,
  fairnessScore: number,
): number {
  return (
    capabilityScore * WEIGHT_CAPABILITY +
    proximityScore * WEIGHT_PROXIMITY +
    ratingScore * WEIGHT_RATING +
    fairnessScore * WEIGHT_FAIRNESS
  )
}

// ---------------------------------------------------------------------------
// Main Matching Function
// ---------------------------------------------------------------------------

/**
 * Find and rank Holon nodes capable of fulfilling an order requirement.
 * Returns matches sorted by total score (descending).
 */
export function findMatchingHolons(
  requirement: OrderRequirement,
  holons: HolonNode[],
  options?: { maxResults?: number; minRating?: number },
): HolonMatch[] {
  const maxResults = options?.maxResults ?? 10
  const minRating = options?.minRating ?? 0

  const matches: HolonMatch[] = []

  for (const holon of holons) {
    if (!holon.acceptingOrders) continue
    if (!holon.constitutionalCompliance) continue
    if (holon.rating < minRating) continue
    if (!matchCapabilities(requirement.skills, holon.capabilities)) continue
    if (!matchMaterials(requirement.materials, holon.capabilities)) continue

    const distance = calculateDistance(
      requirement.buyerLocation.lat,
      requirement.buyerLocation.lng,
      holon.location.lat,
      holon.location.lng,
    )

    const maxDist = requirement.maxDistance ?? holon.serviceRadius
    if (holon.serviceRadius > 0 && distance > maxDist) continue

    const capabilityScore = calculateCapabilityScore(
      requirement.skills,
      holon.capabilities,
    )
    const proximityScore = calculateProximityScore(distance, holon.serviceRadius)
    const clampedRating = Math.max(0, Math.min(5, holon.rating || 0))
    const ratingScore = (clampedRating / 5) * 100
    const fairnessScore = calculateFairnessScore(
      holon.activeOrderCount,
      holon.rating,
    )
    const equipmentBonus = calculateEquipmentBonus(
      requirement.equipment,
      holon.capabilities,
    )

    const totalScore = calculateMatchScore(
      capabilityScore,
      proximityScore,
      ratingScore,
      fairnessScore,
    ) + equipmentBonus

    matches.push({
      holon,
      distance,
      capabilityScore,
      proximityScore,
      ratingScore,
      fairnessScore,
      totalScore,
    })
  }

  matches.sort((a, b) => b.totalScore - a.totalScore)
  return matches.slice(0, maxResults)
}

// ---------------------------------------------------------------------------
// Fulfillment State Machine
// ---------------------------------------------------------------------------

/** Check if a fulfillment status transition is valid. */
export function validateFulfillmentTransition(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/** Validate a fulfillment update has required fields for the target status. */
export function validateFulfillmentUpdate(update: FulfillmentUpdate): string | null {
  if (update.status === 'shipped') {
    if (!update.trackingNumber || !update.trackingNumber.trim()) {
      return 'Error: Tracking number is required when shipping.'
    }
  }

  if (update.status === 'rejected') {
    if (!update.rejectionReason || !update.rejectionReason.trim()) {
      return 'Error: Rejection reason is required.'
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Order Completeness
// ---------------------------------------------------------------------------

/** True when every item in the order has been delivered. */
export function isOrderFullyFulfilled(statuses: FulfillmentStatus[]): boolean {
  if (statuses.length === 0) return false
  return statuses.every((s) => s === 'delivered')
}

/** True when some items delivered but others still in progress. */
export function isOrderPartiallyFulfilled(statuses: FulfillmentStatus[]): boolean {
  if (statuses.length === 0) return false
  const hasDelivered = statuses.some((s) => s === 'delivered')
  const hasNonDelivered = statuses.some((s) => s !== 'delivered')
  return hasDelivered && hasNonDelivered
}

// ---------------------------------------------------------------------------
// Vendor Share
// ---------------------------------------------------------------------------

/** Calculate vendor's share of order amount (default 60% per Ultimate Fair). */
export function calculateVendorShare(
  orderAmount: number,
  providerPercent: number = 60,
): number {
  return Math.round(((orderAmount * providerPercent) / 100) * 100) / 100
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format a match result for display in LEO responses. */
export function serializeMatch(match: HolonMatch): string {
  const parts = [
    match.holon.businessName || `Holon #${match.holon.id}`,
    `${match.distance.toFixed(1)} mi`,
    `Score: ${match.totalScore.toFixed(0)}`,
    `Rating: ${match.holon.rating}/5`,
  ]
  return parts.join(' | ')
}

// ---------------------------------------------------------------------------
// Angel Token Queue Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a fulfillment entry represents a queued Angel Token.
 * Queued = pending_match + has a queuedAt timestamp.
 */
export function isQueuedAngelToken(entry: FulfillmentEntry): boolean {
  return (
    entry.fulfillmentStatus === 'pending_match' &&
    entry.tokenStatus === 'active' &&
    Boolean(entry.queuedAt)
  )
}

/**
 * Calculate queue position for an item based on queuedAt ordering.
 * Position 1 = longest-waiting (first in, first served).
 */
export function getQueuePosition(
  queuedAt: string,
  allQueuedEntries: FulfillmentEntry[],
): number {
  const sorted = allQueuedEntries
    .filter(isQueuedAngelToken)
    .sort((a, b) => (a.queuedAt || '').localeCompare(b.queuedAt || ''))

  const idx = sorted.findIndex((e) => e.queuedAt === queuedAt)
  return idx >= 0 ? idx + 1 : sorted.length + 1
}

/**
 * Calculate equipment match bonus score.
 * If the order requires specific equipment and the holon has it, +15 bonus.
 * This is a bonus on top of capability score, not a gate.
 */
export function calculateEquipmentBonus(
  requiredEquipment: string[] | undefined,
  holonCaps: HolonCapability[],
): number {
  if (!requiredEquipment || requiredEquipment.length === 0) return 0

  const holonEquipment = holonCaps
    .map((c) => (c.equipment || '').toLowerCase().trim())
    .filter(Boolean)

  if (holonEquipment.length === 0) return 0

  const matched = requiredEquipment.filter((req) =>
    holonEquipment.some((eq) => eq.includes(req.toLowerCase().trim())),
  )

  return matched.length > 0 ? 15 : 0 // +15 bonus for equipment match
}
