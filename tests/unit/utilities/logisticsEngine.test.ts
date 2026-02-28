/**
 * Logistics Engine — Unit Tests
 *
 * Tests the Bread-Breaker algorithm (supply-demand matching),
 * Soul Fleet dispatch (transport matching), and shipment state machine.
 *
 * @see src/utilities/logistics-engine.ts
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
  MIN_AUTO_MATCH_SCORE,
  TRANSPORT_WEIGHTS,
} from '@/utilities/logistics-engine'
import type {
  GeoPoint,
  LogisticsNodeData,
  TransportData,
} from '@/utilities/logistics-engine'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const clearwaterGeo: GeoPoint = { lat: 27.9659, lng: -82.8001 }
const tampaGeo: GeoPoint = { lat: 27.9506, lng: -82.4572 }
const orlandoGeo: GeoPoint = { lat: 28.5383, lng: -81.3792 }
const miamiGeo: GeoPoint = { lat: 25.7617, lng: -80.1918 }

function makeNode(overrides: Partial<LogisticsNodeData> = {}): LogisticsNodeData {
  return {
    id: 1,
    name: 'Test Pantry',
    type: 'pantry',
    governanceMode: 'autonomous',
    location: { ...clearwaterGeo },
    serviceRadius: 25,
    status: 'active',
    trustScore: 5,
    ...overrides,
  }
}

function makeTransport(overrides: Partial<TransportData> = {}): TransportData {
  return {
    id: 1,
    vehicleName: 'Soul Van 1',
    ownerId: 1,
    transportType: 'van',
    capacity: 50,
    status: 'idle',
    currentLocation: { ...tampaGeo },
    maxRange: 50,
    completedDeliveries: 10,
    rating: 4.5,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

describe('calculateDistance', () => {
  it('returns 0 for identical points', () => {
    expect(calculateDistance(clearwaterGeo, clearwaterGeo)).toBe(0)
  })

  it('calculates Clearwater to Tampa (~20 mi)', () => {
    const dist = calculateDistance(clearwaterGeo, tampaGeo)
    expect(dist).toBeGreaterThan(15)
    expect(dist).toBeLessThan(25)
  })

  it('calculates Clearwater to Orlando (~100 mi)', () => {
    const dist = calculateDistance(clearwaterGeo, orlandoGeo)
    expect(dist).toBeGreaterThan(80)
    expect(dist).toBeLessThan(120)
  })

  it('calculates Clearwater to Miami (~250 mi)', () => {
    const dist = calculateDistance(clearwaterGeo, miamiGeo)
    expect(dist).toBeGreaterThan(220)
    expect(dist).toBeLessThan(280)
  })

  it('is commutative', () => {
    const ab = calculateDistance(clearwaterGeo, tampaGeo)
    const ba = calculateDistance(tampaGeo, clearwaterGeo)
    expect(ab).toBeCloseTo(ba, 6)
  })
})

// ---------------------------------------------------------------------------
// findNearestTransport — Soul Fleet Dispatch
// ---------------------------------------------------------------------------

describe('findNearestTransport', () => {
  it('returns empty array when no transports available', () => {
    expect(findNearestTransport(clearwaterGeo, 10, [])).toEqual([])
  })

  it('filters out non-idle transports', () => {
    const t = makeTransport({ status: 'en_route' })
    expect(findNearestTransport(clearwaterGeo, 10, [t])).toEqual([])
  })

  it('filters out transports with insufficient capacity', () => {
    const t = makeTransport({ capacity: 5 })
    expect(findNearestTransport(clearwaterGeo, 10, [t])).toEqual([])
  })

  it('filters out transports without location', () => {
    const t = makeTransport({ currentLocation: undefined })
    expect(findNearestTransport(clearwaterGeo, 10, [t])).toEqual([])
  })

  it('filters out transports beyond maxRange', () => {
    const t = makeTransport({ currentLocation: { ...miamiGeo }, maxRange: 30 })
    expect(findNearestTransport(clearwaterGeo, 10, [t])).toEqual([])
  })

  it('returns matching transport with all scoring fields', () => {
    const t = makeTransport()
    const matches = findNearestTransport(clearwaterGeo, 10, [t])
    expect(matches).toHaveLength(1)
    expect(matches[0]).toHaveProperty('transport')
    expect(matches[0]).toHaveProperty('distanceMiles')
    expect(matches[0]).toHaveProperty('capacityFit')
    expect(matches[0]).toHaveProperty('reliabilityScore')
    expect(matches[0]).toHaveProperty('totalScore')
    expect(matches[0].distanceMiles).toBeGreaterThan(0)
    expect(matches[0].totalScore).toBeGreaterThan(0)
  })

  it('sorts by total score (best first)', () => {
    const close = makeTransport({ id: 1, currentLocation: { ...tampaGeo }, rating: 5 })
    const far = makeTransport({ id: 2, currentLocation: { ...orlandoGeo }, maxRange: 200, rating: 3 })
    const matches = findNearestTransport(clearwaterGeo, 10, [far, close])
    expect(matches[0].transport.id).toBe(1) // close + high rating wins
  })

  it('respects maxResults option', () => {
    const transports = Array.from({ length: 10 }, (_, i) =>
      makeTransport({ id: i + 1, vehicleName: `Van ${i}` }),
    )
    const matches = findNearestTransport(clearwaterGeo, 10, transports, { maxResults: 3 })
    expect(matches).toHaveLength(3)
  })

  it('respects maxDistance option', () => {
    const t = makeTransport({ currentLocation: { ...tampaGeo }, maxRange: 100 })
    // Tampa is ~20 mi from Clearwater, so maxDistance: 10 should exclude
    const matches = findNearestTransport(clearwaterGeo, 10, [t], { maxDistance: 10 })
    expect(matches).toHaveLength(0)
  })

  it('filters by refrigeration capability', () => {
    const cold = makeTransport({ id: 1, specialCapabilities: ['refrigerated'] })
    const warm = makeTransport({ id: 2, specialCapabilities: [] })
    const matches = findNearestTransport(clearwaterGeo, 10, [cold, warm], { requireRefrigeration: true })
    expect(matches).toHaveLength(1)
    expect(matches[0].transport.id).toBe(1)
  })

  it('capacityFit is ratio of shipment/capacity', () => {
    const t = makeTransport({ capacity: 100 })
    const matches = findNearestTransport(clearwaterGeo, 25, [t])
    expect(matches[0].capacityFit).toBe(0.25)
  })
})

// ---------------------------------------------------------------------------
// matchSupplyToDemand — Bread-Breaker Algorithm
// ---------------------------------------------------------------------------

describe('matchSupplyToDemand', () => {
  it('returns null when supply node is inactive', () => {
    const supply = makeNode({ status: 'inactive', inventory: [{ item: 'Soup', quantity: 10 }] })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', quantity: 5 }] })
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('returns null when supply has no inventory', () => {
    const supply = makeNode({ inventory: [] })
    const demand = makeNode({ id: 2, needs: [{ item: 'Soup', quantity: 5 }] })
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('returns null when demand has no needs', () => {
    const supply = makeNode({ inventory: [{ item: 'Soup', quantity: 10 }] })
    const demand = makeNode({ id: 2, needs: [] })
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('returns null when no items match', () => {
    const supply = makeNode({ inventory: [{ item: 'Blankets', category: 'clothing', quantity: 10 }] })
    const demand = makeNode({ id: 2, needs: [{ item: 'Medicine', category: 'medicine', quantity: 5 }] })
    expect(matchSupplyToDemand(supply, demand)).toBeNull()
  })

  it('matches items by category', () => {
    const supply = makeNode({
      inventory: [{ item: 'Canned Soup', category: 'food', quantity: 20 }],
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'Food items', category: 'food', quantity: 10 }],
      location: { ...tampaGeo },
    })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.manifest).toHaveLength(1)
    expect(result!.manifest[0].quantity).toBe(10) // fills the need, not the whole supply
  })

  it('matches items by fuzzy name', () => {
    const supply = makeNode({
      inventory: [{ item: 'Canned Soup, Tomato', quantity: 15 }],
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'tomato soup', quantity: 5 }],
      location: { ...tampaGeo },
    })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.manifest[0].quantity).toBe(5)
  })

  it('caps allocation at available quantity', () => {
    const supply = makeNode({
      inventory: [{ item: 'Blankets', category: 'clothing', quantity: 3 }],
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'Blankets', category: 'clothing', quantity: 100 }],
      location: { ...tampaGeo },
    })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.manifest[0].quantity).toBe(3) // can only give what we have
  })

  it('sets priority based on highest urgency need', () => {
    const supply = makeNode({
      inventory: [
        { item: 'Food', category: 'food', quantity: 50 },
        { item: 'Meds', category: 'medicine', quantity: 10 },
      ],
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [
        { item: 'Food', category: 'food', quantity: 10, urgency: 'standard' },
        { item: 'Meds', category: 'medicine', quantity: 5, urgency: 'sos' },
      ],
      location: { ...tampaGeo },
    })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.priority).toBe('sos')
  })

  it('includes distance in proposal', () => {
    const supply = makeNode({ location: { ...clearwaterGeo } })
    supply.inventory = [{ item: 'Soup', category: 'food', quantity: 20 }]
    const demand = makeNode({ id: 2, location: { ...tampaGeo } })
    demand.needs = [{ item: 'Soup', category: 'food', quantity: 10 }]
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.distanceMiles).toBeGreaterThan(15)
    expect(result!.distanceMiles).toBeLessThan(25)
  })

  it('sets matchType to auto', () => {
    const supply = makeNode({
      inventory: [{ item: 'Water', category: 'food', quantity: 100 }],
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'Water', category: 'food', quantity: 20 }],
      location: { ...tampaGeo },
    })
    const result = matchSupplyToDemand(supply, demand)
    expect(result!.matchType).toBe('auto')
  })

  it('matchScore capped at 100', () => {
    const supply = makeNode({
      inventory: [{ item: 'Insulin', category: 'medicine', quantity: 1000 }],
      trustScore: 100,
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'Insulin', category: 'medicine', quantity: 10, urgency: 'sos' }],
      trustScore: 100,
      location: { lat: 27.966, lng: -82.801 }, // very close
    })
    const result = matchSupplyToDemand(supply, demand)
    expect(result).not.toBeNull()
    expect(result!.matchScore).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// fuzzyItemMatch
// ---------------------------------------------------------------------------

describe('fuzzyItemMatch', () => {
  it('matches identical strings', () => {
    expect(fuzzyItemMatch('Canned Soup', 'Canned Soup')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(fuzzyItemMatch('BLANKETS', 'blankets')).toBe(true)
  })

  it('handles reordered words', () => {
    expect(fuzzyItemMatch('Soup Canned', 'Canned Soup')).toBe(true)
  })

  it('handles substring match', () => {
    expect(fuzzyItemMatch('Soup', 'Tomato Soup')).toBe(true)
  })

  it('returns false for unrelated items', () => {
    expect(fuzzyItemMatch('Blankets', 'Medicine')).toBe(false)
  })

  it('handles punctuation', () => {
    expect(fuzzyItemMatch('First-Aid Kit', 'first aid kit')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// geohashProximity
// ---------------------------------------------------------------------------

describe('geohashProximity', () => {
  it('returns true for matching prefix', () => {
    expect(geohashProximity('djk3xyz', 'djk3abc', 4)).toBe(true)
  })

  it('returns false for different prefix', () => {
    expect(geohashProximity('djk3xyz', 'abc1def', 4)).toBe(false)
  })

  it('returns false for undefined inputs', () => {
    expect(geohashProximity(undefined, 'djk3abc', 4)).toBe(false)
    expect(geohashProximity('djk3xyz', undefined, 4)).toBe(false)
  })

  it('returns false for too-short strings', () => {
    expect(geohashProximity('djk', 'djk', 4)).toBe(false)
  })

  it('defaults to prefix length 4', () => {
    expect(geohashProximity('djk3xyz', 'djk3abc')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateShipmentTransition — State Machine
// ---------------------------------------------------------------------------

describe('validateShipmentTransition', () => {
  it('allows pending → matched', () => {
    expect(validateShipmentTransition('pending', 'matched')).toEqual({ valid: true })
  })

  it('allows pending → cancelled', () => {
    expect(validateShipmentTransition('pending', 'cancelled')).toEqual({ valid: true })
  })

  it('blocks pending → delivered', () => {
    const result = validateShipmentTransition('pending', 'delivered')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Cannot transition')
  })

  it('allows matched → dispatched', () => {
    expect(validateShipmentTransition('matched', 'dispatched')).toEqual({ valid: true })
  })

  it('allows dispatched → in_transit', () => {
    expect(validateShipmentTransition('dispatched', 'in_transit')).toEqual({ valid: true })
  })

  it('allows in_transit → delivered', () => {
    expect(validateShipmentTransition('in_transit', 'delivered')).toEqual({ valid: true })
  })

  it('blocks delivered → anything (terminal)', () => {
    expect(validateShipmentTransition('delivered', 'pending').valid).toBe(false)
  })

  it('blocks cancelled → anything (terminal)', () => {
    expect(validateShipmentTransition('cancelled', 'pending').valid).toBe(false)
  })

  it('allows failed → pending (retry)', () => {
    expect(validateShipmentTransition('failed', 'pending')).toEqual({ valid: true })
  })

  it('rejects unknown status', () => {
    const result = validateShipmentTransition('nonexistent', 'pending')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Unknown status')
  })
})

// ---------------------------------------------------------------------------
// scanNetworkForMatches
// ---------------------------------------------------------------------------

describe('scanNetworkForMatches', () => {
  it('returns empty for empty arrays', () => {
    expect(scanNetworkForMatches([], [])).toEqual([])
  })

  it('does not match a node with itself', () => {
    const node = makeNode({
      inventory: [{ item: 'Soup', category: 'food', quantity: 100 }],
      needs: [{ item: 'Soup', category: 'food', quantity: 10 }],
    })
    expect(scanNetworkForMatches([node], [node])).toEqual([])
  })

  it('finds matches across network', () => {
    const supply = makeNode({
      id: 1,
      inventory: [{ item: 'Rice', category: 'food', quantity: 200 }],
      location: { ...clearwaterGeo },
    })
    const demand = makeNode({
      id: 2,
      needs: [{ item: 'Rice', category: 'food', quantity: 50 }],
      location: { ...tampaGeo },
    })
    const proposals = scanNetworkForMatches([supply], [demand])
    expect(proposals.length).toBeGreaterThan(0)
    expect(proposals[0].origin.id).toBe(1)
    expect(proposals[0].destination.id).toBe(2)
  })

  it('sorts SOS before standard', () => {
    const supply = makeNode({
      id: 1,
      inventory: [
        { item: 'Food', category: 'food', quantity: 500 },
        { item: 'Meds', category: 'medicine', quantity: 100 },
      ],
      location: { ...clearwaterGeo },
    })
    const standard = makeNode({
      id: 2,
      needs: [{ item: 'Food', category: 'food', quantity: 10, urgency: 'standard' }],
      location: { ...tampaGeo },
    })
    const sos = makeNode({
      id: 3,
      needs: [{ item: 'Meds', category: 'medicine', quantity: 5, urgency: 'sos' }],
      location: { ...tampaGeo },
    })
    const proposals = scanNetworkForMatches([supply], [standard, sos])
    expect(proposals.length).toBe(2)
    expect(proposals[0].priority).toBe('sos')
  })

  it('respects maxProposals', () => {
    const supply = makeNode({
      id: 1,
      inventory: [{ item: 'Water', category: 'food', quantity: 10000 }],
      location: { ...clearwaterGeo },
    })
    const demands = Array.from({ length: 10 }, (_, i) =>
      makeNode({
        id: i + 2,
        needs: [{ item: 'Water', category: 'food', quantity: 10 }],
        location: { ...tampaGeo },
      }),
    )
    const proposals = scanNetworkForMatches([supply], demands, { maxProposals: 3 })
    expect(proposals.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Constants', () => {
  it('MIN_AUTO_MATCH_SCORE is reasonable', () => {
    expect(MIN_AUTO_MATCH_SCORE).toBeGreaterThan(0)
    expect(MIN_AUTO_MATCH_SCORE).toBeLessThanOrEqual(50)
  })

  it('TRANSPORT_WEIGHTS sum to 1', () => {
    const sum = Object.values(TRANSPORT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })
})
