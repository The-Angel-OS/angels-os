/**
 * Unit tests for Order Routing Engine — Sprint 4.
 *
 * Tests the matching algorithm, distance calculation, capability matching,
 * fulfillment state machine, and cross-tenant routing for the constitutional
 * manufacturing network.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/orderRoutingEngine.ts — routing engine
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HolonCapability {
  skill: string
  equipment?: string
  materials?: string[]
  maxVolume?: string
  turnaroundHours?: number
}

interface HolonNode {
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

interface OrderRequirement {
  skills: string[]
  materials?: string[]
  buyerLocation: { lat: number; lng: number }
  maxDistance?: number
}

interface HolonMatch {
  holon: HolonNode
  distance: number
  capabilityScore: number
  proximityScore: number
  ratingScore: number
  fairnessScore: number
  totalScore: number
}

type FulfillmentStatus =
  | 'pending_match'
  | 'matched'
  | 'accepted'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'rejected'

// ---------------------------------------------------------------------------
// Re-implement pure routing logic (mirrors orderRoutingEngine.ts)
// ---------------------------------------------------------------------------

// ─── Distance ────────────────────────────────────────────────────

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
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
  return R * c
}

// ─── Capability Matching ─────────────────────────────────────────

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/\s+/g, '-')
}

function matchCapabilities(
  required: string[],
  holonCaps: HolonCapability[],
): boolean {
  const holonSkills = holonCaps.map((c) => normalizeSkill(c.skill))
  return required.every((req) => holonSkills.includes(normalizeSkill(req)))
}

function matchMaterials(
  required: string[] | undefined,
  holonCaps: HolonCapability[],
): boolean {
  if (!required || required.length === 0) return true
  const allMaterials = holonCaps.flatMap((c) =>
    (c.materials || []).map((m) => m.toLowerCase().trim()),
  )
  return required.every((req) => allMaterials.includes(req.toLowerCase().trim()))
}

// ─── Scoring ─────────────────────────────────────────────────────

const WEIGHT_CAPABILITY = 0.4
const WEIGHT_PROXIMITY = 0.3
const WEIGHT_RATING = 0.2
const WEIGHT_FAIRNESS = 0.1

function calculateCapabilityScore(
  required: string[],
  holonCaps: HolonCapability[],
): number {
  if (!matchCapabilities(required, holonCaps)) return 0
  // Bonus for having more matching skills beyond required
  const holonSkills = holonCaps.map((c) => normalizeSkill(c.skill))
  const matchCount = required.filter((r) =>
    holonSkills.includes(normalizeSkill(r)),
  ).length
  return (matchCount / required.length) * 100
}

function calculateProximityScore(
  distance: number,
  serviceRadius: number,
): number {
  if (serviceRadius === 0) return 80 // Digital node — always decent proximity
  if (distance > serviceRadius) return 0
  // Linear decay: closer = higher score
  return Math.max(0, (1 - distance / serviceRadius) * 100)
}

function calculateFairnessScore(
  activeOrderCount: number,
  rating: number,
): number {
  // Answer 53: bias toward underutilized nodes
  // New vendor (0 orders) = 100 fairness
  // Busy vendor (many orders) = lower fairness, offset by high rating
  const utilizationPenalty = Math.min(activeOrderCount * 2, 80)
  const ratingBonus = (rating / 5) * 20
  return Math.max(0, Math.min(100, 100 - utilizationPenalty + ratingBonus))
}

function calculateMatchScore(
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

// ─── Main Matching Function ──────────────────────────────────────

function findMatchingHolons(
  requirement: OrderRequirement,
  holons: HolonNode[],
  options?: { maxResults?: number; minRating?: number },
): HolonMatch[] {
  const maxResults = options?.maxResults ?? 10
  const minRating = options?.minRating ?? 0

  const matches: HolonMatch[] = []

  for (const holon of holons) {
    // Gate: must be accepting orders
    if (!holon.acceptingOrders) continue

    // Gate: constitutional compliance required
    if (!holon.constitutionalCompliance) continue

    // Gate: minimum rating
    if (holon.rating < minRating) continue

    // Gate: capability match
    if (!matchCapabilities(requirement.skills, holon.capabilities)) continue

    // Gate: material match (if specified)
    if (!matchMaterials(requirement.materials, holon.capabilities)) continue

    // Calculate distance
    const distance = calculateDistance(
      requirement.buyerLocation.lat,
      requirement.buyerLocation.lng,
      holon.location.lat,
      holon.location.lng,
    )

    // Gate: within service radius (0 = digital, no limit)
    const maxDist = requirement.maxDistance ?? holon.serviceRadius
    if (holon.serviceRadius > 0 && distance > maxDist) continue

    // Score
    const capabilityScore = calculateCapabilityScore(
      requirement.skills,
      holon.capabilities,
    )
    const proximityScore = calculateProximityScore(distance, holon.serviceRadius)
    const ratingScore = (holon.rating / 5) * 100
    const fairnessScore = calculateFairnessScore(
      holon.activeOrderCount,
      holon.rating,
    )
    const totalScore = calculateMatchScore(
      capabilityScore,
      proximityScore,
      ratingScore,
      fairnessScore,
    )

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

  // Sort by total score descending
  matches.sort((a, b) => b.totalScore - a.totalScore)

  return matches.slice(0, maxResults)
}

// ─── Fulfillment State Machine ───────────────────────────────────

const VALID_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending_match: ['matched'],
  matched: ['accepted', 'rejected'],
  accepted: ['in_production', 'rejected'],
  in_production: ['shipped', 'rejected'],
  shipped: ['delivered'],
  delivered: [],
  rejected: ['pending_match'], // Can re-route after rejection
}

function validateFulfillmentTransition(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

interface FulfillmentUpdate {
  status: FulfillmentStatus
  trackingNumber?: string
  trackingUrl?: string
  rejectionReason?: string
  estimatedCompletion?: string
}

function validateFulfillmentUpdate(update: FulfillmentUpdate): string | null {
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

// ─── Order Completeness ──────────────────────────────────────────

function isOrderFullyFulfilled(statuses: FulfillmentStatus[]): boolean {
  if (statuses.length === 0) return false
  return statuses.every((s) => s === 'delivered')
}

function isOrderPartiallyFulfilled(statuses: FulfillmentStatus[]): boolean {
  if (statuses.length === 0) return false
  const hasDelivered = statuses.some((s) => s === 'delivered')
  const hasNonDelivered = statuses.some((s) => s !== 'delivered')
  return hasDelivered && hasNonDelivered
}

// ─── Vendor Share Calculation ────────────────────────────────────

function calculateVendorShare(
  orderAmount: number,
  providerPercent: number = 60,
): number {
  return Math.round((orderAmount * providerPercent) / 100 * 100) / 100
}

// ─── Result Serialization ────────────────────────────────────────

function serializeMatch(match: HolonMatch): string {
  const parts = [
    match.holon.businessName || `Holon #${match.holon.id}`,
    `${match.distance.toFixed(1)} mi`,
    `Score: ${match.totalScore.toFixed(0)}`,
    `Rating: ${match.holon.rating}/5`,
  ]
  return parts.join(' | ')
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

// ─── Test Data ───────────────────────────────────────────────────

const CLEARWATER = { lat: 27.9659, lng: -82.8001 }
const TAMPA = { lat: 27.9506, lng: -82.4572 }
const LARGO = { lat: 27.9095, lng: -82.7873 }
const ORLANDO = { lat: 28.5383, lng: -81.3792 }
const MIAMI = { lat: 25.7617, lng: -80.1918 }
const NEW_YORK = { lat: 40.7128, lng: -74.006 }

function makeHolon(overrides: Partial<HolonNode> = {}): HolonNode {
  return {
    id: 1,
    tenantId: 1,
    businessName: 'Test Holon',
    nodeType: 'print',
    capabilities: [{ skill: 'screen-printing', materials: ['cotton', 'polyester'] }],
    serviceRadius: 100,
    location: { ...LARGO, city: 'Largo', region: 'FL' },
    rating: 4,
    activeOrderCount: 5,
    acceptingOrders: true,
    constitutionalCompliance: true,
    ...overrides,
  }
}

// ─── Distance Calculation ────────────────────────────────────────

describe('Order Routing Engine', () => {
  describe('Distance calculation', () => {
    it('returns 0 for same coordinates', () => {
      expect(calculateDistance(27.96, -82.80, 27.96, -82.80)).toBeCloseTo(0, 1)
    })

    it('calculates Clearwater to Tampa (~22 miles)', () => {
      const d = calculateDistance(CLEARWATER.lat, CLEARWATER.lng, TAMPA.lat, TAMPA.lng)
      expect(d).toBeGreaterThan(15)
      expect(d).toBeLessThan(30)
    })

    it('calculates Largo to Clearwater (~5 miles)', () => {
      const d = calculateDistance(LARGO.lat, LARGO.lng, CLEARWATER.lat, CLEARWATER.lng)
      expect(d).toBeGreaterThan(2)
      expect(d).toBeLessThan(10)
    })

    it('calculates Clearwater to Orlando (~100 miles)', () => {
      const d = calculateDistance(CLEARWATER.lat, CLEARWATER.lng, ORLANDO.lat, ORLANDO.lng)
      expect(d).toBeGreaterThan(80)
      expect(d).toBeLessThan(120)
    })

    it('handles cross-country distances (Clearwater to NYC)', () => {
      const d = calculateDistance(CLEARWATER.lat, CLEARWATER.lng, NEW_YORK.lat, NEW_YORK.lng)
      expect(d).toBeGreaterThan(900)
      expect(d).toBeLessThan(1200)
    })
  })

  // ─── Capability Matching ─────────────────────────────────────

  describe('Capability matching', () => {
    it('matches exact skill', () => {
      const caps: HolonCapability[] = [{ skill: 'screen-printing' }]
      expect(matchCapabilities(['screen-printing'], caps)).toBe(true)
    })

    it('matches case-insensitive', () => {
      const caps: HolonCapability[] = [{ skill: 'Screen-Printing' }]
      expect(matchCapabilities(['screen-printing'], caps)).toBe(true)
    })

    it('normalizes whitespace to hyphens', () => {
      const caps: HolonCapability[] = [{ skill: 'screen printing' }]
      expect(matchCapabilities(['screen-printing'], caps)).toBe(true)
    })

    it('matches multiple required skills', () => {
      const caps: HolonCapability[] = [
        { skill: 'screen-printing' },
        { skill: 'embroidery' },
      ]
      expect(matchCapabilities(['screen-printing', 'embroidery'], caps)).toBe(true)
    })

    it('fails when missing a required skill', () => {
      const caps: HolonCapability[] = [{ skill: 'screen-printing' }]
      expect(matchCapabilities(['screen-printing', 'embroidery'], caps)).toBe(false)
    })

    it('fails on empty capabilities', () => {
      expect(matchCapabilities(['screen-printing'], [])).toBe(false)
    })

    it('succeeds when holon has extra skills beyond required', () => {
      const caps: HolonCapability[] = [
        { skill: 'screen-printing' },
        { skill: 'embroidery' },
        { skill: 'heat-press' },
      ]
      expect(matchCapabilities(['screen-printing'], caps)).toBe(true)
    })

    it('handles empty required skills (matches any holon)', () => {
      const caps: HolonCapability[] = [{ skill: 'screen-printing' }]
      expect(matchCapabilities([], caps)).toBe(true)
    })
  })

  // ─── Material Matching ───────────────────────────────────────

  describe('Material matching', () => {
    it('matches when materials available', () => {
      const caps: HolonCapability[] = [
        { skill: 'printing', materials: ['cotton', 'polyester'] },
      ]
      expect(matchMaterials(['cotton'], caps)).toBe(true)
    })

    it('matches multiple required materials', () => {
      const caps: HolonCapability[] = [
        { skill: 'printing', materials: ['cotton', 'polyester', 'nylon'] },
      ]
      expect(matchMaterials(['cotton', 'polyester'], caps)).toBe(true)
    })

    it('fails when material unavailable', () => {
      const caps: HolonCapability[] = [
        { skill: 'printing', materials: ['cotton'] },
      ]
      expect(matchMaterials(['silk'], caps)).toBe(false)
    })

    it('matches case-insensitive', () => {
      const caps: HolonCapability[] = [
        { skill: 'printing', materials: ['Cotton'] },
      ]
      expect(matchMaterials(['cotton'], caps)).toBe(true)
    })

    it('passes when no materials required', () => {
      const caps: HolonCapability[] = [{ skill: 'printing' }]
      expect(matchMaterials(undefined, caps)).toBe(true)
    })

    it('aggregates materials across multiple capabilities', () => {
      const caps: HolonCapability[] = [
        { skill: 'screen-printing', materials: ['cotton'] },
        { skill: 'heat-press', materials: ['polyester'] },
      ]
      expect(matchMaterials(['cotton', 'polyester'], caps)).toBe(true)
    })
  })

  // ─── Scoring ─────────────────────────────────────────────────

  describe('Match scoring', () => {
    it('weights sum to 1.0', () => {
      expect(
        WEIGHT_CAPABILITY + WEIGHT_PROXIMITY + WEIGHT_RATING + WEIGHT_FAIRNESS,
      ).toBeCloseTo(1.0)
    })

    it('perfect score is 100', () => {
      const score = calculateMatchScore(100, 100, 100, 100)
      expect(score).toBeCloseTo(100)
    })

    it('zero capability score zeroes the capability component', () => {
      const withCap = calculateMatchScore(100, 50, 50, 50)
      const noCap = calculateMatchScore(0, 50, 50, 50)
      expect(noCap).toBeLessThan(withCap)
      expect(noCap).toBeCloseTo(50 * 0.3 + 50 * 0.2 + 50 * 0.1)
    })

    it('capability has highest weight (40%)', () => {
      // Only capability score = 100, rest = 0
      expect(calculateMatchScore(100, 0, 0, 0)).toBeCloseTo(40)
    })

    it('proximity has second highest weight (30%)', () => {
      expect(calculateMatchScore(0, 100, 0, 0)).toBeCloseTo(30)
    })

    it('rating has third weight (20%)', () => {
      expect(calculateMatchScore(0, 0, 100, 0)).toBeCloseTo(20)
    })

    it('fairness has lowest weight (10%)', () => {
      expect(calculateMatchScore(0, 0, 0, 100)).toBeCloseTo(10)
    })
  })

  // ─── Proximity Scoring ───────────────────────────────────────

  describe('Proximity scoring', () => {
    it('returns 100 at zero distance', () => {
      expect(calculateProximityScore(0, 100)).toBeCloseTo(100)
    })

    it('returns 0 at service radius boundary', () => {
      expect(calculateProximityScore(100, 100)).toBeCloseTo(0)
    })

    it('returns 0 beyond service radius', () => {
      expect(calculateProximityScore(150, 100)).toBe(0)
    })

    it('linear decay: half distance = 50', () => {
      expect(calculateProximityScore(50, 100)).toBeCloseTo(50)
    })

    it('digital nodes (radius=0) get 80', () => {
      expect(calculateProximityScore(1000, 0)).toBe(80)
    })
  })

  // ─── Fairness Scoring (Answer 53) ────────────────────────────

  describe('Fairness scoring (Answer 53)', () => {
    it('new vendor (0 orders) scores 100', () => {
      expect(calculateFairnessScore(0, 0)).toBe(100)
    })

    it('busy vendor scores lower', () => {
      const newScore = calculateFairnessScore(0, 3)
      const busyScore = calculateFairnessScore(20, 3)
      expect(busyScore).toBeLessThan(newScore)
    })

    it('high rating partially offsets busy penalty', () => {
      const lowRating = calculateFairnessScore(20, 1)
      const highRating = calculateFairnessScore(20, 5)
      expect(highRating).toBeGreaterThan(lowRating)
    })

    it('extremely busy vendor has low fairness', () => {
      const score = calculateFairnessScore(50, 3)
      expect(score).toBeLessThan(40)
    })

    it('score is clamped between 0 and 100', () => {
      expect(calculateFairnessScore(0, 5)).toBeLessThanOrEqual(100)
      expect(calculateFairnessScore(100, 0)).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── findMatchingHolons (Integration) ────────────────────────

  describe('findMatchingHolons', () => {
    const hitPromo = makeHolon({
      id: 1,
      tenantId: 10,
      businessName: 'HIT Promotional Products',
      nodeType: 'print',
      capabilities: [
        { skill: 'screen-printing', materials: ['cotton', 'polyester'], turnaroundHours: 72 },
        { skill: 'embroidery', materials: ['cotton'], turnaroundHours: 96 },
      ],
      location: { ...LARGO, city: 'Largo', region: 'FL' },
      serviceRadius: 100,
      rating: 4.5,
      activeOrderCount: 10,
    })

    const tampaShirts = makeHolon({
      id: 2,
      tenantId: 20,
      businessName: 'Tampa T-Shirts',
      capabilities: [
        { skill: 'screen-printing', materials: ['cotton'], turnaroundHours: 48 },
      ],
      location: { ...TAMPA, city: 'Tampa', region: 'FL' },
      serviceRadius: 50,
      rating: 3.8,
      activeOrderCount: 3,
    })

    const orlandoPrint = makeHolon({
      id: 3,
      tenantId: 30,
      businessName: 'Orlando Print Co',
      capabilities: [
        { skill: 'screen-printing', materials: ['cotton', 'silk'], turnaroundHours: 24 },
      ],
      location: { ...ORLANDO, city: 'Orlando', region: 'FL' },
      serviceRadius: 100,
      rating: 4.2,
      activeOrderCount: 0,
    })

    const digitalDesigner = makeHolon({
      id: 4,
      tenantId: 40,
      businessName: 'Pixel Perfect Design',
      nodeType: 'digital',
      capabilities: [{ skill: 'graphic-design' }],
      location: { ...NEW_YORK, city: 'New York', region: 'NY' },
      serviceRadius: 0, // Digital — no radius limit
      rating: 4.8,
      activeOrderCount: 2,
    })

    const nonCompliant = makeHolon({
      id: 5,
      tenantId: 50,
      businessName: 'Shady Prints',
      capabilities: [{ skill: 'screen-printing' }],
      location: { ...CLEARWATER, city: 'Clearwater', region: 'FL' },
      constitutionalCompliance: false,
    })

    const pausedVendor = makeHolon({
      id: 6,
      tenantId: 60,
      businessName: 'On Vacation Prints',
      capabilities: [{ skill: 'screen-printing' }],
      location: { ...CLEARWATER, city: 'Clearwater', region: 'FL' },
      acceptingOrders: false,
    })

    const allHolons = [hitPromo, tampaShirts, orlandoPrint, digitalDesigner, nonCompliant, pausedVendor]

    it('finds matching holons by skill', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      expect(matches.length).toBeGreaterThanOrEqual(2) // HIT + Tampa at minimum
      expect(matches.every((m) => m.capabilityScore > 0)).toBe(true)
    })

    it('filters out non-compliant holons', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      expect(matches.find((m) => m.holon.id === 5)).toBeUndefined()
    })

    it('filters out paused vendors', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      expect(matches.find((m) => m.holon.id === 6)).toBeUndefined()
    })

    it('ranks closer holons higher (same capability)', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, [hitPromo, orlandoPrint])
      // HIT in Largo (~5mi from Clearwater) should rank higher than Orlando (~100mi)
      expect(matches[0].holon.businessName).toBe('HIT Promotional Products')
    })

    it('filters by material requirements', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        materials: ['silk'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      // Only Orlando has silk
      const hasSilk = matches.find((m) => m.holon.businessName === 'Orlando Print Co')
      const noSilk = matches.find((m) => m.holon.businessName === 'HIT Promotional Products')
      expect(hasSilk).toBeDefined()
      expect(noSilk).toBeUndefined()
    })

    it('respects maxResults limit', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons, { maxResults: 1 })
      expect(matches).toHaveLength(1)
    })

    it('returns empty array when no matches', () => {
      const req: OrderRequirement = {
        skills: ['laser-cutting'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      expect(matches).toHaveLength(0)
    })

    it('includes digital nodes regardless of distance', () => {
      const req: OrderRequirement = {
        skills: ['graphic-design'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      expect(matches).toHaveLength(1)
      expect(matches[0].holon.businessName).toBe('Pixel Perfect Design')
    })

    it('filters by service radius', () => {
      // Tampa T-Shirts has 50mi radius; Miami is ~280mi from Tampa
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: MIAMI,
      }
      const matches = findMatchingHolons(req, [tampaShirts])
      expect(matches).toHaveLength(0)
    })

    it('respects minRating filter', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons, { minRating: 4 })
      expect(matches.every((m) => m.holon.rating >= 4)).toBe(true)
    })

    it('Answer 53: new vendor with 0 orders gets fairness boost', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: ORLANDO, // At Orlando's location so distance is equal
      }
      // Orlando has 0 orders, HIT has 10
      const matches = findMatchingHolons(req, [hitPromo, orlandoPrint])
      const orlandoMatch = matches.find((m) => m.holon.id === 3)
      const hitMatch = matches.find((m) => m.holon.id === 1)
      expect(orlandoMatch!.fairnessScore).toBeGreaterThan(hitMatch!.fairnessScore)
    })

    it('results are sorted by totalScore descending', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].totalScore).toBeGreaterThanOrEqual(matches[i].totalScore)
      }
    })

    it('includes distance in match results', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      const matches = findMatchingHolons(req, allHolons)
      for (const m of matches) {
        expect(typeof m.distance).toBe('number')
        expect(m.distance).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ─── Fulfillment State Machine ───────────────────────────────

  describe('Fulfillment state machine', () => {
    it('allows pending_match → matched', () => {
      expect(validateFulfillmentTransition('pending_match', 'matched')).toBe(true)
    })

    it('allows matched → accepted', () => {
      expect(validateFulfillmentTransition('matched', 'accepted')).toBe(true)
    })

    it('allows matched → rejected', () => {
      expect(validateFulfillmentTransition('matched', 'rejected')).toBe(true)
    })

    it('allows accepted → in_production', () => {
      expect(validateFulfillmentTransition('accepted', 'in_production')).toBe(true)
    })

    it('allows accepted → rejected', () => {
      expect(validateFulfillmentTransition('accepted', 'rejected')).toBe(true)
    })

    it('allows in_production → shipped', () => {
      expect(validateFulfillmentTransition('in_production', 'shipped')).toBe(true)
    })

    it('allows in_production → rejected', () => {
      expect(validateFulfillmentTransition('in_production', 'rejected')).toBe(true)
    })

    it('allows shipped → delivered', () => {
      expect(validateFulfillmentTransition('shipped', 'delivered')).toBe(true)
    })

    it('allows rejected → pending_match (re-routing)', () => {
      expect(validateFulfillmentTransition('rejected', 'pending_match')).toBe(true)
    })

    it('blocks pending_match → shipped (skip states)', () => {
      expect(validateFulfillmentTransition('pending_match', 'shipped')).toBe(false)
    })

    it('blocks matched → shipped (skip states)', () => {
      expect(validateFulfillmentTransition('matched', 'shipped')).toBe(false)
    })

    it('blocks matched → in_production (must accept first)', () => {
      expect(validateFulfillmentTransition('matched', 'in_production')).toBe(false)
    })

    it('blocks delivered → anything (terminal state)', () => {
      expect(validateFulfillmentTransition('delivered', 'pending_match')).toBe(false)
      expect(validateFulfillmentTransition('delivered', 'rejected')).toBe(false)
      expect(validateFulfillmentTransition('delivered', 'shipped')).toBe(false)
    })

    it('blocks shipped → rejected (already shipped)', () => {
      expect(validateFulfillmentTransition('shipped', 'rejected')).toBe(false)
    })

    it('blocks pending_match → accepted (must match first)', () => {
      expect(validateFulfillmentTransition('pending_match', 'accepted')).toBe(false)
    })
  })

  // ─── Fulfillment Update Validation ───────────────────────────

  describe('Fulfillment update validation', () => {
    it('requires tracking number for shipped status', () => {
      const err = validateFulfillmentUpdate({ status: 'shipped' })
      expect(err).toContain('Tracking number is required')
    })

    it('accepts shipped with tracking number', () => {
      const err = validateFulfillmentUpdate({
        status: 'shipped',
        trackingNumber: '1Z999AA10123456784',
      })
      expect(err).toBeNull()
    })

    it('requires rejection reason for rejected status', () => {
      const err = validateFulfillmentUpdate({ status: 'rejected' })
      expect(err).toContain('Rejection reason is required')
    })

    it('accepts rejected with reason', () => {
      const err = validateFulfillmentUpdate({
        status: 'rejected',
        rejectionReason: 'Out of materials',
      })
      expect(err).toBeNull()
    })

    it('accepts in_production with no extra fields', () => {
      const err = validateFulfillmentUpdate({ status: 'in_production' })
      expect(err).toBeNull()
    })

    it('accepts delivered with no extra fields', () => {
      const err = validateFulfillmentUpdate({ status: 'delivered' })
      expect(err).toBeNull()
    })

    it('rejects whitespace-only tracking number', () => {
      const err = validateFulfillmentUpdate({
        status: 'shipped',
        trackingNumber: '   ',
      })
      expect(err).toContain('Tracking number is required')
    })

    it('rejects whitespace-only rejection reason', () => {
      const err = validateFulfillmentUpdate({
        status: 'rejected',
        rejectionReason: '   ',
      })
      expect(err).toContain('Rejection reason is required')
    })
  })

  // ─── Multi-Item Order Completeness ───────────────────────────

  describe('Multi-item order completeness', () => {
    it('fully fulfilled when all items delivered', () => {
      expect(isOrderFullyFulfilled(['delivered', 'delivered', 'delivered'])).toBe(true)
    })

    it('not fully fulfilled when some items pending', () => {
      expect(isOrderFullyFulfilled(['delivered', 'in_production', 'shipped'])).toBe(false)
    })

    it('partially fulfilled when mix of delivered and other', () => {
      expect(isOrderPartiallyFulfilled(['delivered', 'in_production'])).toBe(true)
    })

    it('not partially fulfilled when all delivered', () => {
      expect(isOrderPartiallyFulfilled(['delivered', 'delivered'])).toBe(false)
    })

    it('not partially fulfilled when none delivered', () => {
      expect(isOrderPartiallyFulfilled(['in_production', 'matched'])).toBe(false)
    })

    it('handles empty status array', () => {
      expect(isOrderFullyFulfilled([])).toBe(false)
      expect(isOrderPartiallyFulfilled([])).toBe(false)
    })

    it('handles single-item order', () => {
      expect(isOrderFullyFulfilled(['delivered'])).toBe(true)
      expect(isOrderPartiallyFulfilled(['delivered'])).toBe(false)
    })
  })

  // ─── Vendor Share Calculation ────────────────────────────────

  describe('Vendor share calculation (Ultimate Fair)', () => {
    it('calculates 60% default share', () => {
      expect(calculateVendorShare(100)).toBe(60)
    })

    it('handles cents correctly', () => {
      expect(calculateVendorShare(99.99)).toBe(59.99)
    })

    it('rounds to 2 decimal places', () => {
      expect(calculateVendorShare(33.33)).toBe(20)
    })

    it('supports custom provider percentage', () => {
      expect(calculateVendorShare(100, 70)).toBe(70)
    })

    it('handles large amounts', () => {
      expect(calculateVendorShare(10000)).toBe(6000)
    })

    it('handles small amounts', () => {
      expect(calculateVendorShare(1.00)).toBe(0.60)
    })
  })

  // ─── Result Serialization ────────────────────────────────────

  describe('Match serialization', () => {
    it('formats match for display', () => {
      const match: HolonMatch = {
        holon: makeHolon({ businessName: 'HIT Promotional Products', rating: 4.5 }),
        distance: 5.2,
        capabilityScore: 100,
        proximityScore: 95,
        ratingScore: 90,
        fairnessScore: 70,
        totalScore: 91.5,
      }
      const s = serializeMatch(match)
      expect(s).toContain('HIT Promotional Products')
      expect(s).toContain('5.2 mi')
      expect(s).toContain('Score: 92') // rounded
      expect(s).toContain('Rating: 4.5/5')
    })

    it('uses Holon ID when no business name', () => {
      const match: HolonMatch = {
        holon: makeHolon({ id: 42, businessName: undefined }),
        distance: 10,
        capabilityScore: 80,
        proximityScore: 70,
        ratingScore: 60,
        fairnessScore: 50,
        totalScore: 70,
      }
      const s = serializeMatch(match)
      expect(s).toContain('Holon #42')
    })
  })

  // ─── Edge Cases ──────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles no holons registered', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      expect(findMatchingHolons(req, [])).toHaveLength(0)
    })

    it('handles all holons out of range', () => {
      const farHolon = makeHolon({
        location: { ...NEW_YORK, city: 'New York', region: 'NY' },
        serviceRadius: 50,
      })
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
      }
      expect(findMatchingHolons(req, [farHolon])).toHaveLength(0)
    })

    it('handles maxDistance override on requirement', () => {
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: CLEARWATER,
        maxDistance: 10, // Only 10 miles
      }
      const farButCapable = makeHolon({
        location: { ...TAMPA, city: 'Tampa', region: 'FL' },
        serviceRadius: 100, // Would normally be in range
      })
      // Tampa is ~22mi from Clearwater, but maxDistance is 10
      expect(findMatchingHolons(req, [farButCapable])).toHaveLength(0)
    })

    it('tie-breaks by total score (higher score wins)', () => {
      const holon1 = makeHolon({ id: 1, rating: 5, activeOrderCount: 0 })
      const holon2 = makeHolon({ id: 2, rating: 3, activeOrderCount: 10 })
      const req: OrderRequirement = {
        skills: ['screen-printing'],
        buyerLocation: LARGO,
      }
      const matches = findMatchingHolons(req, [holon2, holon1]) // Reversed input order
      expect(matches[0].holon.id).toBe(1) // Higher rated, fewer orders
    })
  })
})
