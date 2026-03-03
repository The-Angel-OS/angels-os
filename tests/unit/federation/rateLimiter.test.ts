/**
 * Federation Rate Limiter — Unit Tests
 *
 * Tests the in-memory sliding window rate limiter.
 * No mocks needed — pure in-memory Map operations.
 *
 * Uses unique federation IDs per test to avoid cross-test contamination
 * of the module-level store.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  checkRateLimit,
  getRateLimitStatus,
  getAllRateLimits,
  resetRateLimits,
  getRateLimiterStats,
} from '@/federation/rateLimiter'

// Unique prefix per test run to avoid collisions
let counter = 0
function uniqueId(): string {
  return `test-fed-${Date.now()}-${++counter}`
}

// ── checkRateLimit ─────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows the first request', () => {
    const id = uniqueId()
    const result = checkRateLimit(id, 'heartbeat')
    expect(result.allowed).toBe(true)
  })

  it('returns remaining count after one request', () => {
    const id = uniqueId()
    const result = checkRateLimit(id, 'heartbeat')
    // heartbeat limit is 15; after 1 request, 14 remain
    expect(result.remaining).toBe(14)
    expect(result.limit).toBe(15)
  })

  it('tracks usage across multiple calls', () => {
    const id = uniqueId()
    checkRateLimit(id, 'catalog_browse')
    checkRateLimit(id, 'catalog_browse')
    const third = checkRateLimit(id, 'catalog_browse')
    expect(third.remaining).toBe(57) // 60 - 3
  })

  it('respects custom limits', () => {
    const id = uniqueId()
    // Heartbeat normally 15, set custom limit to 2
    checkRateLimit(id, 'heartbeat', { heartbeat: 2 })
    checkRateLimit(id, 'heartbeat', { heartbeat: 2 })
    const result = checkRateLimit(id, 'heartbeat', { heartbeat: 2 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns allowed=false when limit is hit', () => {
    const id = uniqueId()
    // Use vouch — limit is 5
    for (let i = 0; i < 5; i++) {
      checkRateLimit(id, 'vouch')
    }
    const result = checkRateLimit(id, 'vouch')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns retryAfterSeconds > 0 when denied', () => {
    const id = uniqueId()
    for (let i = 0; i < 5; i++) {
      checkRateLimit(id, 'vouch')
    }
    const result = checkRateLimit(id, 'vouch')
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('isolates counts by federationId', () => {
    const idA = uniqueId()
    const idB = uniqueId()
    checkRateLimit(idA, 'discovery')
    checkRateLimit(idA, 'discovery')
    const bResult = checkRateLimit(idB, 'discovery')
    expect(bResult.remaining).toBe(29) // idB has only 1 request
  })

  it('isolates counts by action type', () => {
    const id = uniqueId()
    checkRateLimit(id, 'heartbeat')
    checkRateLimit(id, 'heartbeat')
    const catalogResult = checkRateLimit(id, 'catalog_browse')
    expect(catalogResult.remaining).toBe(59) // catalog is independent
  })

  it('includes windowSeconds of 3600', () => {
    const id = uniqueId()
    const result = checkRateLimit(id, 'payment')
    expect(result.windowSeconds).toBe(3600)
  })
})

// ── getRateLimitStatus ─────────────────────────────────────────────────────

describe('getRateLimitStatus', () => {
  it('returns used=0 for a new enterprise with no requests', () => {
    const id = uniqueId()
    const status = getRateLimitStatus(id, 'skill_invoke')
    expect(status.used).toBe(0)
    expect(status.remaining).toBe(30)
    expect(status.limit).toBe(30)
  })

  it('reflects consumed slots after checkRateLimit', () => {
    const id = uniqueId()
    checkRateLimit(id, 'skill_invoke')
    checkRateLimit(id, 'skill_invoke')
    const status = getRateLimitStatus(id, 'skill_invoke')
    expect(status.used).toBe(2)
    expect(status.remaining).toBe(28)
  })

  it('does not consume a slot (read-only)', () => {
    const id = uniqueId()
    checkRateLimit(id, 'heartbeat') // 1 used
    getRateLimitStatus(id, 'heartbeat') // should not consume
    getRateLimitStatus(id, 'heartbeat') // should not consume
    const status = getRateLimitStatus(id, 'heartbeat')
    expect(status.used).toBe(1) // still 1
  })
})

// ── getAllRateLimits ────────────────────────────────────────────────────────

describe('getAllRateLimits', () => {
  it('returns an entry for each action type', () => {
    const id = uniqueId()
    const all = getAllRateLimits(id)
    expect(all).toHaveProperty('heartbeat')
    expect(all).toHaveProperty('catalog_browse')
    expect(all).toHaveProperty('skill_invoke')
    expect(all).toHaveProperty('vouch')
    expect(all).toHaveProperty('payment')
    expect(all).toHaveProperty('discovery')
  })

  it('shows used=0 for a fresh enterprise', () => {
    const id = uniqueId()
    const all = getAllRateLimits(id)
    for (const status of Object.values(all)) {
      expect(status.used).toBe(0)
    }
  })

  it('reflects mixed usage across action types', () => {
    const id = uniqueId()
    checkRateLimit(id, 'heartbeat')
    checkRateLimit(id, 'heartbeat')
    checkRateLimit(id, 'vouch')
    const all = getAllRateLimits(id)
    expect(all.heartbeat.used).toBe(2)
    expect(all.vouch.used).toBe(1)
    expect(all.payment.used).toBe(0)
  })
})

// ── resetRateLimits ────────────────────────────────────────────────────────

describe('resetRateLimits', () => {
  it('does not throw for an unknown enterprise', () => {
    expect(() => resetRateLimits('nonexistent-fed-999')).not.toThrow()
  })

  it('resets all counters for the enterprise', () => {
    const id = uniqueId()
    checkRateLimit(id, 'heartbeat')
    checkRateLimit(id, 'payment')
    resetRateLimits(id)
    const status = getRateLimitStatus(id, 'heartbeat')
    expect(status.used).toBe(0)
  })

  it('does not affect other enterprises', () => {
    const idA = uniqueId()
    const idB = uniqueId()
    checkRateLimit(idA, 'heartbeat')
    checkRateLimit(idB, 'heartbeat')
    resetRateLimits(idA)
    const bStatus = getRateLimitStatus(idB, 'heartbeat')
    expect(bStatus.used).toBe(1) // idB unaffected
  })
})

// ── getRateLimiterStats ────────────────────────────────────────────────────

describe('getRateLimiterStats', () => {
  it('returns an object with totalEntries and uniqueEnterprises', () => {
    const stats = getRateLimiterStats()
    expect(typeof stats.totalEntries).toBe('number')
    expect(typeof stats.uniqueEnterprises).toBe('number')
  })

  it('increments totalEntries after a new action-type request', () => {
    const id = uniqueId()
    const before = getRateLimiterStats()
    checkRateLimit(id, 'discovery')
    checkRateLimit(id, 'payment')
    const after = getRateLimiterStats()
    // Two new keys were created (id:discovery and id:payment)
    expect(after.totalEntries).toBe(before.totalEntries + 2)
  })

  it('increments uniqueEnterprises for a new federation ID', () => {
    const id = uniqueId()
    const before = getRateLimiterStats()
    checkRateLimit(id, 'heartbeat')
    const after = getRateLimiterStats()
    expect(after.uniqueEnterprises).toBe(before.uniqueEnterprises + 1)
  })
})
