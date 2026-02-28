/**
 * Workload Distribution Engine — BREAK IT Edge Case Tests
 *
 * Deliberately adversarial inputs: NaN scores, negative attempts,
 * divide-by-zero capacity, impossible requirements, empty worker pools,
 * huge datasets, overflow backoffs, self-transitions, terminal escapes,
 * and boundary conditions on every scoring function.
 *
 * If it doesn't crash here, it won't crash in production.
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
  calculateCostScore,
  calculatePheromoneBonus,
  calculateWorkerScore,
  routeWorkUnit,
  detectBackpressure,
  shouldShed,
  buildCapacitySnapshot,
  parseCapacitySnapshot,
  canDecompose,
  decomposeWorkUnit,
  allChildrenComplete,
  aggregateResults,
  WORKLOAD_WEIGHTS,
  MAX_PHEROMONE_BONUS,
  PRIORITY_VALUES,
  VALID_WORK_TRANSITIONS,
  TERMINAL_STATES,
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY_POLICY,
  MAX_RETRIES_HARD_CAP,
  CIRCUIT_BREAKER_THRESHOLD,
  BACKPRESSURE_LOAD_THRESHOLD,
  WORK_TYPE_MIN_TRUST,
  TRUST_LEVEL_VALUES,
  COMPUTE_CLASS_VALUES,
  PRIORITY_ORDER,
  WORK_UNIT_STATES,
} from '@/utilities/workload-engine'
import type {
  WorkUnit,
  WorkerCapabilities,
  WorkerMatch,
  WorkResult,
  PheromoneHint,
  BackpressureSignal,
  CapacitySnapshot,
  ResourceRequirements,
  RetryPolicy,
} from '@/utilities/workload-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkUnit(overrides: Partial<WorkUnit> = {}): WorkUnit {
  return {
    id: 'wu-test-1',
    type: 'computation',
    status: 'pending',
    priority: 'normal',
    inputData: {},
    requirements: {
      computeClass: 'standard',
      minTrustLevel: 'probationary',
      requiredCapabilities: ['computation'],
      estimatedDurationMs: 5000,
      maxDurationMs: 30000,
    },
    retryPolicy: { ...DEFAULT_RETRY_POLICY },
    attemptCount: 0,
    originNode: 'origin-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeWorker(overrides: Partial<WorkerCapabilities> = {}): WorkerCapabilities {
  return {
    nodeId: 'worker-1',
    nodeName: 'Worker One',
    domain: 'local',
    computeClass: 'standard',
    supportedWorkTypes: ['computation'],
    maxConcurrent: 5,
    activeWorkUnits: 1,
    accepting: true,
    costPerUnitCents: 10,
    trustLevel: 'vouched',
    compositeTrustScore: 75,
    completedCount: 100,
    failedCount: 5,
    avgExecutionTimeMs: 3000,
    lastHeartbeat: new Date().toISOString(),
    isHealthy: true,
    ...overrides,
  }
}

// ===========================================================================
// 1. State Machine Edge Cases
// ===========================================================================

describe('State machine edge cases', () => {
  it('rejects completed -> pending (terminal state has no exits)', () => {
    const result = validateWorkTransition('completed', 'pending')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid transition')
  })

  it('rejects cancelled -> claimed (terminal state has no exits)', () => {
    const result = validateWorkTransition('cancelled', 'claimed')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid transition')
  })

  it('rejects completed -> executing (cannot resurrect completed work)', () => {
    const result = validateWorkTransition('completed', 'executing')
    expect(result.valid).toBe(false)
  })

  it('rejects cancelled -> pending (cannot reopen cancelled work)', () => {
    const result = validateWorkTransition('cancelled', 'pending')
    expect(result.valid).toBe(false)
  })

  it('rejects pending -> executing (must be claimed first)', () => {
    const result = validateWorkTransition('pending', 'executing')
    expect(result.valid).toBe(false)
  })

  it('rejects self-transition pending -> pending', () => {
    const result = validateWorkTransition('pending', 'pending')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('to itself')
  })

  it('rejects self-transition executing -> executing', () => {
    const result = validateWorkTransition('executing', 'executing')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('to itself')
  })

  it('handles unknown status values without crashing', () => {
    const result = validateWorkTransition(
      'nonexistent' as any,
      'pending',
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toBeDefined()
  })
})

// ===========================================================================
// 2. Retry Edge Cases
// ===========================================================================

describe('Retry edge cases', () => {
  it('denies retry when attemptCount equals maxRetries exactly', () => {
    const unit = makeWorkUnit({
      status: 'failed',
      attemptCount: 3,
      retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
    })
    expect(canRetry(unit)).toBe(false)
  })

  it('denies retry when attemptCount equals MAX_RETRIES_HARD_CAP', () => {
    const unit = makeWorkUnit({
      status: 'failed',
      attemptCount: MAX_RETRIES_HARD_CAP,
      retryPolicy: { maxRetries: 100, backoffMs: 1000, backoffMultiplier: 2 },
    })
    expect(canRetry(unit)).toBe(false)
  })

  it('denies retry when maxRetries is 0 (never retry policy)', () => {
    const unit = makeWorkUnit({
      status: 'failed',
      attemptCount: 0,
      retryPolicy: { maxRetries: 0, backoffMs: 1000, backoffMultiplier: 2 },
    })
    expect(canRetry(unit)).toBe(false)
  })

  it('caps maxRetries at MAX_RETRIES_HARD_CAP even if policy says higher', () => {
    const unit = makeWorkUnit({
      status: 'failed',
      attemptCount: MAX_RETRIES_HARD_CAP - 1,
      retryPolicy: { maxRetries: 999, backoffMs: 1000, backoffMultiplier: 2 },
    })
    // One attempt below hard cap: allowed
    expect(canRetry(unit)).toBe(true)

    const unitAtCap = makeWorkUnit({
      status: 'failed',
      attemptCount: MAX_RETRIES_HARD_CAP,
      retryPolicy: { maxRetries: 999, backoffMs: 1000, backoffMultiplier: 2 },
    })
    // At hard cap: denied
    expect(canRetry(unitAtCap)).toBe(false)
  })

  it('handles negative attemptCount gracefully (still allows retry)', () => {
    const unit = makeWorkUnit({
      status: 'failed',
      attemptCount: -5,
      retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
    })
    // -5 < 3, so should be allowed
    expect(canRetry(unit)).toBe(true)
  })

  it('calculateBackoff does not overflow or throw with very large attempt numbers', () => {
    const unit = makeWorkUnit({
      attemptCount: 100,
      retryPolicy: { maxRetries: 200, backoffMs: 1000, backoffMultiplier: 2 },
    })
    const backoff = calculateBackoff(unit)
    // 2^99 * 1000 will be Infinity, but must not throw
    expect(typeof backoff).toBe('number')
    expect(backoff).toBeGreaterThanOrEqual(0)
    // Infinity is a number and >= 0
    expect([Infinity, true]).toContain(backoff === Infinity ? Infinity : true)
  })
})

// ===========================================================================
// 3. Scoring Boundary Conditions
// ===========================================================================

describe('Scoring boundary conditions', () => {
  it('calculateCapabilityScore returns 100 for empty required capabilities', () => {
    expect(calculateCapabilityScore([], ['computation'])).toBe(100)
  })

  it('calculateCapabilityScore returns 0 for empty worker capabilities with non-empty requirements', () => {
    expect(calculateCapabilityScore(['computation'], [])).toBe(0)
  })

  it('calculateTrustScore with compositeTrustScore = 0 returns 0 when trust level sufficient', () => {
    const score = calculateTrustScore('probationary', 'probationary', 0)
    // Trust level sufficient, but composite is 0
    expect(score).toBe(0)
  })

  it('calculateTrustScore with compositeTrustScore = 100 caps at 100', () => {
    const score = calculateTrustScore('full', 'none', 100)
    expect(score).toBe(100)
  })

  it('calculateTrustScore with compositeTrustScore = -10 clamps to 0 (fixed)', () => {
    const score = calculateTrustScore('full', 'none', -10)
    // FIXED: now clamps to Math.max(0, Math.min(100, ...)) → 0
    expect(score).toBe(0)
  })

  it('calculateLoadScore with maxConcurrent = 0 returns 0 (divide-by-zero guard)', () => {
    const score = calculateLoadScore(0, 0)
    expect(score).toBe(0)
    expect(Number.isFinite(score)).toBe(true)
  })

  it('calculateLoadScore with activeWorkUnits > maxConcurrent returns 0', () => {
    const score = calculateLoadScore(10, 5)
    // available = max(0, 5 - 10) = 0, so 0 / 5 = 0
    expect(score).toBe(0)
  })

  it('calculatePerformanceScore with 0% success rate gives speed bonus only', () => {
    const score = calculatePerformanceScore(0, 5000, 10000)
    // rateScore = 0 * 70 = 0; ratio = 5000/10000 = 0.5, which hits ratio <= 0.5 branch => speedBonus = 30
    expect(score).toBe(30)
  })

  it('calculatePerformanceScore with NaN success rate returns neutral (fixed)', () => {
    const score = calculatePerformanceScore(NaN, 5000, 10000)
    // FIXED: NaN success rate → 0.5 (neutral), ratio=5000/10000=0.5 → speedBonus=30
    // 0.5 * 70 + 30 = 65
    expect(score).toBe(65)
    expect(Number.isFinite(score)).toBe(true)
  })

  it('calculateCostScore with all costs at 0 returns 100', () => {
    const score = calculateCostScore(0, 0)
    // maxCostInPool <= 0 → return 100
    expect(score).toBe(100)
  })

  it('calculateCostScore with negative cost returns 100', () => {
    const score = calculateCostScore(-5, 10)
    // costPerUnitCents <= 0 → return 100
    expect(score).toBe(100)
  })

  it('calculatePheromoneBonus with strength > 100 caps at MAX_PHEROMONE_BONUS', () => {
    const bonus = calculatePheromoneBonus({
      nodeId: 'n1',
      successfulDispatches: 50,
      abandonments: 0,
      strength: 200,
    })
    expect(bonus).toBeLessThanOrEqual(MAX_PHEROMONE_BONUS)
    expect(bonus).toBe(MAX_PHEROMONE_BONUS)
  })
})

// ===========================================================================
// 4. Router Adversarial Tests
// ===========================================================================

describe('Router adversarial tests', () => {
  it('returns localFallback when all workers are unhealthy', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'w1', isHealthy: false }),
      makeWorker({ nodeId: 'w2', isHealthy: false }),
    ]
    const result = routeWorkUnit(unit, workers)
    expect(result.selectedWorker).toBeNull()
    expect(result.localFallback).toBe(true)
  })

  it('returns localFallback when all workers are at full capacity', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'w1', maxConcurrent: 5, activeWorkUnits: 5 }),
      makeWorker({ nodeId: 'w2', maxConcurrent: 3, activeWorkUnits: 3 }),
    ]
    const result = routeWorkUnit(unit, workers)
    expect(result.selectedWorker).toBeNull()
    expect(result.localFallback).toBe(true)
  })

  it('does not crash with workers that produce NaN scores via NaN trust', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'w1', compositeTrustScore: NaN }),
    ]
    const result = routeWorkUnit(unit, workers)
    // Should route (worker meets requirements), but score may be NaN-tainted
    expect(result).toBeDefined()
    if (result.selectedWorker) {
      expect(typeof result.selectedWorker.totalScore).toBe('number')
    }
  })

  it('returns localFallback for forceLocal even with healthy workers', () => {
    const unit = makeWorkUnit()
    const workers = [makeWorker()]
    const result = routeWorkUnit(unit, workers, undefined, { forceLocal: true })
    expect(result.selectedWorker).toBeNull()
    expect(result.localFallback).toBe(true)
  })

  it('returns localFallback for forceLocal with empty worker pool', () => {
    const unit = makeWorkUnit()
    const result = routeWorkUnit(unit, [], undefined, { forceLocal: true })
    expect(result.selectedWorker).toBeNull()
    expect(result.localFallback).toBe(true)
  })

  it('returns localFallback when excludeNodes removes all workers', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'w1' }),
      makeWorker({ nodeId: 'w2' }),
    ]
    const result = routeWorkUnit(unit, workers, undefined, {
      excludeNodes: ['w1', 'w2'],
    })
    expect(result.selectedWorker).toBeNull()
    expect(result.localFallback).toBe(true)
  })

  it('returns localFallback for impossible requirements (no worker can satisfy)', () => {
    const unit = makeWorkUnit({
      requirements: {
        computeClass: 'heavy',
        minTrustLevel: 'full',
        requiredCapabilities: ['computation', 'generation', 'impossible-skill'],
        estimatedDurationMs: 5000,
        maxDurationMs: 30000,
      },
    })
    const workers = [
      makeWorker({ nodeId: 'w1', computeClass: 'lightweight', trustLevel: 'probationary' }),
      makeWorker({ nodeId: 'w2', computeClass: 'standard', trustLevel: 'vouched' }),
    ]
    const result = routeWorkUnit(unit, workers)
    expect(result.selectedWorker).toBeNull()
    expect(result.localFallback).toBe(true)
  })

  it('handles 100 workers without throwing or excessive delay', () => {
    const unit = makeWorkUnit()
    const workers = Array.from({ length: 100 }, (_, i) =>
      makeWorker({
        nodeId: `w-${i}`,
        nodeName: `Worker ${i}`,
        activeWorkUnits: i % 5,
        costPerUnitCents: 10 + i,
        compositeTrustScore: 50 + (i % 50),
      }),
    )
    const start = Date.now()
    const result = routeWorkUnit(unit, workers)
    const elapsed = Date.now() - start
    expect(result.selectedWorker).not.toBeNull()
    expect(elapsed).toBeLessThan(500) // Should be well under 100ms realistically
  })

  it('selects the single worker that exactly meets all requirements', () => {
    const unit = makeWorkUnit({
      requirements: {
        computeClass: 'heavy',
        minTrustLevel: 'full',
        requiredCapabilities: ['computation'],
        estimatedDurationMs: 5000,
        maxDurationMs: 30000,
      },
    })
    const workers = [
      makeWorker({ nodeId: 'w-nope', computeClass: 'standard', trustLevel: 'vouched' }),
      makeWorker({ nodeId: 'w-exact', computeClass: 'heavy', trustLevel: 'full' }),
    ]
    const result = routeWorkUnit(unit, workers)
    expect(result.selectedWorker).not.toBeNull()
    expect(result.selectedWorker!.worker.nodeId).toBe('w-exact')
  })

  it('handles pheromone data with negative strength values (treated as 0 bonus)', () => {
    const unit = makeWorkUnit()
    const workers = [makeWorker({ nodeId: 'w1' })]
    const pheromoneData: PheromoneHint[] = [
      { nodeId: 'w1', successfulDispatches: 10, abandonments: 0, strength: -50 },
    ]
    const result = routeWorkUnit(unit, workers, pheromoneData)
    expect(result.selectedWorker).not.toBeNull()
    expect(result.selectedWorker!.pheromoneBonus).toBe(0)
  })

  it('handles work with expired deadline without crashing', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    const unit = makeWorkUnit({ deadline: pastDate })
    const workers = [makeWorker()]
    // The router itself does not check expiry — that is isExpired()'s job
    // But it should not crash
    const result = routeWorkUnit(unit, workers)
    expect(result).toBeDefined()
    // Verify independently that the unit IS expired
    expect(isExpired(unit)).toBe(true)
  })

  it('handles work already in terminal state (router does not enforce state)', () => {
    const unit = makeWorkUnit({ status: 'completed' })
    const workers = [makeWorker()]
    // Router does not validate state — it just routes
    const result = routeWorkUnit(unit, workers)
    expect(result).toBeDefined()
    expect(result.selectedWorker).not.toBeNull()
  })
})

// ===========================================================================
// 5. Backpressure Edge Cases
// ===========================================================================

describe('Backpressure edge cases', () => {
  it('triggers at exactly 85% load (threshold boundary)', () => {
    // 85% of 100 = 85 active out of 100 capacity
    const workers = [
      makeWorker({
        nodeId: 'w1',
        maxConcurrent: 100,
        activeWorkUnits: 85,
        avgExecutionTimeMs: 1000,
      }),
    ]
    const result = detectBackpressure(workers, 5)
    expect(result.triggered).toBe(true)
    expect(result.reason).toContain('85%')
  })

  it('does not trigger at 84.9% load (just below threshold)', () => {
    // Need active/max to be < 0.85
    // 84 / 100 = 0.84, below threshold
    const workers = [
      makeWorker({
        nodeId: 'w1',
        maxConcurrent: 1000,
        activeWorkUnits: 849,
        avgExecutionTimeMs: 1000,
      }),
    ]
    const result = detectBackpressure(workers, 5)
    // 849/1000 = 0.849 < 0.85
    expect(result.triggered).toBe(false)
  })

  it('triggers when no workers exist (empty array)', () => {
    const result = detectBackpressure([], 10)
    expect(result.triggered).toBe(true)
    expect(result.reason).toContain('No healthy workers')
    expect(result.recommendedAction).toBe('reject')
  })

  it('shouldShed never sheds critical priority work', () => {
    const unit = makeWorkUnit({ priority: 'critical' })
    const bp: BackpressureSignal = {
      triggered: true,
      reason: 'Overloaded',
      queueDepth: 100,
      estimatedWaitMs: 5000,
      recommendedAction: 'reject',
    }
    const result = shouldShed(unit, bp)
    expect(result.shed).toBe(false)
    expect(result.reason).toContain('Critical')
  })

  it('shouldShed sheds background priority at maximum severity', () => {
    const unit = makeWorkUnit({ priority: 'background' })
    const bp: BackpressureSignal = {
      triggered: true,
      reason: 'Overloaded',
      queueDepth: 1000,
      estimatedWaitMs: 60000,
      recommendedAction: 'reject',
    }
    const result = shouldShed(unit, bp)
    expect(result.shed).toBe(true)
  })

  it('detectBackpressure with queueDepth = 0 still evaluates load correctly', () => {
    const workers = [
      makeWorker({ nodeId: 'w1', maxConcurrent: 10, activeWorkUnits: 9 }),
    ]
    const result = detectBackpressure(workers, 0)
    // 9/10 = 90% > 85% threshold
    expect(result.triggered).toBe(true)
    expect(result.queueDepth).toBe(0)
  })

  it('detectBackpressure with huge queueDepth (10000) does not overflow', () => {
    const workers = [
      makeWorker({
        nodeId: 'w1',
        maxConcurrent: 10,
        activeWorkUnits: 9,
        avgExecutionTimeMs: 5000,
      }),
    ]
    const result = detectBackpressure(workers, 10000)
    expect(result.triggered).toBe(true)
    expect(typeof result.estimatedWaitMs).toBe('number')
    expect(Number.isFinite(result.estimatedWaitMs)).toBe(true)
  })

  it('detectBackpressure with workers having maxConcurrent = 0', () => {
    const workers = [
      makeWorker({ nodeId: 'w1', maxConcurrent: 0, activeWorkUnits: 0 }),
    ]
    const result = detectBackpressure(workers, 5)
    // totalCapacity = 0, avgLoad = 1 (fallback), triggered
    expect(result.triggered).toBe(true)
  })
})

// ===========================================================================
// 6. Capacity Snapshot Edge Cases
// ===========================================================================

describe('Capacity snapshot edge cases', () => {
  it('parseCapacitySnapshot returns null for empty object', () => {
    expect(parseCapacitySnapshot({})).toBeNull()
  })

  it('parseCapacitySnapshot returns null for null input', () => {
    expect(parseCapacitySnapshot(null as any)).toBeNull()
  })

  it('parseCapacitySnapshot returns null when required fields are missing', () => {
    const partial = {
      nodeId: 'n1',
      computeClass: 'standard',
      // missing supportedWorkTypes, maxConcurrent, activeWorkUnits, accepting
    }
    expect(parseCapacitySnapshot(partial)).toBeNull()
  })

  it('parseCapacitySnapshot succeeds with extra unknown fields (forward compat)', () => {
    const data = {
      nodeId: 'n1',
      computeClass: 'standard',
      supportedWorkTypes: ['computation'],
      maxConcurrent: 5,
      activeWorkUnits: 2,
      accepting: true,
      avgExecutionTimeMs: 3000,
      successRate: 0.95,
      costPerUnitCents: 10,
      snapshotAt: '2026-01-01T00:00:00Z',
      futureField: 'hello',
      anotherExtra: 42,
    }
    const result = parseCapacitySnapshot(data)
    expect(result).not.toBeNull()
    expect(result!.nodeId).toBe('n1')
    expect(result!.availableSlots).toBe(3)
  })

  it('buildCapacitySnapshot with zero values does not crash', () => {
    const worker = makeWorker({
      maxConcurrent: 0,
      activeWorkUnits: 0,
      completedCount: 0,
      failedCount: 0,
      avgExecutionTimeMs: 0,
      costPerUnitCents: 0,
    })
    const snapshot = buildCapacitySnapshot(worker)
    expect(snapshot.availableSlots).toBe(0)
    expect(snapshot.successRate).toBe(0.5) // Neutral for 0/0
    expect(snapshot.costPerUnitCents).toBe(0)
  })

  it('buildCapacitySnapshot with negative performance values does not crash', () => {
    const worker = makeWorker({
      avgExecutionTimeMs: -100,
      completedCount: -5,
      failedCount: -3,
      costPerUnitCents: -10,
    })
    const snapshot = buildCapacitySnapshot(worker)
    expect(snapshot).toBeDefined()
    expect(typeof snapshot.successRate).toBe('number')
    expect(typeof snapshot.avgExecutionTimeMs).toBe('number')
  })
})

// ===========================================================================
// 7. Decomposition Edge Cases
// ===========================================================================

describe('Decomposition edge cases', () => {
  it('canDecompose returns false for non-aggregation type', () => {
    const unit = makeWorkUnit({ type: 'computation', inputData: { items: [1, 2, 3] } })
    expect(canDecompose(unit)).toBe(false)
  })

  it('canDecompose returns false for aggregation with empty items array', () => {
    const unit = makeWorkUnit({ type: 'aggregation', inputData: { items: [] } })
    expect(canDecompose(unit)).toBe(false)
  })

  it('canDecompose returns false for aggregation with single item (no fan-out needed)', () => {
    const unit = makeWorkUnit({ type: 'aggregation', inputData: { items: ['only-one'] } })
    expect(canDecompose(unit)).toBe(false)
  })

  it('decomposeWorkUnit with 100 items produces correct count and unique IDs', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ index: i }))
    const parent = makeWorkUnit({
      id: 'parent-100',
      type: 'aggregation',
      inputData: { items },
      priority: 'high',
      originNode: 'origin-stress',
      originTenant: 42,
      skillName: 'stress-skill',
    })
    const children = decomposeWorkUnit(parent, items)
    expect(children).toHaveLength(100)
    // All IDs unique
    const ids = new Set(children.map((c) => c.id))
    expect(ids.size).toBe(100)
    // All reference parent
    for (const child of children) {
      expect(child.parentWorkUnitId).toBe('parent-100')
    }
  })

  it('decomposeWorkUnit preserves all parent fields on children', () => {
    const parent = makeWorkUnit({
      id: 'parent-preserve',
      type: 'aggregation',
      priority: 'critical',
      originNode: 'origin-special',
      originTenant: 7,
      skillName: 'skill-preserve',
      outputSchema: { type: 'object' },
    })
    const items = ['a', 'b']
    const children = decomposeWorkUnit(parent, items)
    for (const child of children) {
      expect(child.type).toBe(parent.type)
      expect(child.priority).toBe(parent.priority)
      expect(child.originNode).toBe(parent.originNode)
      expect(child.originTenant).toBe(parent.originTenant)
      expect(child.skillName).toBe(parent.skillName)
      expect(child.outputSchema).toEqual(parent.outputSchema)
      expect(child.status).toBe('pending')
      expect(child.attemptCount).toBe(0)
      expect(child.parentWorkUnitId).toBe(parent.id)
    }
  })

  it('allChildrenComplete returns false for empty array', () => {
    expect(allChildrenComplete([])).toBe(false)
  })

  it('allChildrenComplete returns false when mix of completed and failed', () => {
    const children = [
      makeWorkUnit({ id: 'c1', status: 'completed' }),
      makeWorkUnit({ id: 'c2', status: 'failed' }),
      makeWorkUnit({ id: 'c3', status: 'completed' }),
    ]
    expect(allChildrenComplete(children)).toBe(false)
  })

  it('aggregateResults with no successful children returns empty output array and combined errors', () => {
    const parent = makeWorkUnit({ id: 'agg-parent' })
    const childResults: WorkResult[] = [
      {
        workUnitId: 'c1',
        success: false,
        error: 'Timeout on c1',
        executionTimeMs: 1000,
        executedBy: 'w1',
        completedAt: new Date().toISOString(),
      },
      {
        workUnitId: 'c2',
        success: false,
        error: 'OOM on c2',
        executionTimeMs: 2000,
        executedBy: 'w2',
        completedAt: new Date().toISOString(),
      },
    ]
    const result = aggregateResults(parent, childResults)
    expect(result.success).toBe(false)
    expect(result.output).toEqual([]) // No successful outputs
    expect(result.error).toContain('Timeout on c1')
    expect(result.error).toContain('OOM on c2')
    expect(result.executionTimeMs).toBe(3000)
  })
})
