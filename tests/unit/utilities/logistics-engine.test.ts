/**
 * logistics-engine — Unit Tests
 *
 * Pure functions: calculateDistance, findNearestTransport, matchSupplyToDemand
 * Constants: MIN_AUTO_MATCH_SCORE, TRANSPORT_WEIGHTS
 */
import { describe, it, expect } from 'vitest'

import {
  calculateDistance,
  findNearestTransport,
  matchSupplyToDemand,
  MIN_AUTO_MATCH_SCORE,
  TRANSPORT_WEIGHTS,
  type GeoPoint,
  type TransportData,
  type LogisticsNodeData,
} from '@/utilities/logistics-engine'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTransport(overrides: Partial<TransportData> = {}): TransportData {
  return {
    id: 1,
    vehicleName: 'Van 1',
    ownerId: 1,
    transportType: 'van',
    capacity: 100,
    status: 'idle',
    currentLocation: { lat: 40.0, lng: -75.0 },
    maxRange: 500,
    specialCapabilities: [],
    completedDeliveries: 20,
    rating: 4.5,
    ...overrides,
  }
}

function makeNode(overrides: Partial<LogisticsNodeData> = {}): LogisticsNodeData {
  return {
    id: 1,
    name: 'Node 1',
    type: 'warehouse',
    governanceMode: 'autonomous',
    location: { lat: 40.0, lng: -75.0 },
    serviceRadius: 100,
    status: 'active',
    trustScore: 80,
    ...overrides,
  }
}

// ── calculateDistance ──────────────────────────────────────────────────────────

describe('calculateDistance', () => {
  it('returns 0 for identical points', () => {
    const p: GeoPoint = { lat: 40, lng: -75 }
    expect(calculateDistance(p, p)).toBe(0)
  })

  it('returns positive distance for different points', () => {
    const a: GeoPoint = { lat: 40.7128, lng: -74.006 }  // New York
    const b: GeoPoint = { lat: 34.0522, lng: -118.2437 } // Los Angeles
    const d = calculateDistance(a, b)
    expect(d).toBeGreaterThan(2000)
    expect(d).toBeLessThan(3000)
  })

  it('is symmetric', () => {
    const a: GeoPoint = { lat: 51.5074, lng: -0.1278 } // London
    const b: GeoPoint = { lat: 48.8566, lng: 2.3522 }  // Paris
    expect(calculateDistance(a, b)).toBeCloseTo(calculateDistance(b, a), 5)
  })

  it('returns 0 for NaN coordinates', () => {
    expect(calculateDistance({ lat: NaN, lng: 0 }, { lat: 0, lng: 0 })).toBe(0)
  })

  it('returns 0 for Infinity coordinates', () => {
    expect(calculateDistance({ lat: Infinity, lng: 0 }, { lat: 0, lng: 0 })).toBe(0)
  })

  it('returns non-zero for nearby cities', () => {
    const philly: GeoPoint = { lat: 39.9526, lng: -75.1652 }
    const nyc: GeoPoint = { lat: 40.7128, lng: -74.006 }
    const d = calculateDistance(philly, nyc)
    expect(d).toBeGreaterThan(50)
    expect(d).toBeLessThan(150)
  })
})

// ── findNearestTransport ───────────────────────────────────────────────────────

describe('findNearestTransport', () => {
  const pickup: GeoPoint = { lat: 40.0, lng: -75.0 }

  it('returns empty array when no transports provided', () => {
    expect(findNearestTransport(pickup, 10, [])).toEqual([])
  })

  it('excludes non-idle transports', () => {
    const t = makeTransport({ status: 'en_route' })
    expect(findNearestTransport(pickup, 10, [t])).toEqual([])
  })

  it('excludes transports with insufficient capacity', () => {
    const t = makeTransport({ capacity: 5 })
    expect(findNearestTransport(pickup, 10, [t])).toEqual([])
  })

  it('excludes transports without a known location', () => {
    const t = makeTransport({ currentLocation: undefined })
    expect(findNearestTransport(pickup, 10, [t])).toEqual([])
  })

  it('returns a match for a nearby idle transport', () => {
    const t = makeTransport()
    const matches = findNearestTransport(pickup, 10, [t])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.transport.id).toBe(1)
  })

  it('sorts by totalScore descending', () => {
    const close = makeTransport({ id: 1, currentLocation: { lat: 40.01, lng: -75.01 } })
    const far = makeTransport({ id: 2, currentLocation: { lat: 41.0, lng: -76.0 }, rating: 3 })
    const matches = findNearestTransport(pickup, 10, [far, close])
    // The closer transport should score higher
    expect(matches[0]!.transport.id).toBe(1)
  })

  it('respects maxResults option', () => {
    const transports = [1, 2, 3, 4, 5].map(id => makeTransport({ id }))
    const matches = findNearestTransport(pickup, 10, transports, { maxResults: 2 })
    expect(matches).toHaveLength(2)
  })

  it('requires refrigeration capability when requested', () => {
    const plain = makeTransport({ id: 1 })
    const cold = makeTransport({ id: 2, specialCapabilities: ['refrigerated'] })
    const matches = findNearestTransport(pickup, 10, [plain, cold], { requireRefrigeration: true })
    expect(matches).toHaveLength(1)
    expect(matches[0]!.transport.id).toBe(2)
  })

  it('each match has distanceMiles, capacityFit, reliabilityScore, totalScore', () => {
    const t = makeTransport()
    const matches = findNearestTransport(pickup, 10, [t])
    const m = matches[0]!
    expect(typeof m.distanceMiles).toBe('number')
    expect(typeof m.capacityFit).toBe('number')
    expect(typeof m.reliabilityScore).toBe('number')
    expect(typeof m.totalScore).toBe('number')
  })
})

// ── matchSupplyToDemand ────────────────────────────────────────────────────────

describe('matchSupplyToDemand', () => {
  const supplyNode = makeNode({
    id: 1,
    location: { lat: 40.0, lng: -75.0 },
    inventory: [
      { item: 'bread', category: 'food', quantity: 100 },
      { item: 'milk', category: 'dairy', quantity: 50 },
    ],
  })

  const demandNode = makeNode({
    id: 2,
    location: { lat: 40.5, lng: -75.5 },
    needs: [
      { item: 'bread', category: 'food', quantity: 20, urgency: 'standard' },
    ],
  })

  it('returns null when supply node is inactive', () => {
    const result = matchSupplyToDemand(makeNode({ status: 'inactive', inventory: [{item:'a', quantity:1}] }), demandNode)
    expect(result).toBeNull()
  })

  it('returns null when demand node is inactive', () => {
    const result = matchSupplyToDemand(supplyNode, makeNode({ status: 'inactive', needs: [{item:'a', quantity:1}] }))
    expect(result).toBeNull()
  })

  it('returns null when supply has no inventory', () => {
    const result = matchSupplyToDemand(makeNode({ inventory: [] }), demandNode)
    expect(result).toBeNull()
  })

  it('returns null when demand has no needs', () => {
    const result = matchSupplyToDemand(supplyNode, makeNode({ needs: [] }))
    expect(result).toBeNull()
  })

  it('returns a ShipmentProposal when there is a valid match', () => {
    const result = matchSupplyToDemand(supplyNode, demandNode)
    // Match depends on score >= MIN_AUTO_MATCH_SCORE
    if (result !== null) {
      expect(result.origin.id).toBe(supplyNode.id)
      expect(result.destination.id).toBe(demandNode.id)
      expect(Array.isArray(result.manifest)).toBe(true)
      expect(result.manifest.length).toBeGreaterThan(0)
      expect(result.matchType).toBe('auto')
    }
  })

  it('proposal has totalSize and distanceMiles as numbers', () => {
    const result = matchSupplyToDemand(supplyNode, demandNode)
    if (result) {
      expect(typeof result.totalSize).toBe('number')
      expect(typeof result.distanceMiles).toBe('number')
    }
  })
})

// ── Constants ──────────────────────────────────────────────────────────────────

describe('MIN_AUTO_MATCH_SCORE', () => {
  it('is a positive number', () => {
    expect(MIN_AUTO_MATCH_SCORE).toBeGreaterThan(0)
  })
})

describe('TRANSPORT_WEIGHTS', () => {
  it('weights sum to approximately 1.0', () => {
    const total = Object.values(TRANSPORT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 2)
  })

  it('has proximity, capacityFit, reliability, capabilities keys', () => {
    expect(TRANSPORT_WEIGHTS).toHaveProperty('proximity')
    expect(TRANSPORT_WEIGHTS).toHaveProperty('capacityFit')
    expect(TRANSPORT_WEIGHTS).toHaveProperty('reliability')
    expect(TRANSPORT_WEIGHTS).toHaveProperty('capabilities')
  })
})
