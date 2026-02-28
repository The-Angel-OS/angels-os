/**
 * Pheromone Engine Tests — Sprint 29
 *
 * Tests for the swarm intelligence layer. Every function in pheromone-engine.ts
 * is a pure function — no DB, no network, no side effects. Just math and strings.
 *
 * @see src/utilities/pheromone-engine.ts
 */

import { describe, it, expect } from 'vitest'
import {
  hashContext,
  calculateStrength,
  calculateDecayDate,
  ageInDays,
  buildTraversal,
  applyDecay,
  rankPaths,
  recordAbandonment,
  shouldCircuitBreak,
  PHEROMONE_HALF_LIFE_DAYS,
  PHEROMONE_DECAY_CONSTANT,
  PHEROMONE_MAX_STRENGTH,
  PHEROMONE_TRAVERSAL_WEIGHT,
  PHEROMONE_ABANDONMENT_PENALTY,
  PHEROMONE_DEFAULT_TTL_DAYS,
  PHEROMONE_DECAY_THRESHOLD,
  MAX_NAVIGATION_HOPS_PER_CONVERSATION,
} from '../../../src/utilities/pheromone-engine'
import type { PheromoneData, PheromoneContext } from '../../../src/utilities/pheromone-engine'

// ---------------------------------------------------------------------------
// hashContext
// ---------------------------------------------------------------------------

describe('hashContext', () => {
  it('produces identical hashes for identical inputs', () => {
    const ctx: PheromoneContext = { query: 'emergency food clearwater' }
    expect(hashContext(ctx)).toBe(hashContext(ctx))
  })

  it('produces identical hashes regardless of word order (normalization)', () => {
    const a = hashContext({ query: 'emergency food clearwater' })
    const b = hashContext({ query: 'clearwater food emergency' })
    expect(a).toBe(b)
  })

  it('produces identical hashes regardless of case', () => {
    const a = hashContext({ query: 'Emergency FOOD Clearwater' })
    const b = hashContext({ query: 'emergency food clearwater' })
    expect(a).toBe(b)
  })

  it('strips stopwords from the hash', () => {
    const a = hashContext({ query: 'find the food in the clearwater area' })
    const b = hashContext({ query: 'food clearwater area find' })
    expect(a).toBe(b)
  })

  it('strips punctuation from the hash', () => {
    const a = hashContext({ query: 'food, clearwater! area?' })
    const b = hashContext({ query: 'food clearwater area' })
    expect(a).toBe(b)
  })

  it('different queries produce different hashes', () => {
    const a = hashContext({ query: 'emergency food clearwater' })
    const b = hashContext({ query: 'luxury clothing tampa' })
    expect(a).not.toBe(b)
  })

  it('includes toolName in hash when present', () => {
    const a = hashContext({ query: 'create product', toolName: 'create_product' })
    const b = hashContext({ query: 'create product' })
    expect(a).not.toBe(b)
  })

  it('includes tenantSlug in hash when present', () => {
    const a = hashContext({ query: 'create product', tenantSlug: 'mercy-mission' })
    const b = hashContext({ query: 'create product', tenantSlug: 'soul-fleet' })
    expect(a).not.toBe(b)
  })

  it('handles empty query gracefully', () => {
    const result = hashContext({ query: '' })
    expect(result).toMatch(/^ph_[0-9a-f]{8}$/)
  })

  it('handles whitespace-only query', () => {
    const result = hashContext({ query: '   ' })
    expect(result).toMatch(/^ph_[0-9a-f]{8}$/)
  })

  it('returns a string starting with ph_', () => {
    const result = hashContext({ query: 'test query' })
    expect(result).toMatch(/^ph_[0-9a-f]{8}$/)
  })

  it('includes additionalContext in hash when present', () => {
    const a = hashContext({ query: 'food', additionalContext: 'urgent' })
    const b = hashContext({ query: 'food' })
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// calculateStrength
// ---------------------------------------------------------------------------

describe('calculateStrength', () => {
  it('returns 0 for 0 traversals', () => {
    expect(calculateStrength(0, 0, 0)).toBe(0)
  })

  it('returns 0 for negative traversals', () => {
    expect(calculateStrength(-1, 0, 0)).toBe(0)
  })

  it('returns TRAVERSAL_WEIGHT for 1 traversal at age 0', () => {
    expect(calculateStrength(1, 0, 0)).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
  })

  it('returns MAX_STRENGTH for 10 traversals at age 0', () => {
    expect(calculateStrength(10, 0, 0)).toBe(PHEROMONE_MAX_STRENGTH)
  })

  it('caps at MAX_STRENGTH for 15+ traversals at age 0', () => {
    expect(calculateStrength(15, 0, 0)).toBe(PHEROMONE_MAX_STRENGTH)
    expect(calculateStrength(100, 0, 0)).toBe(PHEROMONE_MAX_STRENGTH)
  })

  it('decays at half-life (~50% at 21 days)', () => {
    const strength = calculateStrength(10, PHEROMONE_HALF_LIFE_DAYS, 0)
    // exp(-21/30) ≈ 0.4966
    expect(strength).toBeGreaterThan(40)
    expect(strength).toBeLessThan(60)
  })

  it('decays significantly at 60 days', () => {
    const strength = calculateStrength(10, 60, 0)
    // exp(-60/30) ≈ 0.1353
    expect(strength).toBeLessThan(20)
  })

  it('near zero at 120 days', () => {
    const strength = calculateStrength(10, 120, 0)
    // exp(-120/30) ≈ 0.0183
    expect(strength).toBeLessThanOrEqual(2)
  })

  it('handles negative age as 0 (no future-decay)', () => {
    const strength = calculateStrength(5, -10, 0)
    expect(strength).toBe(calculateStrength(5, 0, 0))
  })

  it('abandonment at 50% ratio reduces strength', () => {
    // 10 traversals, 10 abandonments = 50% ratio → penalty = 0.5 * 0.5 = 0.25 → factor 0.75
    const withAbandon = calculateStrength(10, 0, 10)
    const without = calculateStrength(10, 0, 0)
    expect(withAbandon).toBeLessThan(without)
    // 100 * 0.75 = 75
    expect(withAbandon).toBe(75)
  })

  it('100% abandonment ratio halves the effective strength', () => {
    // 5 traversals, but ratio is 5/(5+abandoned)
    // If abandonments equal traversals: ratio = 0.5, factor = 0.75
    // Actually at 100% we need ALL to be abandonments: impossible since traversals > 0
    // Let's test extreme ratio: 1 traversal, 99 abandonments
    // ratio = 99/100 = 0.99, factor = 1 - 0.99 * 0.5 = 0.505
    const strength = calculateStrength(1, 0, 99)
    expect(strength).toBe(Math.round(10 * 0.505)) // 5
  })

  it('0 abandonments means no penalty', () => {
    const strength = calculateStrength(5, 0, 0)
    expect(strength).toBe(50)
  })

  it('never returns below 0', () => {
    const strength = calculateStrength(1, 1000, 1000)
    expect(strength).toBeGreaterThanOrEqual(0)
  })

  it('combined decay and abandonment', () => {
    // 5 traversals (50 raw), age 21 days (≈0.497 decay), 5 abandonments (ratio 0.5, factor 0.75)
    const strength = calculateStrength(5, 21, 5)
    const expected = Math.round(50 * Math.exp(-21 / PHEROMONE_DECAY_CONSTANT) * 0.75)
    expect(strength).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// calculateDecayDate
// ---------------------------------------------------------------------------

describe('calculateDecayDate', () => {
  it('returns a date 90 days in the future', () => {
    const base = new Date('2025-01-01T00:00:00Z')
    const result = calculateDecayDate(base)
    const decay = new Date(result)
    const diffDays = (decay.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(PHEROMONE_DEFAULT_TTL_DAYS, 0)
  })

  it('returns a valid ISO string', () => {
    const result = calculateDecayDate()
    expect(new Date(result).toISOString()).toBe(result)
  })

  it('uses current date when no argument provided', () => {
    const before = new Date()
    const result = calculateDecayDate()
    const after = new Date()
    const decay = new Date(result)
    const minDays = (decay.getTime() - after.getTime()) / (1000 * 60 * 60 * 24)
    const maxDays = (decay.getTime() - before.getTime()) / (1000 * 60 * 60 * 24)
    expect(minDays).toBeGreaterThanOrEqual(PHEROMONE_DEFAULT_TTL_DAYS - 1)
    expect(maxDays).toBeLessThanOrEqual(PHEROMONE_DEFAULT_TTL_DAYS + 1)
  })
})

// ---------------------------------------------------------------------------
// ageInDays
// ---------------------------------------------------------------------------

describe('ageInDays', () => {
  it('returns 0 for same date', () => {
    const now = new Date()
    expect(ageInDays(now.toISOString(), now)).toBe(0)
  })

  it('returns 1 for a date 24 hours ago', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    expect(ageInDays(yesterday.toISOString(), now)).toBeCloseTo(1, 1)
  })

  it('returns 0 for future dates (no negative age)', () => {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    expect(ageInDays(tomorrow.toISOString(), now)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildTraversal
// ---------------------------------------------------------------------------

describe('buildTraversal', () => {
  const ctx: PheromoneContext = { query: 'create product', toolName: 'create_product' }
  const path = '/dashboard/products'
  const now = new Date('2025-06-15T12:00:00Z')

  it('creates a new pheromone when existing is null', () => {
    const result = buildTraversal(null, ctx, path, now)
    expect(result.isNew).toBe(true)
    expect(result.pheromone.strength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
    expect(result.pheromone.successfulTraversals).toBe(1)
    expect(result.pheromone.abandonments).toBe(0)
    expect(result.pheromone.path).toBe(path)
    expect(result.pheromone.toolName).toBe('create_product')
    expect(result.previousStrength).toBe(0)
    expect(result.newStrength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
  })

  it('sets contextHash from context', () => {
    const result = buildTraversal(null, ctx, path, now)
    expect(result.pheromone.contextHash).toBe(hashContext(ctx))
  })

  it('sets lastTraversedAt to now', () => {
    const result = buildTraversal(null, ctx, path, now)
    expect(result.pheromone.lastTraversedAt).toBe(now.toISOString())
  })

  it('sets decay date for new pheromone', () => {
    const result = buildTraversal(null, ctx, path, now)
    expect(result.pheromone.decay).toBeTruthy()
    const decayDate = new Date(result.pheromone.decay!)
    const diffDays = (decayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(PHEROMONE_DEFAULT_TTL_DAYS, 0)
  })

  it('strengthens existing pheromone', () => {
    const existing: PheromoneData = {
      id: 1,
      contextHash: hashContext(ctx),
      path,
      toolName: 'create_product',
      strength: 10,
      successfulTraversals: 1,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }

    const result = buildTraversal(existing, ctx, path, now)
    expect(result.isNew).toBe(false)
    expect(result.pheromone.successfulTraversals).toBe(2)
    expect(result.previousStrength).toBe(10)
    expect(result.newStrength).toBe(20) // 2 traversals * 10 = 20 at age 0
  })

  it('accounts for age when strengthening', () => {
    const createdAt = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000) // 21 days ago
    const existing: PheromoneData = {
      id: 1,
      contextHash: hashContext(ctx),
      path,
      toolName: 'create_product',
      strength: 50,
      successfulTraversals: 5,
      abandonments: 0,
      lastTraversedAt: createdAt.toISOString(),
      createdAt: createdAt.toISOString(),
    }

    const result = buildTraversal(existing, ctx, path, now)
    expect(result.pheromone.successfulTraversals).toBe(6)
    // 6 traversals (60 raw) * exp(-21/30) ≈ 60 * 0.497 ≈ 30
    expect(result.newStrength).toBeGreaterThan(25)
    expect(result.newStrength).toBeLessThan(35)
  })

  it('refreshes lastTraversedAt on existing', () => {
    const oldDate = new Date('2024-01-01T00:00:00Z')
    const existing: PheromoneData = {
      id: 1,
      contextHash: hashContext(ctx),
      path,
      strength: 10,
      successfulTraversals: 1,
      abandonments: 0,
      lastTraversedAt: oldDate.toISOString(),
      createdAt: oldDate.toISOString(),
    }

    const result = buildTraversal(existing, ctx, path, now)
    expect(result.pheromone.lastTraversedAt).toBe(now.toISOString())
  })

  it('refreshes decay date on existing', () => {
    const existing: PheromoneData = {
      id: 1,
      contextHash: hashContext(ctx),
      path,
      strength: 10,
      successfulTraversals: 1,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
      decay: new Date('2025-01-01').toISOString(),
    }

    const result = buildTraversal(existing, ctx, path, now)
    const decayDate = new Date(result.pheromone.decay!)
    const diffDays = (decayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(PHEROMONE_DEFAULT_TTL_DAYS, 0)
  })
})

// ---------------------------------------------------------------------------
// applyDecay
// ---------------------------------------------------------------------------

describe('applyDecay', () => {
  const now = new Date('2025-06-15T12:00:00Z')

  it('fresh pheromones pass through as updated', () => {
    const pheromones: PheromoneData[] = [
      {
        contextHash: 'ph_test1',
        path: '/dashboard/products',
        strength: 50,
        successfulTraversals: 5,
        abandonments: 0,
        lastTraversedAt: now.toISOString(),
        createdAt: now.toISOString(),
      },
    ]

    const { updated, expired } = applyDecay(pheromones, now)
    expect(updated).toHaveLength(1)
    expect(expired).toHaveLength(0)
    expect(updated[0].strength).toBe(50) // age 0, no decay
  })

  it('old pheromones get reduced strength', () => {
    const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
    const pheromones: PheromoneData[] = [
      {
        contextHash: 'ph_test2',
        path: '/dashboard/bookings',
        strength: 50, // will be recalculated
        successfulTraversals: 5,
        abandonments: 0,
        lastTraversedAt: oldDate.toISOString(),
        createdAt: oldDate.toISOString(),
      },
    ]

    const { updated, expired } = applyDecay(pheromones, now)
    expect(updated).toHaveLength(1)
    expect(expired).toHaveLength(0)
    expect(updated[0].strength).toBeLessThan(50)
    expect(updated[0].strength).toBeGreaterThan(0)
  })

  it('very old pheromones go to expired list', () => {
    const veryOldDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
    const pheromones: PheromoneData[] = [
      {
        contextHash: 'ph_test3',
        path: '/dashboard/orders',
        strength: 10,
        successfulTraversals: 1,
        abandonments: 0,
        lastTraversedAt: veryOldDate.toISOString(),
        createdAt: veryOldDate.toISOString(),
      },
    ]

    const { updated, expired } = applyDecay(pheromones, now)
    expect(expired).toHaveLength(1)
    expect(updated).toHaveLength(0)
  })

  it('empty input returns empty output', () => {
    const { updated, expired } = applyDecay([], now)
    expect(updated).toHaveLength(0)
    expect(expired).toHaveLength(0)
  })

  it('mixed ages correctly separated', () => {
    const fresh = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    const veryOld = new Date(now.getTime() - 500 * 24 * 60 * 60 * 1000) // 500 days ago

    const pheromones: PheromoneData[] = [
      {
        contextHash: 'ph_fresh',
        path: '/dashboard/products',
        strength: 50,
        successfulTraversals: 5,
        abandonments: 0,
        lastTraversedAt: fresh.toISOString(),
        createdAt: fresh.toISOString(),
      },
      {
        contextHash: 'ph_ancient',
        path: '/dashboard/bookings',
        strength: 10,
        successfulTraversals: 1,
        abandonments: 0,
        lastTraversedAt: veryOld.toISOString(),
        createdAt: veryOld.toISOString(),
      },
    ]

    const { updated, expired } = applyDecay(pheromones, now)
    expect(updated).toHaveLength(1)
    expect(expired).toHaveLength(1)
    expect(updated[0].contextHash).toBe('ph_fresh')
    expect(expired[0].contextHash).toBe('ph_ancient')
  })
})

// ---------------------------------------------------------------------------
// rankPaths
// ---------------------------------------------------------------------------

describe('rankPaths', () => {
  it('sorts by strength descending', () => {
    const pheromones: PheromoneData[] = [
      { contextHash: 'a', path: '/a', strength: 30, successfulTraversals: 3, abandonments: 0, lastTraversedAt: '2025-01-01' },
      { contextHash: 'b', path: '/b', strength: 80, successfulTraversals: 8, abandonments: 0, lastTraversedAt: '2025-01-01' },
      { contextHash: 'c', path: '/c', strength: 50, successfulTraversals: 5, abandonments: 0, lastTraversedAt: '2025-01-01' },
    ]

    const ranked = rankPaths(pheromones)
    expect(ranked[0].path).toBe('/b')
    expect(ranked[1].path).toBe('/c')
    expect(ranked[2].path).toBe('/a')
  })

  it('deduplicates by path (keeps strongest)', () => {
    const pheromones: PheromoneData[] = [
      { contextHash: 'a', path: '/products', strength: 30, successfulTraversals: 3, abandonments: 0, lastTraversedAt: '2025-01-01' },
      { contextHash: 'b', path: '/products', strength: 80, successfulTraversals: 8, abandonments: 0, lastTraversedAt: '2025-01-01' },
      { contextHash: 'c', path: '/bookings', strength: 50, successfulTraversals: 5, abandonments: 0, lastTraversedAt: '2025-01-01' },
    ]

    const ranked = rankPaths(pheromones)
    expect(ranked).toHaveLength(2)
    expect(ranked[0].path).toBe('/products')
    expect(ranked[0].strength).toBe(80)
    expect(ranked[1].path).toBe('/bookings')
  })

  it('limits results to N', () => {
    const pheromones: PheromoneData[] = Array.from({ length: 10 }, (_, i) => ({
      contextHash: `h${i}`,
      path: `/path${i}`,
      strength: (i + 1) * 10,
      successfulTraversals: i + 1,
      abandonments: 0,
      lastTraversedAt: '2025-01-01',
    }))

    const ranked = rankPaths(pheromones, 3)
    expect(ranked).toHaveLength(3)
    expect(ranked[0].strength).toBe(100)
  })

  it('returns empty array for empty input', () => {
    expect(rankPaths([])).toHaveLength(0)
  })

  it('includes toolName in recommendations', () => {
    const pheromones: PheromoneData[] = [
      { contextHash: 'a', path: '/products', toolName: 'create_product', strength: 80, successfulTraversals: 8, abandonments: 0, lastTraversedAt: '2025-01-01' },
    ]

    const ranked = rankPaths(pheromones)
    expect(ranked[0].toolName).toBe('create_product')
  })

  it('defaults to limit of 5', () => {
    const pheromones: PheromoneData[] = Array.from({ length: 10 }, (_, i) => ({
      contextHash: `h${i}`,
      path: `/path${i}`,
      strength: (i + 1) * 10,
      successfulTraversals: i + 1,
      abandonments: 0,
      lastTraversedAt: '2025-01-01',
    }))

    const ranked = rankPaths(pheromones)
    expect(ranked).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------
// recordAbandonment
// ---------------------------------------------------------------------------

describe('recordAbandonment', () => {
  const now = new Date('2025-06-15T12:00:00Z')

  it('increments abandonment counter', () => {
    const existing: PheromoneData = {
      contextHash: 'ph_test',
      path: '/dashboard/products',
      strength: 50,
      successfulTraversals: 5,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }

    const result = recordAbandonment(existing, now)
    expect(result.abandonments).toBe(1)
  })

  it('recalculates strength downward', () => {
    const existing: PheromoneData = {
      contextHash: 'ph_test',
      path: '/dashboard/products',
      strength: 50,
      successfulTraversals: 5,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }

    const result = recordAbandonment(existing, now)
    expect(result.strength).toBeLessThan(50)
  })

  it('accumulates abandonments over multiple calls', () => {
    let current: PheromoneData = {
      contextHash: 'ph_test',
      path: '/dashboard/products',
      strength: 50,
      successfulTraversals: 5,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }

    current = recordAbandonment(current, now)
    current = recordAbandonment(current, now)
    current = recordAbandonment(current, now)

    expect(current.abandonments).toBe(3)
    expect(current.strength).toBeLessThan(50)
  })

  it('does not go below 0', () => {
    const existing: PheromoneData = {
      contextHash: 'ph_test',
      path: '/dashboard/products',
      strength: 1,
      successfulTraversals: 1,
      abandonments: 99,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }

    const result = recordAbandonment(existing, now)
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })

  it('preserves other fields', () => {
    const existing: PheromoneData = {
      id: 42,
      contextHash: 'ph_test',
      path: '/dashboard/products',
      toolName: 'create_product',
      strength: 50,
      successfulTraversals: 5,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }

    const result = recordAbandonment(existing, now)
    expect(result.id).toBe(42)
    expect(result.contextHash).toBe('ph_test')
    expect(result.path).toBe('/dashboard/products')
    expect(result.toolName).toBe('create_product')
    expect(result.successfulTraversals).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// shouldCircuitBreak
// ---------------------------------------------------------------------------

describe('shouldCircuitBreak', () => {
  it('returns false at 0 hops', () => {
    expect(shouldCircuitBreak(0)).toBe(false)
  })

  it('returns false at 1 hop', () => {
    expect(shouldCircuitBreak(1)).toBe(false)
  })

  it('returns false at 4 hops (just below limit)', () => {
    expect(shouldCircuitBreak(4)).toBe(false)
  })

  it('returns true at 5 hops (at limit)', () => {
    expect(shouldCircuitBreak(5)).toBe(true)
  })

  it('returns true at 10 hops (above limit)', () => {
    expect(shouldCircuitBreak(10)).toBe(true)
  })

  it('uses MAX_NAVIGATION_HOPS_PER_CONVERSATION constant', () => {
    expect(shouldCircuitBreak(MAX_NAVIGATION_HOPS_PER_CONVERSATION)).toBe(true)
    expect(shouldCircuitBreak(MAX_NAVIGATION_HOPS_PER_CONVERSATION - 1)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Constants sanity checks
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('PHEROMONE_HALF_LIFE_DAYS is 21', () => {
    expect(PHEROMONE_HALF_LIFE_DAYS).toBe(21)
  })

  it('PHEROMONE_DECAY_CONSTANT is 30', () => {
    expect(PHEROMONE_DECAY_CONSTANT).toBe(30)
  })

  it('PHEROMONE_MAX_STRENGTH is 100', () => {
    expect(PHEROMONE_MAX_STRENGTH).toBe(100)
  })

  it('PHEROMONE_TRAVERSAL_WEIGHT is 10', () => {
    expect(PHEROMONE_TRAVERSAL_WEIGHT).toBe(10)
  })

  it('PHEROMONE_ABANDONMENT_PENALTY is 0.5', () => {
    expect(PHEROMONE_ABANDONMENT_PENALTY).toBe(0.5)
  })

  it('PHEROMONE_DEFAULT_TTL_DAYS is 90', () => {
    expect(PHEROMONE_DEFAULT_TTL_DAYS).toBe(90)
  })

  it('PHEROMONE_DECAY_THRESHOLD is 1', () => {
    expect(PHEROMONE_DECAY_THRESHOLD).toBe(1)
  })

  it('MAX_NAVIGATION_HOPS_PER_CONVERSATION is 5', () => {
    expect(MAX_NAVIGATION_HOPS_PER_CONVERSATION).toBe(5)
  })
})
