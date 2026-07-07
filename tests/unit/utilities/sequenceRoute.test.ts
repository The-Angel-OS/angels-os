import { describe, it, expect } from 'vitest'
import { sequenceRoute, type RouteStop } from '@/utilities/sequenceRoute'

// A few points roughly along a line east of an origin, given out of order.
const ORIGIN = { lat: 40.0, lng: -80.0 }
const stops: RouteStop[] = [
  { id: 'c', label: 'C (far)', lat: 40.0, lng: -79.7 },
  { id: 'a', label: 'A (near)', lat: 40.0, lng: -79.95 },
  { id: 'b', label: 'B (mid)', lat: 40.0, lng: -79.85 },
]

describe('sequenceRoute', () => {
  it('orders stops nearest-first from the origin', () => {
    const r = sequenceRoute(ORIGIN, stops)
    expect(r.stops.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(r.stops[0]!.order).toBe(1)
    expect(r.totalMiles).toBeGreaterThan(0)
    expect(r.estMinutes).toBeGreaterThan(0)
  })

  it('cumulative miles are monotonic non-decreasing', () => {
    const r = sequenceRoute(ORIGIN, stops)
    for (let i = 1; i < r.stops.length; i++) {
      expect(r.stops[i]!.cumulativeMiles).toBeGreaterThanOrEqual(r.stops[i - 1]!.cumulativeMiles)
    }
  })

  it('pulls a higher-priority stop to the front even if farther', () => {
    const withPriority: RouteStop[] = [
      { id: 'near', label: 'near', lat: 40.0, lng: -79.98 },
      { id: 'urgent', label: 'urgent', lat: 40.0, lng: -79.5, priority: 10 },
    ]
    const r = sequenceRoute(ORIGIN, withPriority)
    expect(r.stops[0]!.id).toBe('urgent')
  })

  it('ignores stops with invalid coordinates', () => {
    const withBad: RouteStop[] = [
      ...stops,
      { id: 'bad', label: 'bad', lat: NaN, lng: -79.0 },
    ]
    const r = sequenceRoute(ORIGIN, withBad)
    expect(r.stops.map((s) => s.id)).not.toContain('bad')
    expect(r.stops).toHaveLength(3)
  })

  it('handles an empty stop list', () => {
    const r = sequenceRoute(ORIGIN, [])
    expect(r.stops).toEqual([])
    expect(r.totalMiles).toBe(0)
  })
})
