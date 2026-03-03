/**
 * pheromone-engine — Unit Tests
 *
 * Pure functions: hashContext, calculateStrength, calculateDecayDate, ageInDays
 */
import { describe, it, expect } from 'vitest'

import {
  hashContext,
  calculateStrength,
  calculateDecayDate,
  ageInDays,
  PHEROMONE_MAX_STRENGTH,
  PHEROMONE_TRAVERSAL_WEIGHT,
  PHEROMONE_DEFAULT_TTL_DAYS,
} from '@/utilities/pheromone-engine'

// ── hashContext ────────────────────────────────────────────────────────────────

describe('hashContext', () => {
  it('returns a string starting with ph_', () => {
    const hash = hashContext({ query: 'booking' })
    expect(hash.startsWith('ph_')).toBe(true)
  })

  it('is deterministic for the same context', () => {
    const ctx = { query: 'booking', tenantSlug: 'clearwater' }
    expect(hashContext(ctx)).toBe(hashContext(ctx))
  })

  it('produces different hashes for different queries', () => {
    expect(hashContext({ query: 'booking' })).not.toBe(hashContext({ query: 'payment' }))
  })

  it('normalises query — different word orders produce same hash', () => {
    // After normalisation, "booking space" and "space booking" become the same sorted tokens
    const a = hashContext({ query: 'booking space' })
    const b = hashContext({ query: 'space booking' })
    expect(a).toBe(b)
  })

  it('strips stopwords from query', () => {
    // "the booking" and "booking" should hash identically (stopword "the" is stripped)
    expect(hashContext({ query: 'the booking' })).toBe(hashContext({ query: 'booking' }))
  })

  it('includes tenantSlug in the hash', () => {
    const a = hashContext({ query: 'booking', tenantSlug: 'clearwater' })
    const b = hashContext({ query: 'booking', tenantSlug: 'kendev' })
    expect(a).not.toBe(b)
  })

  it('includes toolName in the hash', () => {
    const a = hashContext({ query: 'booking', toolName: 'create_booking' })
    const b = hashContext({ query: 'booking', toolName: 'list_bookings' })
    expect(a).not.toBe(b)
  })
})

// ── calculateStrength ──────────────────────────────────────────────────────────

describe('calculateStrength', () => {
  it('returns 0 for zero traversals', () => {
    expect(calculateStrength(0, 0, 0)).toBe(0)
  })

  it('returns 0 for negative traversals', () => {
    expect(calculateStrength(-5, 0, 0)).toBe(0)
  })

  it('returns max strength for many traversals at age 0 with no abandonments', () => {
    const strength = calculateStrength(20, 0, 0)
    expect(strength).toBe(PHEROMONE_MAX_STRENGTH)
  })

  it('returns exactly TRAVERSAL_WEIGHT × n at age 0 when below max', () => {
    const traversals = 3
    const strength = calculateStrength(traversals, 0, 0)
    expect(strength).toBe(traversals * PHEROMONE_TRAVERSAL_WEIGHT)
  })

  it('decays over time', () => {
    const fresh = calculateStrength(10, 0, 0)
    const aged = calculateStrength(10, 30, 0)
    expect(aged).toBeLessThan(fresh)
  })

  it('reduces strength with abandonments', () => {
    const clean = calculateStrength(5, 0, 0)
    const abandoned = calculateStrength(5, 0, 5)
    expect(abandoned).toBeLessThan(clean)
  })

  it('returns a non-negative integer', () => {
    const strength = calculateStrength(5, 100, 2)
    expect(strength).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(strength)).toBe(true)
  })

  it('returns 0 for infinite age', () => {
    expect(calculateStrength(10, Infinity, 0)).toBe(0)
  })
})

// ── calculateDecayDate ─────────────────────────────────────────────────────────

describe('calculateDecayDate', () => {
  it('returns an ISO date string', () => {
    const date = calculateDecayDate(new Date())
    expect(() => new Date(date)).not.toThrow()
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it(`is ${PHEROMONE_DEFAULT_TTL_DAYS} days in the future`, () => {
    const base = new Date('2025-01-01T00:00:00.000Z')
    const decay = calculateDecayDate(base)
    const diff = (new Date(decay).getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
    expect(Math.round(diff)).toBe(PHEROMONE_DEFAULT_TTL_DAYS)
  })
})

// ── ageInDays ─────────────────────────────────────────────────────────────────

describe('ageInDays', () => {
  it('returns 0 for a timestamp equal to now', () => {
    const now = new Date('2025-06-01T12:00:00Z')
    expect(ageInDays(now.toISOString(), now)).toBe(0)
  })

  it('returns ~1 for a timestamp 24 hours ago', () => {
    const now = new Date('2025-06-02T12:00:00Z')
    const yesterday = new Date('2025-06-01T12:00:00Z').toISOString()
    const age = ageInDays(yesterday, now)
    expect(age).toBeCloseTo(1, 5)
  })

  it('returns 0 (clamped) for a future timestamp', () => {
    const now = new Date('2025-06-01T00:00:00Z')
    const future = new Date('2025-07-01T00:00:00Z').toISOString()
    expect(ageInDays(future, now)).toBe(0)
  })
})
