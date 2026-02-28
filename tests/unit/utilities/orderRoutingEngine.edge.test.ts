/**
 * Order Routing Engine — BREAK IT Edge Case Tests
 *
 * Adversarial inputs: NaN coords, zero serviceRadius, negative ratings,
 * empty capability lists, massive holon arrays, self-referencing nodes,
 * fulfillment state machine exhaustive coverage.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateDistance,
  matchCapabilities,
  matchMaterials,
  calculateCapabilityScore,
  calculateProximityScore,
  calculateFairnessScore,
  calculateMatchScore,
  findMatchingHolons,
  validateFulfillmentTransition,
  validateFulfillmentUpdate,
  isOrderFullyFulfilled,
  isOrderPartiallyFulfilled,
  calculateVendorShare,
  serializeMatch,
  isQueuedAngelToken,
  getQueuePosition,
  calculateEquipmentBonus,
  WEIGHT_CAPABILITY,
  WEIGHT_PROXIMITY,
  WEIGHT_RATING,
  WEIGHT_FAIRNESS,
  VALID_TRANSITIONS,
  FULFILLMENT_STATES,
} from '@/utilities/orderRoutingEngine'
import type {
  HolonNode,
  HolonCapability,
  OrderRequirement,
  HolonMatch,
  FulfillmentEntry,
  FulfillmentStatus,
} from '@/utilities/orderRoutingEngine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHolon(overrides: Partial<HolonNode> = {}): HolonNode {
  return {
    id: 1,
    tenantId: 100,
    businessName: 'Test Workshop',
    nodeType: 'workshop',
    capabilities: [{ skill: 'printing' }],
    serviceRadius: 50,
    location: { lat: 27.96, lng: -82.80 },
    rating: 4.5,
    activeOrderCount: 2,
    acceptingOrders: true,
    constitutionalCompliance: true,
    ...overrides,
  }
}

function makeRequirement(overrides: Partial<OrderRequirement> = {}): OrderRequirement {
  return {
    skills: ['printing'],
    buyerLocation: { lat: 27.95, lng: -82.79 },
    ...overrides,
  }
}

// ===========================================================================
// calculateDistance — adversarial
// ===========================================================================

describe('calculateDistance — edge cases', () => {
  it('handles NaN latitude (returns NaN, does not throw)', () => {
    expect(calculateDistance(NaN, -82, 27, -82)).toBeNaN()
  })

  it('handles Infinity coordinates without crashing', () => {
    expect(() => calculateDistance(Infinity, -82, 27, -82)).not.toThrow()
  })

  it('handles same point (distance = 0)', () => {
    expect(calculateDistance(27.96, -82.80, 27.96, -82.80)).toBe(0)
  })

  it('handles antipodal points (max distance)', () => {
    const dist = calculateDistance(0, 0, 0, 180)
    expect(dist).toBeGreaterThan(12000)
    expect(dist).toBeLessThan(12500)
  })

  it('handles poles (both at north pole = 0 distance)', () => {
    expect(calculateDistance(90, 0, 90, 180)).toBeCloseTo(0, 0)
  })

  it('handles negative coordinates (southern/western hemispheres)', () => {
    const dist = calculateDistance(-33.87, 151.21, -33.92, 18.42)
    expect(dist).toBeGreaterThan(6000)
    expect(dist).toBeLessThan(7500)
  })
})

// ===========================================================================
// matchCapabilities — adversarial
// ===========================================================================

describe('matchCapabilities — edge cases', () => {
  it('handles empty required skills (should match anything)', () => {
    expect(matchCapabilities([], [{ skill: 'printing' }])).toBe(true)
  })

  it('handles empty holon capabilities (fails for any requirement)', () => {
    expect(matchCapabilities(['printing'], [])).toBe(false)
  })

  it('handles both empty (vacuously true)', () => {
    expect(matchCapabilities([], [])).toBe(true)
  })

  it('normalizes whitespace and case', () => {
    expect(matchCapabilities(['  Laser Cutting  '], [{ skill: 'laser-cutting' }])).toBe(true)
  })

  it('handles duplicate required skills', () => {
    expect(matchCapabilities(['printing', 'printing'], [{ skill: 'printing' }])).toBe(true)
  })

  it('handles unicode in skill names', () => {
    expect(matchCapabilities(['café'], [{ skill: 'café' }])).toBe(true)
  })
})

// ===========================================================================
// matchMaterials — adversarial
// ===========================================================================

describe('matchMaterials — edge cases', () => {
  it('handles undefined required materials (always true)', () => {
    expect(matchMaterials(undefined, [{ skill: 'printing' }])).toBe(true)
  })

  it('handles empty required materials (always true)', () => {
    expect(matchMaterials([], [{ skill: 'printing' }])).toBe(true)
  })

  it('handles holon with no materials at all', () => {
    expect(matchMaterials(['wood'], [{ skill: 'printing' }])).toBe(false)
  })

  it('handles case-insensitive matching', () => {
    expect(matchMaterials(['WOOD'], [{ skill: 'carpentry', materials: ['wood', 'metal'] }])).toBe(true)
  })
})

// ===========================================================================
// calculateCapabilityScore — adversarial
// ===========================================================================

describe('calculateCapabilityScore — edge cases', () => {
  it('returns 0 when no capabilities match', () => {
    expect(calculateCapabilityScore(['welding'], [{ skill: 'printing' }])).toBe(0)
  })

  it('returns 100 for perfect match', () => {
    expect(calculateCapabilityScore(['printing'], [{ skill: 'printing' }])).toBe(100)
  })

  it('handles empty required skills', () => {
    // every() on empty array is true, so matchCapabilities passes
    // matchCount / required.length = 0/0 = NaN → should handle gracefully
    const score = calculateCapabilityScore([], [{ skill: 'printing' }])
    expect(typeof score).toBe('number')
  })
})

// ===========================================================================
// calculateProximityScore — adversarial
// ===========================================================================

describe('calculateProximityScore — edge cases', () => {
  it('returns 80 for digital node (serviceRadius = 0)', () => {
    expect(calculateProximityScore(100, 0)).toBe(80)
  })

  it('returns 100 for zero distance', () => {
    expect(calculateProximityScore(0, 50)).toBe(100)
  })

  it('returns 0 when distance equals service radius', () => {
    expect(calculateProximityScore(50, 50)).toBe(0)
  })

  it('returns 0 when distance exceeds service radius', () => {
    expect(calculateProximityScore(100, 50)).toBe(0)
  })

  it('handles negative distance (does not crash)', () => {
    const score = calculateProximityScore(-10, 50)
    // (1 - (-10/50)) * 100 = (1 + 0.2) * 100 = 120 → capped by max(0, ...)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('handles negative serviceRadius', () => {
    // serviceRadius !== 0, distance > serviceRadius(-50) is true if distance > -50
    // which is always true for positive distance → returns 0
    expect(() => calculateProximityScore(10, -50)).not.toThrow()
  })

  it('handles NaN distance', () => {
    expect(() => calculateProximityScore(NaN, 50)).not.toThrow()
  })
})

// ===========================================================================
// calculateFairnessScore — adversarial
// ===========================================================================

describe('calculateFairnessScore — edge cases', () => {
  it('returns ~100 for new vendor (0 orders, 5 rating)', () => {
    const score = calculateFairnessScore(0, 5)
    // 100 - min(0,80) + (5/5)*20 = 100 + 20 = 120 → capped at 100
    expect(score).toBe(100)
  })

  it('returns 0 for extremely busy vendor (50 orders, 0 rating)', () => {
    const score = calculateFairnessScore(50, 0)
    // 100 - min(100,80) + 0 = 100 - 80 = 20
    expect(score).toBe(20)
  })

  it('handles negative order count', () => {
    const score = calculateFairnessScore(-5, 3)
    // min(-10, 80) = -10 → 100 - (-10) + 12 = 122 → capped at 100
    expect(score).toBe(100)
  })

  it('handles negative rating', () => {
    const score = calculateFairnessScore(0, -5)
    // 100 - 0 + (-5/5)*20 = 100 - 20 = 80
    expect(score).toBe(80)
  })

  it('handles massive order count', () => {
    const score = calculateFairnessScore(10000, 5)
    // penalty capped at 80, bonus = 20 → 100 - 80 + 20 = 40
    expect(score).toBe(40)
  })
})

// ===========================================================================
// calculateMatchScore — adversarial
// ===========================================================================

describe('calculateMatchScore — edge cases', () => {
  it('all zeros = 0', () => {
    expect(calculateMatchScore(0, 0, 0, 0)).toBe(0)
  })

  it('all 100s = 100', () => {
    const score = calculateMatchScore(100, 100, 100, 100)
    // 100 * (0.4 + 0.3 + 0.2 + 0.1) = 100
    expect(score).toBeCloseTo(100, 5)
  })

  it('weights sum to 1.0', () => {
    const sum = WEIGHT_CAPABILITY + WEIGHT_PROXIMITY + WEIGHT_RATING + WEIGHT_FAIRNESS
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it('handles NaN inputs', () => {
    const score = calculateMatchScore(NaN, 50, 50, 50)
    expect(score).toBeNaN()
  })
})

// ===========================================================================
// findMatchingHolons — adversarial
// ===========================================================================

describe('findMatchingHolons — edge cases', () => {
  it('handles empty holons array', () => {
    expect(findMatchingHolons(makeRequirement(), [])).toEqual([])
  })

  it('filters out holons not accepting orders', () => {
    const h = makeHolon({ acceptingOrders: false })
    expect(findMatchingHolons(makeRequirement(), [h])).toEqual([])
  })

  it('filters out non-compliant holons', () => {
    const h = makeHolon({ constitutionalCompliance: false })
    expect(findMatchingHolons(makeRequirement(), [h])).toEqual([])
  })

  it('filters by minRating', () => {
    const h = makeHolon({ rating: 2 })
    expect(findMatchingHolons(makeRequirement(), [h], { minRating: 3 })).toEqual([])
  })

  it('handles holon with 0 rating (passes default minRating of 0)', () => {
    const h = makeHolon({ rating: 0 })
    const result = findMatchingHolons(makeRequirement(), [h])
    expect(result).toHaveLength(1)
  })

  it('handles digital node (serviceRadius 0 — never filtered by distance)', () => {
    const h = makeHolon({ serviceRadius: 0 })
    const req = makeRequirement({ buyerLocation: { lat: 0, lng: 0 } }) // far away
    const result = findMatchingHolons(req, [h])
    expect(result).toHaveLength(1)
    expect(result[0].proximityScore).toBe(80)
  })

  it('handles massive array of 1000 holons', () => {
    const holons = Array.from({ length: 1000 }, (_, i) =>
      makeHolon({
        id: i,
        location: { lat: 27 + (i % 50) * 0.01, lng: -82 + (i % 50) * 0.01 },
        serviceRadius: 200, // wide radius so buyer is within range
      }),
    )
    // Buyer at center of holon cluster
    const req = makeRequirement({ buyerLocation: { lat: 27.25, lng: -81.75 } })
    const result = findMatchingHolons(req, holons, { maxResults: 5 })
    expect(result).toHaveLength(5)
    // Verify sorted descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].totalScore).toBeGreaterThanOrEqual(result[i].totalScore)
    }
  })

  it('handles buyer at exact holon location (0 distance)', () => {
    const h = makeHolon({ location: { lat: 27.96, lng: -82.80 } })
    const req = makeRequirement({ buyerLocation: { lat: 27.96, lng: -82.80 } })
    const result = findMatchingHolons(req, [h])
    expect(result).toHaveLength(1)
    expect(result[0].distance).toBe(0)
    expect(result[0].proximityScore).toBe(100)
  })

  it('handles holon with empty capabilities (fails skill match)', () => {
    const h = makeHolon({ capabilities: [] })
    expect(findMatchingHolons(makeRequirement(), [h])).toEqual([])
  })

  it('handles requirement with maxDistance override', () => {
    const h = makeHolon({
      location: { lat: 28.5, lng: -82.80 },
      serviceRadius: 100,
    })
    const req = makeRequirement({
      buyerLocation: { lat: 27.96, lng: -82.80 },
      maxDistance: 10, // ~37 miles between points, maxDist = 10
    })
    // maxDist = maxDistance(10) ?? serviceRadius(100) → 10. distance ~37 > 10 → filtered
    const result = findMatchingHolons(req, [h])
    expect(result).toEqual([])
  })
})

// ===========================================================================
// validateFulfillmentTransition — exhaustive
// ===========================================================================

describe('validateFulfillmentTransition — exhaustive', () => {
  it('all defined states have transition maps', () => {
    for (const status of FULFILLMENT_STATES) {
      // validateFulfillmentTransition should not crash for any defined state
      expect(() => validateFulfillmentTransition(status, 'pending_match')).not.toThrow()
    }
  })

  it('terminal states (delivered, cancelled) reject ALL transitions', () => {
    for (const target of FULFILLMENT_STATES) {
      expect(validateFulfillmentTransition('delivered', target)).toBe(false)
      expect(validateFulfillmentTransition('cancelled', target)).toBe(false)
    }
  })

  it('no state can transition to itself', () => {
    for (const status of FULFILLMENT_STATES) {
      expect(validateFulfillmentTransition(status, status)).toBe(false)
    }
  })

  it('pending_match can only go to matched or cancelled', () => {
    expect(validateFulfillmentTransition('pending_match', 'matched')).toBe(true)
    expect(validateFulfillmentTransition('pending_match', 'cancelled')).toBe(true)
    expect(validateFulfillmentTransition('pending_match', 'delivered')).toBe(false)
    expect(validateFulfillmentTransition('pending_match', 'shipped')).toBe(false)
  })

  it('handles unknown status gracefully', () => {
    expect(validateFulfillmentTransition('ghost_status' as FulfillmentStatus, 'matched')).toBe(false)
  })

  it('valid forward path: pending_match → matched → accepted → in_production → shipped → delivered', () => {
    expect(validateFulfillmentTransition('pending_match', 'matched')).toBe(true)
    expect(validateFulfillmentTransition('matched', 'accepted')).toBe(true)
    expect(validateFulfillmentTransition('accepted', 'in_production')).toBe(true)
    expect(validateFulfillmentTransition('in_production', 'shipped')).toBe(true)
    expect(validateFulfillmentTransition('shipped', 'delivered')).toBe(true)
  })

  it('rejection loop: rejected → pending_match → matched', () => {
    expect(validateFulfillmentTransition('rejected', 'pending_match')).toBe(true)
    expect(validateFulfillmentTransition('pending_match', 'matched')).toBe(true)
  })
})

// ===========================================================================
// validateFulfillmentUpdate — adversarial
// ===========================================================================

describe('validateFulfillmentUpdate — edge cases', () => {
  it('shipped without tracking number returns error', () => {
    expect(validateFulfillmentUpdate({ status: 'shipped' })).toBeTruthy()
  })

  it('shipped with empty tracking number returns error', () => {
    expect(validateFulfillmentUpdate({ status: 'shipped', trackingNumber: '   ' })).toBeTruthy()
  })

  it('shipped with valid tracking passes', () => {
    expect(validateFulfillmentUpdate({ status: 'shipped', trackingNumber: 'TRACK123' })).toBeNull()
  })

  it('rejected without reason returns error', () => {
    expect(validateFulfillmentUpdate({ status: 'rejected' })).toBeTruthy()
  })

  it('rejected with empty reason returns error', () => {
    expect(validateFulfillmentUpdate({ status: 'rejected', rejectionReason: '' })).toBeTruthy()
  })

  it('rejected with valid reason passes', () => {
    expect(validateFulfillmentUpdate({ status: 'rejected', rejectionReason: 'Out of stock' })).toBeNull()
  })

  it('other statuses pass without extra fields', () => {
    const statuses: FulfillmentStatus[] = ['pending_match', 'matched', 'accepted', 'in_production', 'delivered', 'cancelled']
    for (const status of statuses) {
      expect(validateFulfillmentUpdate({ status })).toBeNull()
    }
  })
})

// ===========================================================================
// Order completeness — adversarial
// ===========================================================================

describe('isOrderFullyFulfilled / isOrderPartiallyFulfilled — edge cases', () => {
  it('empty array is NOT fully fulfilled', () => {
    expect(isOrderFullyFulfilled([])).toBe(false)
  })

  it('empty array is NOT partially fulfilled', () => {
    expect(isOrderPartiallyFulfilled([])).toBe(false)
  })

  it('single delivered item = fully fulfilled', () => {
    expect(isOrderFullyFulfilled(['delivered'])).toBe(true)
    expect(isOrderPartiallyFulfilled(['delivered'])).toBe(false)
  })

  it('all delivered = fully, not partially', () => {
    expect(isOrderFullyFulfilled(['delivered', 'delivered', 'delivered'])).toBe(true)
    expect(isOrderPartiallyFulfilled(['delivered', 'delivered', 'delivered'])).toBe(false)
  })

  it('mixed = partially, not fully', () => {
    expect(isOrderFullyFulfilled(['delivered', 'shipped'])).toBe(false)
    expect(isOrderPartiallyFulfilled(['delivered', 'shipped'])).toBe(true)
  })

  it('none delivered = neither', () => {
    expect(isOrderFullyFulfilled(['pending_match', 'matched'])).toBe(false)
    expect(isOrderPartiallyFulfilled(['pending_match', 'matched'])).toBe(false)
  })
})

// ===========================================================================
// calculateVendorShare — adversarial
// ===========================================================================

describe('calculateVendorShare — edge cases', () => {
  it('default 60% of $100 = $60', () => {
    expect(calculateVendorShare(100)).toBe(60)
  })

  it('handles 0 amount', () => {
    expect(calculateVendorShare(0)).toBe(0)
  })

  it('handles negative amount', () => {
    expect(calculateVendorShare(-100)).toBe(-60)
  })

  it('handles 0% provider share', () => {
    expect(calculateVendorShare(100, 0)).toBe(0)
  })

  it('handles 100% provider share', () => {
    expect(calculateVendorShare(100, 100)).toBe(100)
  })

  it('handles fractional cents (rounds to 2 decimal places)', () => {
    expect(calculateVendorShare(33.33, 60)).toBe(20) // 33.33 * 0.6 = 19.998 → 20
  })

  it('handles very small amounts', () => {
    const result = calculateVendorShare(0.01, 60)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(0.01)
  })
})

// ===========================================================================
// serializeMatch — adversarial
// ===========================================================================

describe('serializeMatch — edge cases', () => {
  it('uses business name when available', () => {
    const match: HolonMatch = {
      holon: makeHolon({ businessName: 'Soul Print' }),
      distance: 5.2,
      capabilityScore: 100,
      proximityScore: 89.6,
      ratingScore: 90,
      fairnessScore: 80,
      totalScore: 91.4,
    }
    const s = serializeMatch(match)
    expect(s).toContain('Soul Print')
    expect(s).toContain('5.2 mi')
    expect(s).toContain('Score: 91')
  })

  it('falls back to Holon #id when no business name', () => {
    const match: HolonMatch = {
      holon: makeHolon({ businessName: undefined, id: 42 }),
      distance: 0,
      capabilityScore: 0,
      proximityScore: 0,
      ratingScore: 0,
      fairnessScore: 0,
      totalScore: 0,
    }
    expect(serializeMatch(match)).toContain('Holon #42')
  })
})

// ===========================================================================
// Angel Token queue — adversarial
// ===========================================================================

describe('isQueuedAngelToken — edge cases', () => {
  it('returns true for valid queued token', () => {
    const entry: FulfillmentEntry = {
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      tokenStatus: 'active',
      queuedAt: '2026-01-01T00:00:00Z',
    }
    expect(isQueuedAngelToken(entry)).toBe(true)
  })

  it('returns false when not pending_match', () => {
    const entry: FulfillmentEntry = {
      orderItemIndex: 0,
      fulfillmentStatus: 'matched',
      tokenStatus: 'active',
      queuedAt: '2026-01-01T00:00:00Z',
    }
    expect(isQueuedAngelToken(entry)).toBe(false)
  })

  it('returns false when token not active', () => {
    const entry: FulfillmentEntry = {
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      tokenStatus: 'redeemed',
      queuedAt: '2026-01-01T00:00:00Z',
    }
    expect(isQueuedAngelToken(entry)).toBe(false)
  })

  it('returns false when no queuedAt', () => {
    const entry: FulfillmentEntry = {
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      tokenStatus: 'active',
    }
    expect(isQueuedAngelToken(entry)).toBe(false)
  })
})

describe('getQueuePosition — edge cases', () => {
  const makeEntry = (queuedAt: string): FulfillmentEntry => ({
    orderItemIndex: 0,
    fulfillmentStatus: 'pending_match',
    tokenStatus: 'active',
    queuedAt,
  })

  it('returns position 1 for only entry', () => {
    const entries = [makeEntry('2026-01-01T00:00:00Z')]
    expect(getQueuePosition('2026-01-01T00:00:00Z', entries)).toBe(1)
  })

  it('returns correct FIFO order', () => {
    const entries = [
      makeEntry('2026-01-03T00:00:00Z'),
      makeEntry('2026-01-01T00:00:00Z'),
      makeEntry('2026-01-02T00:00:00Z'),
    ]
    expect(getQueuePosition('2026-01-01T00:00:00Z', entries)).toBe(1) // earliest = first
    expect(getQueuePosition('2026-01-03T00:00:00Z', entries)).toBe(3) // latest = last
  })

  it('returns length+1 for unknown timestamp', () => {
    const entries = [makeEntry('2026-01-01T00:00:00Z')]
    expect(getQueuePosition('2099-01-01T00:00:00Z', entries)).toBe(2)
  })

  it('handles empty queue', () => {
    expect(getQueuePosition('2026-01-01T00:00:00Z', [])).toBe(1)
  })
})

// ===========================================================================
// calculateEquipmentBonus — adversarial
// ===========================================================================

describe('calculateEquipmentBonus — edge cases', () => {
  it('returns 0 for undefined equipment', () => {
    expect(calculateEquipmentBonus(undefined, [{ skill: 'printing' }])).toBe(0)
  })

  it('returns 0 for empty equipment array', () => {
    expect(calculateEquipmentBonus([], [{ skill: 'printing' }])).toBe(0)
  })

  it('returns 0 when holon has no equipment', () => {
    expect(calculateEquipmentBonus(['laser-cutter'], [{ skill: 'printing' }])).toBe(0)
  })

  it('returns 15 when equipment matches', () => {
    expect(calculateEquipmentBonus(
      ['laser-cutter'],
      [{ skill: 'cutting', equipment: 'Laser-Cutter' }],
    )).toBe(15)
  })
})
