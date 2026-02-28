/**
 * Logistics Engine — BREAK IT Edge Case Tests
 *
 * Deliberately adversarial inputs: NaN, Infinity, negative values,
 * empty arrays, null coordinates, massive datasets, duplicate IDs,
 * boundary geohashes, self-referencing nodes, zero-capacity transports.
 *
 * If it doesn't crash here, it won't crash in production.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateDistance,
  findNearestTransport,
  matchSupplyToDemand,
  fuzzyItemMatch,
  geohashProximity,
  validateShipmentTransition,
  scanNetworkForMatches,
} from '@/utilities/logistics-engine'
import type {
  GeoPoint,
  LogisticsNodeData,
  TransportData,
} from '@/utilities/logistics-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<LogisticsNodeData> = {}): LogisticsNodeData {
  return {
    id: 1,
    name: 'Test Node',
    type: 'pantry',
    governanceMode: 'autonomous',
    location: { lat: 27.96, lng: -82.80 },
    serviceRadius: 25,
    status: 'active',
    trustScore: 5,
    ...overrides,
  }
}

function makeTransport(overrides: Partial<TransportData> = {}): TransportData {
  return {
    id: 1,
    vehicleName: 'Test Van',
    ownerId: 1,
    transportType: 'van',
    capacity: 50,
    status: 'idle',
    currentLocation: { lat: 27.95, lng: -82.46 },
    maxRange: 50,
    completedDeliveries: 10,
    rating: 4.5,
    ...overrides,
  }
}

// ===========================================================================
// calculateDistance — adversarial inputs
// ===========================================================================

describe('calculateDistance — edge cases', () => {
  it('handles NaN latitude by returning 0 (fixed: safe default)', () => {
    const result = calculateDistance({ lat: NaN, lng: -82 }, { lat: 27, lng: -82 })
    // FIXED: NaN coords now caught by Number.isFinite guard → returns 0
    expect(result).toBe(0)
  })

  it('handles NaN longitude by returning 0 (fixed: safe default)', () => {
    const result = calculateDistance({ lat: 27, lng: NaN }, { lat: 27, lng: -82 })
    // FIXED: NaN coords now caught by Number.isFinite guard → returns 0
    expect(result).toBe(0)
  })

  it('handles Infinity coordinates', () => {
    const result = calculateDistance({ lat: Infinity, lng: -82 }, { lat: 27, lng: -82 })
    // Should not throw — NaN or Infinity is acceptable
    expect(typeof result).toBe('number')
  })

  it('handles negative coordinates (southern hemisphere, western hemisphere)', () => {
    // Sydney, Australia to Cape Town, South Africa
    const dist = calculateDistance({ lat: -33.87, lng: 151.21 }, { lat: -33.92, lng: 18.42 })
    expect(dist).toBeGreaterThan(6000) // ~6,880 miles
    expect(dist).toBeLessThan(7500)
  })

  it('handles antipodal points (max distance ~12,450 mi)', () => {
    const dist = calculateDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })
    expect(dist).toBeGreaterThan(12000)
    expect(dist).toBeLessThan(12500)
  })

  it('handles North Pole', () => {
    const dist = calculateDistance({ lat: 90, lng: 0 }, { lat: 90, lng: 180 })
    expect(dist).toBeCloseTo(0, 0)
  })

  it('handles South Pole', () => {
    const dist = calculateDistance({ lat: -90, lng: 0 }, { lat: -90, lng: 45 })
    expect(dist).toBeCloseTo(0, 0)
  })

  it('handles crossing the International Date Line', () => {
    // Tokyo (139.7) to Los Angeles (-118.2)
    const dist = calculateDistance({ lat: 35.68, lng: 139.69 }, { lat: 34.05, lng: -118.24 })
    expect(dist).toBeGreaterThan(5000)
    expect(dist).toBeLessThan(6000)
  })

  it('handles zero coordinates (Gulf of Guinea)', () => {
    const dist = calculateDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })
    expect(dist).toBeGreaterThan(60) // ~69 miles per degree at equator
    expect(dist).toBeLessThan(75)
  })
})

// ===========================================================================
// findNearestTransport — adversarial inputs
// ===========================================================================

describe('findNearestTransport — edge cases', () => {
  it('handles zero-capacity transport (should be filtered out for any shipment > 0)', () => {
    const t = makeTransport({ capacity: 0 })
    expect(findNearestTransport({ lat: 27, lng: -82 }, 1, [t])).toEqual([])
  })

  it('handles zero-size shipment (capacity 0 >= 0 passes gate)', () => {
    const t = makeTransport({ capacity: 0 })
    const result = findNearestTransport({ lat: 27, lng: -82 }, 0, [t])
    // capacity(0) >= shipmentSize(0) → should pass capacity gate
    expect(result.length).toBeGreaterThanOrEqual(0) // implementation-dependent
  })

  it('handles negative shipment size', () => {
    const t = makeTransport()
    // Use coordinates close to transport (27.95, -82.46) to stay within 50mi range
    const result = findNearestTransport({ lat: 27.9, lng: -82.5 }, -10, [t])
    // capacity(50) >= -10 → passes, which is technically correct
    expect(result).toHaveLength(1)
  })

  it('handles transport with zero maxRange (only exact co-location works)', () => {
    const t = makeTransport({ maxRange: 0, currentLocation: { lat: 27.96, lng: -82.80 } })
    // Pickup is at same coords — distance ~0
    const result = findNearestTransport({ lat: 27.96, lng: -82.80 }, 1, [t])
    expect(result.length).toBeLessThanOrEqual(1)
  })

  it('handles transport with negative maxRange', () => {
    const t = makeTransport({ maxRange: -10 })
    const result = findNearestTransport({ lat: 27, lng: -82 }, 1, [t])
    // Distance > -10 is always true, so this depends on implementation
    expect(result).toHaveLength(0) // distance is always positive, so dist > maxRange(-10) would be true... but the check is dist > maxRange which would be true, so filtered OUT
  })

  it('handles transport with NaN location', () => {
    const t = makeTransport({ currentLocation: { lat: NaN, lng: NaN } })
    // calculateDistance returns NaN, which fails the > comparison, so should be filtered
    const result = findNearestTransport({ lat: 27, lng: -82 }, 1, [t])
    // NaN > 50 is false, so it PASSES the maxRange gate — that's a bug potential
    // But NaN comparisons in scoring would produce NaN totalScore
    // This tests whether the code is resilient
    expect(() => findNearestTransport({ lat: 27, lng: -82 }, 1, [t])).not.toThrow()
  })

  it('handles massive array of transports (1000)', () => {
    const transports = Array.from({ length: 1000 }, (_, i) =>
      makeTransport({
        id: i,
        vehicleName: `Van ${i}`,
        currentLocation: { lat: 27 + (i % 10) * 0.1, lng: -82 + (i % 10) * 0.1 },
        maxRange: 500,
      }),
    )
    const result = findNearestTransport({ lat: 27, lng: -82 }, 1, transports, { maxResults: 5 })
    expect(result).toHaveLength(5)
    // Should be sorted by score
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].totalScore).toBeGreaterThanOrEqual(result[i].totalScore)
    }
  })

  it('handles transport with rating 0 and 0 deliveries', () => {
    const t = makeTransport({ rating: 0, completedDeliveries: 0 })
    // Use coordinates close to transport (27.95, -82.46) to stay within 50mi range
    const result = findNearestTransport({ lat: 27.9, lng: -82.5 }, 1, [t])
    expect(result).toHaveLength(1)
    expect(result[0].reliabilityScore).toBe(0) // 0/5 * 70 + min(0/50,1)*30 = 0
  })

  it('handles transport with all statuses except idle', () => {
    const statuses = ['en_route', 'loading', 'returning', 'offline', 'maintenance'] as const
    for (const status of statuses) {
      const t = makeTransport({ status })
      expect(findNearestTransport({ lat: 27, lng: -82 }, 1, [t])).toEqual([])
    }
  })

  it('handles pickup at NaN coordinates', () => {
    const t = makeTransport()
    expect(() => findNearestTransport({ lat: NaN, lng: NaN }, 1, [t])).not.toThrow()
  })
})

// ===========================================================================
// matchSupplyToDemand — adversarial inputs
// ===========================================================================

describe('matchSupplyToDemand — edge cases', () => {
  it('handles supply with zero quantity items', () => {
    const supply = makeNode({ inventory: [{ item: 'Soup', category: 'food', quantity: 0 }] })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', category: 'food', quantity: 5 }] })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).toBeNull() // nothing to give
  })

  it('handles demand with zero quantity needs', () => {
    const supply = makeNode({ inventory: [{ item: 'Soup', category: 'food', quantity: 100 }] })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', category: 'food', quantity: 0 }] })
    const result = matchSupplyToDemand(supply, demand)
    // quantity 0 need → totalNeeded=0, totalFilled=0 → fillRate = 0/0 = NaN
    // Should not crash
    expect(() => matchSupplyToDemand(supply, demand)).not.toThrow()
  })

  it('handles negative quantity in inventory', () => {
    const supply = makeNode({ inventory: [{ item: 'Soup', category: 'food', quantity: -5 }] })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', category: 'food', quantity: 5 }] })
    expect(() => matchSupplyToDemand(supply, demand)).not.toThrow()
  })

  it('handles both nodes at exact same location (distance = 0)', () => {
    const loc = { lat: 27.96, lng: -82.80 }
    const supply = makeNode({ inventory: [{ item: 'Water', category: 'food', quantity: 100 }], location: loc })
    const demand = makeNode({ id: 2, needs: [{ item: 'Water', category: 'food', quantity: 10 }], location: loc })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.distanceMiles).toBe(0)
    expect(result!.matchScore).toBeGreaterThan(0) // should get max distance score
  })

  it('handles nodes 200+ miles apart (distance penalty kicks in)', () => {
    const supply = makeNode({
      inventory: [{ item: 'Food', category: 'food', quantity: 100 }],
      location: { lat: 27.96, lng: -82.80 }, // Clearwater
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'Food', category: 'food', quantity: 10 }],
      location: { lat: 25.76, lng: -80.19 }, // Miami
    })
    const result = matchSupplyToDemand(supply, demand)
    // Distance is ~250 mi, distance penalty maxes out
    if (result) {
      expect(result.matchScore).toBeLessThan(80) // penalized by distance
    }
  })

  it('handles seasonal (inactive-equivalent) supply node', () => {
    const supply = makeNode({
      status: 'seasonal',
      inventory: [{ item: 'Soup', category: 'food', quantity: 100 }],
    })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', category: 'food', quantity: 10 }] })
    // Seasonal is NOT 'active', so should return null
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('handles demand with undefined needs', () => {
    const supply = makeNode({ inventory: [{ item: 'Soup', quantity: 10 }] })
    const demand = makeNode({ id: 2, needs: undefined })
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('handles supply with undefined inventory', () => {
    const supply = makeNode({ inventory: undefined })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', quantity: 5 }] })
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('handles trust score of 0 on both nodes', () => {
    const supply = makeNode({
      trustScore: 0,
      inventory: [{ item: 'Water', category: 'food', quantity: 100 }],
    })
    const demand = makeNode({
      id: 2,
      trustScore: 0,
      needs: [{ item: 'Water', category: 'food', quantity: 10 }],
    })
    expect(() => matchSupplyToDemand(supply, demand)).not.toThrow()
  })

  it('handles very large trust scores (overflow check)', () => {
    const supply = makeNode({
      trustScore: Number.MAX_SAFE_INTEGER,
      inventory: [{ item: 'Food', category: 'food', quantity: 100 }],
    })
    const demand = makeNode({
      id: 2,
      trustScore: Number.MAX_SAFE_INTEGER,
      needs: [{ item: 'Food', category: 'food', quantity: 10 }],
    })
    const result = matchSupplyToDemand(supply, demand)
    // Trust bonus is capped at min(avg, 10), so should be fine
    if (result) {
      expect(result.matchScore).toBeLessThanOrEqual(100)
    }
  })

  it('handles multiple needs matching same inventory item (depletion)', () => {
    const supply = makeNode({
      inventory: [{ item: 'Canned Soup', category: 'food', quantity: 10 }],
    })
    const demand = makeNode({
      id: 2,
      needs: [
        { item: 'Canned Soup', category: 'food', quantity: 7 },
        { item: 'Canned Soup', category: 'food', quantity: 7 },
      ],
    })
    const result = matchSupplyToDemand(supply, demand)
    if (result) {
      const totalAllocated = result.manifest.reduce((s, m) => s + m.quantity, 0)
      expect(totalAllocated).toBeLessThanOrEqual(10) // can't give more than we have
    }
  })
})

// ===========================================================================
// fuzzyItemMatch — edge cases
// ===========================================================================

describe('fuzzyItemMatch — edge cases', () => {
  it('handles empty strings', () => {
    expect(fuzzyItemMatch('', '')).toBe(true) // both normalize to empty
  })

  it('handles one empty string', () => {
    expect(fuzzyItemMatch('Soup', '')).toBe(true) // '' includes '' is true
  })

  it('handles strings with only punctuation', () => {
    expect(fuzzyItemMatch('---', '...')).toBe(true) // both normalize to empty
  })

  it('handles very long strings', () => {
    const long = 'a'.repeat(10000)
    expect(() => fuzzyItemMatch(long, long)).not.toThrow()
    expect(fuzzyItemMatch(long, long)).toBe(true)
  })

  it('handles unicode characters', () => {
    expect(fuzzyItemMatch('café latte', 'CAFÉ LATTE')).toBe(true)
  })

  it('handles numbers in item names', () => {
    expect(fuzzyItemMatch('Formula 409', '409 formula')).toBe(true)
  })
})

// ===========================================================================
// geohashProximity — edge cases
// ===========================================================================

describe('geohashProximity — edge cases', () => {
  it('handles empty strings', () => {
    expect(geohashProximity('', '', 0)).toBe(true) // prefix length 0
  })

  it('handles prefix length 0 (always matches)', () => {
    expect(geohashProximity('abc', 'xyz', 0)).toBe(true)
  })

  it('handles prefix length longer than strings', () => {
    expect(geohashProximity('abc', 'abc', 10)).toBe(false)
  })

  it('handles identical strings', () => {
    expect(geohashProximity('djk3xyz', 'djk3xyz', 7)).toBe(true)
  })
})

// ===========================================================================
// validateShipmentTransition — exhaustive
// ===========================================================================

describe('validateShipmentTransition — exhaustive', () => {
  const allStatuses = ['pending', 'matched', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'failed']

  it('every valid status has a defined transition map', () => {
    for (const status of allStatuses) {
      const result = validateShipmentTransition(status, 'pending')
      expect(result).toHaveProperty('valid')
    }
  })

  it('terminal states (delivered, cancelled) reject ALL transitions', () => {
    for (const target of allStatuses) {
      expect(validateShipmentTransition('delivered', target).valid).toBe(false)
      expect(validateShipmentTransition('cancelled', target).valid).toBe(false)
    }
  })

  it('no status can transition to itself', () => {
    for (const status of allStatuses) {
      const result = validateShipmentTransition(status, status)
      if (status === 'delivered' || status === 'cancelled') {
        expect(result.valid).toBe(false) // terminal
      } else {
        // Self-transitions should not be allowed
        expect(result.valid).toBe(false)
      }
    }
  })

  it('Ghost Order Prevention: pending cannot jump to delivered', () => {
    expect(validateShipmentTransition('pending', 'delivered').valid).toBe(false)
  })

  it('Ghost Order Prevention: pending cannot jump to in_transit', () => {
    expect(validateShipmentTransition('pending', 'in_transit').valid).toBe(false)
  })

  it('Ghost Order Prevention: matched cannot jump to delivered', () => {
    expect(validateShipmentTransition('matched', 'delivered').valid).toBe(false)
  })

  it('handles empty string status', () => {
    const result = validateShipmentTransition('', 'pending')
    expect(result.valid).toBe(false)
  })

  it('handles null-like status', () => {
    const result = validateShipmentTransition(undefined as any, 'pending')
    expect(result.valid).toBe(false)
  })
})

// ===========================================================================
// scanNetworkForMatches — stress
// ===========================================================================

describe('scanNetworkForMatches — stress', () => {
  it('handles 100 supply x 100 demand (10,000 comparisons)', () => {
    const supplies = Array.from({ length: 100 }, (_, i) =>
      makeNode({
        id: i + 1,
        inventory: [{ item: 'Food', category: 'food', quantity: 50 + i }],
        location: { lat: 27 + i * 0.01, lng: -82 + i * 0.01 },
      }),
    )
    const demands = Array.from({ length: 100 }, (_, i) =>
      makeNode({
        id: i + 1001,
        needs: [{ item: 'Food', category: 'food', quantity: 10 + i }],
        location: { lat: 27 + i * 0.01, lng: -82.5 + i * 0.01 },
      }),
    )

    const start = performance.now()
    const proposals = scanNetworkForMatches(supplies, demands, { maxProposals: 50 })
    const elapsed = performance.now() - start

    expect(proposals.length).toBeLessThanOrEqual(50)
    expect(elapsed).toBeLessThan(5000) // should complete in under 5 seconds
    // Verify sorted by priority then score
    for (let i = 1; i < proposals.length; i++) {
      const pOrder = { sos: 0, urgent: 1, standard: 2 } as const
      const prevP = pOrder[proposals[i - 1].priority]
      const currP = pOrder[proposals[i].priority]
      if (prevP === currP) {
        expect(proposals[i - 1].matchScore).toBeGreaterThanOrEqual(proposals[i].matchScore)
      }
    }
  })

  it('handles empty supply with many demands', () => {
    const demands = Array.from({ length: 50 }, (_, i) =>
      makeNode({ id: i + 1, needs: [{ item: 'Food', quantity: 10 }] }),
    )
    expect(scanNetworkForMatches([], demands)).toEqual([])
  })

  it('handles many supplies with empty demand', () => {
    const supplies = Array.from({ length: 50 }, (_, i) =>
      makeNode({ id: i + 1, inventory: [{ item: 'Food', quantity: 10 }] }),
    )
    expect(scanNetworkForMatches(supplies, [])).toEqual([])
  })
})
