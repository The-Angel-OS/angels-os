/**
 * workload-engine — Unit Tests
 *
 * Pure functions: validateWorkTransition, isTerminal, canRetry, calculateBackoff,
 * isExpired, computeClassSufficient, trustLevelSufficient, availableSlots,
 * successRate, meetsRequirements, calculateCapabilityScore, calculateTrustScore,
 * calculateLoadScore, calculatePerformanceScore
 *
 * Constants: WORKLOAD_WEIGHTS, PRIORITY_VALUES, TERMINAL_STATES
 */
import { describe, it, expect } from 'vitest'

import {
  validateWorkTransition,
  isTerminal,
  canRetry,
  calculateBackoff,
  isExpired,
  computeClassSufficient,
  trustLevelSufficient,
  availableSlots,
  successRate,
  meetsRequirements,
  calculateCapabilityScore,
  calculateTrustScore,
  calculateLoadScore,
  calculatePerformanceScore,
  WORKLOAD_WEIGHTS,
  PRIORITY_VALUES,
  TERMINAL_STATES,
  MAX_RETRIES_HARD_CAP,
  type WorkUnit,
  type WorkerCapabilities,
  type ResourceRequirements,
} from '@/utilities/workload-engine'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<WorkUnit> = {}): WorkUnit {
  return {
    id: 'wu_test',
    type: 'computation',
    status: 'pending',
    priority: 'normal',
    inputData: {},
    requirements: {
      computeClass: 'standard',
      minTrustLevel: 'vouched',
      requiredCapabilities: ['computation'],
      estimatedDurationMs: 1000,
      maxDurationMs: 5000,
    },
    retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
    attemptCount: 0,
    originNode: 'node_1',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeWorker(overrides: Partial<WorkerCapabilities> = {}): WorkerCapabilities {
  return {
    nodeId: 'node_1',
    nodeName: 'Test Node',
    domain: 'test.example.com',
    computeClass: 'standard',
    supportedWorkTypes: ['computation', 'analysis'],
    maxConcurrent: 5,
    activeWorkUnits: 0,
    accepting: true,
    costPerUnitCents: 10,
    trustLevel: 'full',
    compositeTrustScore: 80,
    completedCount: 100,
    failedCount: 5,
    avgExecutionTimeMs: 800,
    isHealthy: true,
    ...overrides,
  }
}

// ── validateWorkTransition ─────────────────────────────────────────────────────

describe('validateWorkTransition', () => {
  it('allows pending → claimed', () => {
    const r = validateWorkTransition('pending', 'claimed')
    expect(r.valid).toBe(true)
  })

  it('allows claimed → executing', () => {
    const r = validateWorkTransition('claimed', 'executing')
    expect(r.valid).toBe(true)
  })

  it('allows executing → completed', () => {
    const r = validateWorkTransition('executing', 'completed')
    expect(r.valid).toBe(true)
  })

  it('rejects self-transition', () => {
    const r = validateWorkTransition('pending', 'pending')
    expect(r.valid).toBe(false)
    expect(r.reason).toMatch(/itself/i)
  })

  it('rejects invalid transition', () => {
    const r = validateWorkTransition('completed', 'pending')
    expect(r.valid).toBe(false)
  })

  it('returns reason string for invalid transitions', () => {
    const r = validateWorkTransition('failed', 'executing')
    if (!r.valid) {
      expect(typeof r.reason).toBe('string')
    }
  })
})

// ── isTerminal ─────────────────────────────────────────────────────────────────

describe('isTerminal', () => {
  it('returns true for completed', () => {
    expect(isTerminal('completed')).toBe(true)
  })

  it('returns true for cancelled', () => {
    expect(isTerminal('cancelled')).toBe(true)
  })

  it('returns false for pending', () => {
    expect(isTerminal('pending')).toBe(false)
  })

  it('returns false for executing', () => {
    expect(isTerminal('executing')).toBe(false)
  })

  it('returns false for failed', () => {
    expect(isTerminal('failed')).toBe(false)
  })
})

// ── canRetry ───────────────────────────────────────────────────────────────────

describe('canRetry', () => {
  it('returns true for failed unit within retry limit', () => {
    const unit = makeUnit({ status: 'failed', attemptCount: 1, retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 } })
    expect(canRetry(unit)).toBe(true)
  })

  it('returns false for failed unit at retry limit', () => {
    const unit = makeUnit({ status: 'failed', attemptCount: 3, retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 } })
    expect(canRetry(unit)).toBe(false)
  })

  it('returns true for timeout unit within retry limit', () => {
    const unit = makeUnit({ status: 'timeout', attemptCount: 0, retryPolicy: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 1 } })
    expect(canRetry(unit)).toBe(true)
  })

  it('returns false for pending unit', () => {
    const unit = makeUnit({ status: 'pending' })
    expect(canRetry(unit)).toBe(false)
  })

  it('respects MAX_RETRIES_HARD_CAP', () => {
    const unit = makeUnit({
      status: 'failed',
      attemptCount: MAX_RETRIES_HARD_CAP,
      retryPolicy: { maxRetries: 100, backoffMs: 1000, backoffMultiplier: 2 },
    })
    expect(canRetry(unit)).toBe(false)
  })
})

// ── calculateBackoff ───────────────────────────────────────────────────────────

describe('calculateBackoff', () => {
  it('returns base backoff for first attempt', () => {
    const unit = makeUnit({ attemptCount: 1, retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 } })
    const backoff = calculateBackoff(unit)
    expect(backoff).toBe(1000)
  })

  it('doubles on second attempt with multiplier=2', () => {
    const unit = makeUnit({ attemptCount: 2, retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 } })
    expect(calculateBackoff(unit)).toBe(2000)
  })

  it('caps at 5 minutes (300000ms)', () => {
    const unit = makeUnit({ attemptCount: 100, retryPolicy: { maxRetries: 100, backoffMs: 60000, backoffMultiplier: 10 } })
    expect(calculateBackoff(unit)).toBe(300_000)
  })
})

// ── isExpired ──────────────────────────────────────────────────────────────────

describe('isExpired', () => {
  it('returns false when no deadline', () => {
    const unit = makeUnit()
    expect(isExpired(unit)).toBe(false)
  })

  it('returns true when deadline is in the past', () => {
    const past = new Date(Date.now() - 10_000).toISOString()
    const unit = makeUnit({ deadline: past })
    expect(isExpired(unit)).toBe(true)
  })

  it('returns false when deadline is in the future', () => {
    const future = new Date(Date.now() + 10_000).toISOString()
    const unit = makeUnit({ deadline: future })
    expect(isExpired(unit)).toBe(false)
  })
})

// ── computeClassSufficient ─────────────────────────────────────────────────────

describe('computeClassSufficient', () => {
  it('heavy can handle lightweight', () => {
    expect(computeClassSufficient('heavy', 'lightweight')).toBe(true)
  })

  it('heavy can handle standard', () => {
    expect(computeClassSufficient('heavy', 'standard')).toBe(true)
  })

  it('heavy can handle heavy', () => {
    expect(computeClassSufficient('heavy', 'heavy')).toBe(true)
  })

  it('lightweight cannot handle standard', () => {
    expect(computeClassSufficient('lightweight', 'standard')).toBe(false)
  })

  it('standard cannot handle heavy', () => {
    expect(computeClassSufficient('standard', 'heavy')).toBe(false)
  })
})

// ── trustLevelSufficient ───────────────────────────────────────────────────────

describe('trustLevelSufficient', () => {
  it('full trust meets full requirement', () => {
    expect(trustLevelSufficient('full', 'full')).toBe(true)
  })

  it('full trust meets vouched requirement', () => {
    expect(trustLevelSufficient('full', 'vouched')).toBe(true)
  })

  it('none trust does not meet vouched requirement', () => {
    expect(trustLevelSufficient('none', 'vouched')).toBe(false)
  })

  it('probationary does not meet full requirement', () => {
    expect(trustLevelSufficient('probationary', 'full')).toBe(false)
  })
})

// ── availableSlots ────────────────────────────────────────────────────────────

describe('availableSlots', () => {
  it('returns maxConcurrent - activeWorkUnits when positive', () => {
    const worker = makeWorker({ maxConcurrent: 10, activeWorkUnits: 3 })
    expect(availableSlots(worker)).toBe(7)
  })

  it('returns 0 when fully loaded', () => {
    const worker = makeWorker({ maxConcurrent: 5, activeWorkUnits: 5 })
    expect(availableSlots(worker)).toBe(0)
  })

  it('returns 0 when overloaded (clamps to 0)', () => {
    const worker = makeWorker({ maxConcurrent: 5, activeWorkUnits: 10 })
    expect(availableSlots(worker)).toBe(0)
  })
})

// ── successRate ────────────────────────────────────────────────────────────────

describe('successRate', () => {
  it('returns 0.5 for new nodes with no history', () => {
    const worker = makeWorker({ completedCount: 0, failedCount: 0 })
    expect(successRate(worker)).toBe(0.5)
  })

  it('returns 1 when all completed', () => {
    const worker = makeWorker({ completedCount: 100, failedCount: 0 })
    expect(successRate(worker)).toBe(1)
  })

  it('returns 0 when all failed', () => {
    const worker = makeWorker({ completedCount: 0, failedCount: 100 })
    expect(successRate(worker)).toBe(0)
  })

  it('returns correct ratio for partial success', () => {
    const worker = makeWorker({ completedCount: 75, failedCount: 25 })
    expect(successRate(worker)).toBeCloseTo(0.75, 5)
  })
})

// ── meetsRequirements ──────────────────────────────────────────────────────────

describe('meetsRequirements', () => {
  const reqs: ResourceRequirements = {
    computeClass: 'standard',
    minTrustLevel: 'vouched',
    requiredCapabilities: ['computation'],
    estimatedDurationMs: 1000,
    maxDurationMs: 5000,
  }

  it('returns true for a fully capable worker', () => {
    expect(meetsRequirements(makeWorker(), reqs)).toBe(true)
  })

  it('returns false when worker is not accepting', () => {
    expect(meetsRequirements(makeWorker({ accepting: false }), reqs)).toBe(false)
  })

  it('returns false when worker is unhealthy', () => {
    expect(meetsRequirements(makeWorker({ isHealthy: false }), reqs)).toBe(false)
  })

  it('returns false when worker has no available slots', () => {
    const worker = makeWorker({ maxConcurrent: 2, activeWorkUnits: 2 })
    expect(meetsRequirements(worker, reqs)).toBe(false)
  })

  it('returns false when compute class is insufficient', () => {
    expect(meetsRequirements(makeWorker({ computeClass: 'lightweight' }), reqs)).toBe(false)
  })

  it('returns false when trust level is insufficient', () => {
    expect(meetsRequirements(makeWorker({ trustLevel: 'none' }), reqs)).toBe(false)
  })
})

// ── calculateCapabilityScore ───────────────────────────────────────────────────

describe('calculateCapabilityScore', () => {
  it('returns 100 when no capabilities required', () => {
    expect(calculateCapabilityScore([], ['computation'])).toBe(100)
  })

  it('returns 100 when all required capabilities matched', () => {
    expect(calculateCapabilityScore(['computation', 'analysis'], ['computation', 'analysis', 'generation'])).toBe(100)
  })

  it('returns 0 when required capability is missing', () => {
    expect(calculateCapabilityScore(['generation'], ['computation'])).toBe(0)
  })
})

// ── calculateTrustScore ────────────────────────────────────────────────────────

describe('calculateTrustScore', () => {
  it('returns 0 when worker trust is insufficient', () => {
    expect(calculateTrustScore('none', 'full', 90)).toBe(0)
  })

  it('returns compositeTrustScore when sufficient (clamped to 100)', () => {
    expect(calculateTrustScore('full', 'vouched', 75)).toBe(75)
  })

  it('clamps high composite scores to 100', () => {
    expect(calculateTrustScore('full', 'none', 150)).toBe(100)
  })

  it('returns 0 for non-finite composite score', () => {
    expect(calculateTrustScore('full', 'none', NaN)).toBe(0)
  })
})

// ── calculateLoadScore ─────────────────────────────────────────────────────────

describe('calculateLoadScore', () => {
  it('returns 100 when no work units active', () => {
    expect(calculateLoadScore(0, 10)).toBe(100)
  })

  it('returns 0 when fully loaded', () => {
    expect(calculateLoadScore(10, 10)).toBe(0)
  })

  it('returns ~50 at half capacity', () => {
    expect(calculateLoadScore(5, 10)).toBeCloseTo(50, 0)
  })

  it('returns 0 for invalid maxConcurrent', () => {
    expect(calculateLoadScore(0, 0)).toBe(0)
    expect(calculateLoadScore(0, NaN)).toBe(0)
  })
})

// ── Constants ──────────────────────────────────────────────────────────────────

describe('WORKLOAD_WEIGHTS', () => {
  it('weights sum to approximately 1.0', () => {
    const total = Object.values(WORKLOAD_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 2)
  })
})

describe('PRIORITY_VALUES', () => {
  it('critical has highest value', () => {
    const vals = Object.values(PRIORITY_VALUES)
    expect(PRIORITY_VALUES.critical).toBe(Math.max(...vals))
  })

  it('background has lowest value', () => {
    const vals = Object.values(PRIORITY_VALUES)
    expect(PRIORITY_VALUES.background).toBe(Math.min(...vals))
  })
})

describe('TERMINAL_STATES', () => {
  it('includes completed and cancelled', () => {
    expect(TERMINAL_STATES).toContain('completed')
    expect(TERMINAL_STATES).toContain('cancelled')
  })

  it('does not include pending', () => {
    expect(TERMINAL_STATES).not.toContain('pending')
  })
})
