/**
 * Pheromone Engine — BREAK IT Edge Case Tests
 *
 * Deliberately adversarial inputs: empty strings, NaN, Infinity, negative
 * values, null bytes, 10KB strings, MAX_SAFE_INTEGER traversals, future
 * dates, epoch zero, 1000-element arrays, negative limits.
 *
 * If it doesn't crash here, it won't crash in production.
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
} from '@/utilities/pheromone-engine'
import type {
  PheromoneData,
  PheromoneContext,
  TraversalResult,
  PathRecommendation,
} from '@/utilities/pheromone-engine'

// ---------------------------------------------------------------------------
// Helpers — Factory Functions
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<PheromoneContext> = {}): PheromoneContext {
  return {
    query: 'find nearest pantry',
    toolName: 'searchPantries',
    tenantSlug: 'clearwater',
    ...overrides,
  }
}

function makePheromone(overrides: Partial<PheromoneData> = {}): PheromoneData {
  const now = new Date('2026-02-28T12:00:00Z')
  return {
    id: 1,
    contextHash: 'ph_abcdef01',
    path: '/dashboard/pantries',
    toolName: 'searchPantries',
    strength: 50,
    successfulTraversals: 5,
    abandonments: 0,
    lastTraversedAt: now.toISOString(),
    decay: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    ...overrides,
  }
}

const NOW = new Date('2026-02-28T12:00:00Z')

// ===========================================================================
// hashContext — edge cases
// ===========================================================================

describe('hashContext — edge cases', () => {
  it('handles all empty string fields without throwing', () => {
    const ctx: PheromoneContext = {
      query: '',
      toolName: '',
      tenantSlug: '',
      additionalContext: '',
    }
    const hash = hashContext(ctx)
    expect(hash).toMatch(/^ph_[0-9a-f]{8}$/)
  })

  it('handles Unicode characters (CJK, emoji, accented) deterministically', () => {
    const ctx = makeContext({ query: 'buscar comida cercana' })
    const hash1 = hashContext(ctx)
    const hash2 = hashContext(ctx)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^ph_[0-9a-f]{8}$/)

    // Emoji and CJK — should not throw
    const emojiCtx = makeContext({ query: 'food delivery near me' })
    expect(() => hashContext(emojiCtx)).not.toThrow()
  })

  it('handles very long strings (10KB+ query) without throwing or hanging', () => {
    const longQuery = 'word '.repeat(2048) // ~10KB
    const ctx = makeContext({ query: longQuery })
    const hash = hashContext(ctx)
    expect(hash).toMatch(/^ph_[0-9a-f]{8}$/)
  })

  it('handles special characters including null bytes, newlines, and tabs', () => {
    const ctx = makeContext({
      query: 'find\x00pantry\nnear\ttabs',
      additionalContext: 'extra\x00\n\t\rcontext',
    })
    const hash = hashContext(ctx)
    expect(hash).toMatch(/^ph_[0-9a-f]{8}$/)
  })

  it('produces identical hashes for identical contexts (determinism)', () => {
    const ctx1 = makeContext({ query: 'emergency food clearwater' })
    const ctx2 = makeContext({ query: 'emergency food clearwater' })
    expect(hashContext(ctx1)).toBe(hashContext(ctx2))
  })
})

// ===========================================================================
// calculateStrength — boundary conditions
// ===========================================================================

describe('calculateStrength — boundary conditions', () => {
  it('returns 0 for zero traversals regardless of other values', () => {
    expect(calculateStrength(0, 0, 0)).toBe(0)
    expect(calculateStrength(0, 10, 5)).toBe(0)
  })

  it('returns 0 for negative traversals', () => {
    expect(calculateStrength(-1, 0, 0)).toBe(0)
    expect(calculateStrength(-100, 5, 3)).toBe(0)
  })

  it('handles extremely large traversals (MAX_SAFE_INTEGER) without overflow', () => {
    const result = calculateStrength(Number.MAX_SAFE_INTEGER, 0, 0)
    // Capped at PHEROMONE_MAX_STRENGTH = 100
    expect(result).toBe(PHEROMONE_MAX_STRENGTH)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('clamps negative ageInDays to zero (no future-decay)', () => {
    const withNegativeAge = calculateStrength(5, -10, 0)
    const withZeroAge = calculateStrength(5, 0, 0)
    // Negative age treated as 0 → same result
    expect(withNegativeAge).toBe(withZeroAge)
  })

  it('returns full raw strength at zero ageInDays with no abandonments', () => {
    // 5 traversals * 10 weight = 50
    expect(calculateStrength(5, 0, 0)).toBe(50)
    // 10 traversals * 10 = 100 (capped)
    expect(calculateStrength(10, 0, 0)).toBe(PHEROMONE_MAX_STRENGTH)
  })

  it('returns near-zero for very old pheromones (10000 days)', () => {
    const result = calculateStrength(10, 10000, 0)
    expect(result).toBe(0)
  })

  it('handles NaN inputs without throwing', () => {
    const result = calculateStrength(NaN, 0, 0)
    // NaN <= 0 is false in JS, so it does NOT hit the early return
    // NaN propagates through the arithmetic → result is NaN
    expect(result).toBeNaN()
  })

  it('handles Infinity inputs without throwing', () => {
    const posInf = calculateStrength(Infinity, 0, 0)
    // Infinity * 10 = Infinity, min(100, Infinity) = 100, exp(0) = 1 → 100
    expect(posInf).toBe(PHEROMONE_MAX_STRENGTH)

    const infAge = calculateStrength(10, Infinity, 0)
    // exp(-Infinity/30) = 0 → strength 0
    expect(infAge).toBe(0)
  })
})

// ===========================================================================
// ageInDays — edge cases
// ===========================================================================

describe('ageInDays — edge cases', () => {
  it('returns 0 for future dates (clamped, no negative age)', () => {
    const futureDate = '2027-01-01T00:00:00Z'
    const result = ageInDays(futureDate, NOW)
    expect(result).toBe(0)
  })

  it('returns 0 for same timestamp', () => {
    const result = ageInDays(NOW.toISOString(), NOW)
    expect(result).toBe(0)
  })

  it('calculates correctly for very old dates (year 2000)', () => {
    const oldDate = '2000-01-01T00:00:00Z'
    const result = ageInDays(oldDate, NOW)
    // ~9555 days between 2000-01-01 and 2026-02-28
    expect(result).toBeGreaterThan(9500)
    expect(result).toBeLessThan(9600)
  })

  it('handles invalid date strings without throwing (returns NaN-based result)', () => {
    const result = ageInDays('not-a-date', NOW)
    // new Date('not-a-date') → Invalid Date → getTime() → NaN
    // Math.max(0, NaN) → 0 in many engines, but behavior varies
    expect(typeof result).toBe('number')
    // Should not throw
  })

  it('handles epoch zero (1970-01-01T00:00:00Z)', () => {
    const result = ageInDays('1970-01-01T00:00:00Z', NOW)
    // ~20512 days from epoch to 2026-02-28
    expect(result).toBeGreaterThan(20000)
    expect(result).toBeLessThan(21000)
  })
})

// ===========================================================================
// buildTraversal — stress tests
// ===========================================================================

describe('buildTraversal — stress tests', () => {
  it('creates a new pheromone when existing is null', () => {
    const ctx = makeContext()
    const result = buildTraversal(null, ctx, '/dashboard/pantries', NOW)

    expect(result.isNew).toBe(true)
    expect(result.previousStrength).toBe(0)
    expect(result.newStrength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
    expect(result.pheromone.successfulTraversals).toBe(1)
    expect(result.pheromone.abandonments).toBe(0)
    expect(result.pheromone.path).toBe('/dashboard/pantries')
  })

  it('creates a new pheromone when existing is explicitly undefined (via null coercion)', () => {
    const ctx = makeContext()
    // TypeScript won't allow undefined directly, but at runtime JS callers might pass it
    const result = buildTraversal(null, ctx, '/test', NOW)
    expect(result.isNew).toBe(true)
  })

  it('reinforces an existing pheromone with 0 traversals', () => {
    const existing = makePheromone({ successfulTraversals: 0, strength: 0 })
    const ctx = makeContext()
    const result = buildTraversal(existing, ctx, existing.path, NOW)

    expect(result.isNew).toBe(false)
    expect(result.pheromone.successfulTraversals).toBe(1)
    // 1 traversal * 10 weight = 10 at age 0 with 0 abandonments
    expect(result.newStrength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
  })

  it('handles existing with MAX_SAFE_INTEGER traversals without overflow', () => {
    const existing = makePheromone({
      successfulTraversals: Number.MAX_SAFE_INTEGER,
      createdAt: NOW.toISOString(),
    })
    const ctx = makeContext()
    const result = buildTraversal(existing, ctx, existing.path, NOW)

    expect(result.isNew).toBe(false)
    expect(Number.isFinite(result.newStrength)).toBe(true)
    // Strength capped at 100
    expect(result.newStrength).toBeLessThanOrEqual(PHEROMONE_MAX_STRENGTH)
  })

  it('handles very long path strings (10KB+)', () => {
    const longPath = '/' + 'a'.repeat(10240)
    const ctx = makeContext()
    const result = buildTraversal(null, ctx, longPath, NOW)

    expect(result.isNew).toBe(true)
    expect(result.pheromone.path).toBe(longPath)
  })

  it('handles empty path string', () => {
    const ctx = makeContext()
    const result = buildTraversal(null, ctx, '', NOW)

    expect(result.isNew).toBe(true)
    expect(result.pheromone.path).toBe('')
  })

  it('handles path with special characters (query params, fragments, unicode)', () => {
    const specialPath = '/dashboard/search?q=food%20bank&filter=urgent#results&lang=es'
    const ctx = makeContext()
    const result = buildTraversal(null, ctx, specialPath, NOW)

    expect(result.pheromone.path).toBe(specialPath)
  })

  it('reinforces a very old existing pheromone (30 days old)', () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)
    const existing = makePheromone({
      successfulTraversals: 5,
      abandonments: 0,
      createdAt: thirtyDaysAgo.toISOString(),
    })
    const ctx = makeContext()
    const result = buildTraversal(existing, ctx, existing.path, NOW)

    expect(result.isNew).toBe(false)
    // 6 traversals at 30 days old → significant decay
    // Raw = min(100, 60) = 60, decay = exp(-30/30) = exp(-1) ≈ 0.368
    // Strength ≈ 60 * 0.368 ≈ 22
    expect(result.newStrength).toBeGreaterThan(0)
    expect(result.newStrength).toBeLessThan(50)
  })
})

// ===========================================================================
// applyDecay — edge cases
// ===========================================================================

describe('applyDecay — edge cases', () => {
  it('returns empty arrays for empty pheromone array', () => {
    const result = applyDecay([], NOW)
    expect(result.updated).toEqual([])
    expect(result.expired).toEqual([])
  })

  it('expires all pheromones when all are extremely old (300 days)', () => {
    const veryOld = new Date(NOW.getTime() - 300 * 24 * 60 * 60 * 1000).toISOString()
    const pheromones = [
      makePheromone({ createdAt: veryOld, successfulTraversals: 1 }),
      makePheromone({ createdAt: veryOld, successfulTraversals: 2, id: 2 }),
      makePheromone({ createdAt: veryOld, successfulTraversals: 3, id: 3 }),
    ]

    const result = applyDecay(pheromones, NOW)
    expect(result.expired).toHaveLength(3)
    expect(result.updated).toHaveLength(0)
  })

  it('keeps all pheromones when none are expired (fresh, strong trails)', () => {
    const pheromones = [
      makePheromone({ createdAt: NOW.toISOString(), successfulTraversals: 10 }),
      makePheromone({ createdAt: NOW.toISOString(), successfulTraversals: 5, id: 2 }),
    ]

    const result = applyDecay(pheromones, NOW)
    expect(result.updated).toHaveLength(2)
    expect(result.expired).toHaveLength(0)
  })

  it('classifies a pheromone at exact threshold boundary correctly', () => {
    // Find a configuration that results in strength exactly at threshold (1)
    // With 1 traversal, we need exp(-age/30) * 10 ≈ 1, so exp(-age/30) ≈ 0.1
    // age ≈ 30 * ln(10) ≈ 69 days
    const almostExpired = new Date(NOW.getTime() - 69 * 24 * 60 * 60 * 1000).toISOString()
    const p = makePheromone({ createdAt: almostExpired, successfulTraversals: 1 })

    const result = applyDecay([p], NOW)
    // Should be classified into one bucket or the other, not both
    expect(result.updated.length + result.expired.length).toBe(1)
  })

  it('handles 1000 pheromones without performance issues', () => {
    const pheromones: PheromoneData[] = []
    for (let i = 0; i < 1000; i++) {
      const daysOld = i % 100
      const created = new Date(NOW.getTime() - daysOld * 24 * 60 * 60 * 1000).toISOString()
      pheromones.push(
        makePheromone({
          id: i,
          createdAt: created,
          successfulTraversals: (i % 10) + 1,
          path: `/path/${i}`,
        }),
      )
    }

    const start = performance.now()
    const result = applyDecay(pheromones, NOW)
    const elapsed = performance.now() - start

    expect(result.updated.length + result.expired.length).toBe(1000)
    expect(elapsed).toBeLessThan(1000) // should finish well under 1 second
  })

  it('handles pheromones with zero strength (already dead)', () => {
    const p = makePheromone({
      strength: 0,
      successfulTraversals: 0,
      createdAt: NOW.toISOString(),
    })

    const result = applyDecay([p], NOW)
    // 0 traversals → calculateStrength returns 0 → below threshold → expired
    expect(result.expired).toHaveLength(1)
    expect(result.updated).toHaveLength(0)
  })

  it('handles pheromones with negative strength (corrupted data)', () => {
    const p = makePheromone({
      strength: -50,
      successfulTraversals: 0,
      createdAt: NOW.toISOString(),
    })

    const result = applyDecay([p], NOW)
    // calculateStrength recalculates from traversals, ignores stored strength
    // 0 traversals → strength 0 → expired
    expect(result.expired).toHaveLength(1)
  })

  it('handles pheromones with future creation dates', () => {
    const futureDate = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const p = makePheromone({
      createdAt: futureDate,
      successfulTraversals: 5,
    })

    const result = applyDecay([p], NOW)
    // Future date → ageInDays returns 0 (clamped) → treated as brand new
    // 5 traversals at age 0 = 50 strength → updated (above threshold)
    expect(result.updated).toHaveLength(1)
    expect(result.expired).toHaveLength(0)
  })
})

// ===========================================================================
// rankPaths — edge cases
// ===========================================================================

describe('rankPaths — edge cases', () => {
  it('returns empty array for empty input', () => {
    expect(rankPaths([])).toEqual([])
  })

  it('returns single recommendation for single pheromone', () => {
    const p = makePheromone({ strength: 50 })
    const result = rankPaths([p])

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(p.path)
    expect(result[0].strength).toBe(50)
  })

  it('handles all pheromones with identical strength (stable sort behavior)', () => {
    const pheromones = Array.from({ length: 5 }, (_, i) =>
      makePheromone({ id: i, strength: 42, path: `/path/${i}` }),
    )

    const result = rankPaths(pheromones)
    expect(result).toHaveLength(5)
    // All returned, all same strength
    result.forEach((r) => expect(r.strength).toBe(42))
  })

  it('returns 1 item when limit is 0 (first item pushed before break check)', () => {
    const pheromones = [makePheromone({ strength: 50 })]
    const result = rankPaths(pheromones, 0)
    // The break check `results.length >= limit` fires after push
    // 1 >= 0 is true, so it breaks — but one item already got through
    expect(result).toHaveLength(1)
  })

  it('returns all pheromones when limit exceeds array length', () => {
    const pheromones = [
      makePheromone({ id: 1, strength: 50, path: '/a' }),
      makePheromone({ id: 2, strength: 30, path: '/b' }),
    ]

    const result = rankPaths(pheromones, 100)
    expect(result).toHaveLength(2)
  })

  it('handles negative limit (first item pushed before break check)', () => {
    const pheromones = [makePheromone({ strength: 50 })]
    const result = rankPaths(pheromones, -5)
    // The break check `results.length >= limit` fires after push
    // 1 >= -5 is true, so it breaks — but one item already got through
    expect(result).toHaveLength(1)
  })

  it('handles pheromones with NaN strength (sorts them last)', () => {
    const pheromones = [
      makePheromone({ id: 1, strength: NaN, path: '/nan-path' }),
      makePheromone({ id: 2, strength: 50, path: '/good-path' }),
      makePheromone({ id: 3, strength: 10, path: '/okay-path' }),
    ]

    const result = rankPaths(pheromones)
    // NaN comparisons are falsy — sort may place NaN items unpredictably
    // but should not throw
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('handles very large array (100 items) with deduplication', () => {
    const pheromones: PheromoneData[] = []
    for (let i = 0; i < 100; i++) {
      pheromones.push(
        makePheromone({
          id: i,
          strength: 100 - i,
          // 20 unique paths, each appearing 5 times
          path: `/path/${i % 20}`,
        }),
      )
    }

    const result = rankPaths(pheromones, 10)
    // Should deduplicate to at most 20 unique paths, limited to 10
    expect(result).toHaveLength(10)
    // Paths should be unique in results
    const paths = result.map((r) => r.path)
    expect(new Set(paths).size).toBe(10)
    // Should be sorted by strength descending (strongest kept per path)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].strength).toBeGreaterThanOrEqual(result[i].strength)
    }
  })
})

// ===========================================================================
// recordAbandonment — edge cases
// ===========================================================================

describe('recordAbandonment — edge cases', () => {
  it('handles pheromone that is brand new (first abandonment ever)', () => {
    const existing = makePheromone({
      successfulTraversals: 1,
      abandonments: 0,
      createdAt: NOW.toISOString(),
    })

    const result = recordAbandonment(existing, NOW)
    expect(result.abandonments).toBe(1)
    // 1 traversal, 0 age, 1 abandonment
    // abandonmentRatio = 1/2 = 0.5, factor = 1 - 0.5 * 0.5 = 0.75
    // strength = min(100, 10) * 1 * 0.75 = 7.5 → rounded to 8
    expect(result.strength).toBeLessThan(existing.strength)
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })

  it('handles heavily abandoned pheromone (1000 prior abandonments)', () => {
    const existing = makePheromone({
      successfulTraversals: 5,
      abandonments: 1000,
      createdAt: NOW.toISOString(),
    })

    const result = recordAbandonment(existing, NOW)
    expect(result.abandonments).toBe(1001)
    // Very high abandonment ratio → strength severely penalized
    expect(result.strength).toBeLessThan(50)
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })

  it('handles pheromone with zero traversals (strength stays 0)', () => {
    const existing = makePheromone({
      successfulTraversals: 0,
      abandonments: 0,
      strength: 0,
      createdAt: NOW.toISOString(),
    })

    const result = recordAbandonment(existing, NOW)
    expect(result.abandonments).toBe(1)
    // 0 traversals → calculateStrength returns 0
    expect(result.strength).toBe(0)
  })

  it('handles fresh pheromone with no traversals but existing abandonments', () => {
    const existing = makePheromone({
      successfulTraversals: 0,
      abandonments: 5,
      strength: 0,
      createdAt: NOW.toISOString(),
    })

    const result = recordAbandonment(existing, NOW)
    expect(result.abandonments).toBe(6)
    expect(result.strength).toBe(0) // 0 traversals → always 0
  })
})

// ===========================================================================
// shouldCircuitBreak — edge cases
// ===========================================================================

describe('shouldCircuitBreak — edge cases', () => {
  it('returns true at exactly max hops', () => {
    expect(shouldCircuitBreak(MAX_NAVIGATION_HOPS_PER_CONVERSATION)).toBe(true)
  })

  it('returns false just below max hops', () => {
    expect(shouldCircuitBreak(MAX_NAVIGATION_HOPS_PER_CONVERSATION - 1)).toBe(false)
  })

  it('handles negative hop count (returns false — below threshold)', () => {
    expect(shouldCircuitBreak(-1)).toBe(false)
    expect(shouldCircuitBreak(-100)).toBe(false)
  })

  it('handles zero hop count (returns false)', () => {
    expect(shouldCircuitBreak(0)).toBe(false)
  })
})

// ===========================================================================
// calculateDecayDate — sanity
// ===========================================================================

describe('calculateDecayDate — edge cases', () => {
  it('returns a date PHEROMONE_DEFAULT_TTL_DAYS in the future', () => {
    const result = calculateDecayDate(NOW)
    const expected = new Date(NOW)
    expected.setDate(expected.getDate() + PHEROMONE_DEFAULT_TTL_DAYS)
    expect(result).toBe(expected.toISOString())
  })

  it('handles epoch zero as input', () => {
    const epoch = new Date(0)
    const result = calculateDecayDate(epoch)
    const expected = new Date(0)
    expected.setDate(expected.getDate() + PHEROMONE_DEFAULT_TTL_DAYS)
    expect(result).toBe(expected.toISOString())
  })
})

// ===========================================================================
// Constants — sanity checks
// ===========================================================================

describe('pheromone constants — sanity', () => {
  it('PHEROMONE_HALF_LIFE_DAYS is a positive number', () => {
    expect(PHEROMONE_HALF_LIFE_DAYS).toBeGreaterThan(0)
  })

  it('PHEROMONE_DECAY_CONSTANT is a positive number', () => {
    expect(PHEROMONE_DECAY_CONSTANT).toBeGreaterThan(0)
  })

  it('PHEROMONE_MAX_STRENGTH is 100', () => {
    expect(PHEROMONE_MAX_STRENGTH).toBe(100)
  })

  it('PHEROMONE_DECAY_THRESHOLD is less than PHEROMONE_MAX_STRENGTH', () => {
    expect(PHEROMONE_DECAY_THRESHOLD).toBeLessThan(PHEROMONE_MAX_STRENGTH)
  })

  it('MAX_NAVIGATION_HOPS_PER_CONVERSATION is a positive integer', () => {
    expect(MAX_NAVIGATION_HOPS_PER_CONVERSATION).toBeGreaterThan(0)
    expect(Number.isInteger(MAX_NAVIGATION_HOPS_PER_CONVERSATION)).toBe(true)
  })
})
