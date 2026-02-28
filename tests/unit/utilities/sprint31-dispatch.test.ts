/**
 * Sprint 31 Tests — "Wire the Brains to the Body"
 *
 * Tests for:
 *   1. Pheromone dispatch learning (feedback loop)
 *   2. Dispatch endpoint validation logic
 *   3. Capacity snapshot round-trip
 *   4. Cross-engine integration (pheromone ↔ workload)
 *
 * @see src/utilities/pheromone-engine.ts — dispatch learning functions
 * @see src/utilities/workload-engine.ts — routing engine
 * @see src/endpoints/federation-dispatch-work.ts — dispatch endpoint
 */

import { describe, it, expect } from 'vitest'
import {
  buildDispatchContext,
  buildDispatchSuccess,
  buildDispatchFailure,
  extractDispatchHints,
  hashContext,
  buildTraversal,
  recordAbandonment,
  calculateStrength,
  ageInDays,
  PHEROMONE_TRAVERSAL_WEIGHT,
} from '../../../src/utilities/pheromone-engine'
import type { PheromoneData, PheromoneContext } from '../../../src/utilities/pheromone-engine'
import {
  routeWorkUnit,
  buildCapacitySnapshot,
  parseCapacitySnapshot,
  detectBackpressure,
  shouldShed,
  calculatePheromoneBonus,
  calculateWorkerScore,
  validateWorkTransition,
  isTerminal,
  canRetry,
  calculateBackoff,
  isExpired,
  meetsRequirements,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUTS,
  WORK_TYPE_MIN_TRUST,
  BACKPRESSURE_LOAD_THRESHOLD,
} from '../../../src/utilities/workload-engine'
import type {
  WorkUnit,
  WorkerCapabilities,
  PheromoneHint,
  CapacitySnapshot,
} from '../../../src/utilities/workload-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-28T12:00:00Z')

function makeWorker(overrides: Partial<WorkerCapabilities> = {}): WorkerCapabilities {
  return {
    nodeId: 'node-alpha',
    nodeName: 'Alpha Node',
    domain: 'alpha.example.com',
    computeClass: 'standard',
    supportedWorkTypes: ['computation', 'analysis', 'transformation'],
    maxConcurrent: 5,
    activeWorkUnits: 1,
    accepting: true,
    costPerUnitCents: 10,
    trustLevel: 'vouched',
    compositeTrustScore: 70,
    completedCount: 50,
    failedCount: 2,
    avgExecutionTimeMs: 5000,
    lastHeartbeat: NOW.toISOString(),
    isHealthy: true,
    ...overrides,
  }
}

function makeWorkUnit(overrides: Partial<WorkUnit> = {}): WorkUnit {
  return {
    id: 'WU-20260228-TEST',
    type: 'computation',
    status: 'pending',
    priority: 'normal',
    inputData: { task: 'test' },
    requirements: {
      computeClass: 'standard',
      minTrustLevel: 'probationary',
      requiredCapabilities: ['computation'],
      estimatedDurationMs: 10000,
      maxDurationMs: 30000,
    },
    retryPolicy: { ...DEFAULT_RETRY_POLICY },
    attemptCount: 0,
    originNode: 'local',
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function makePheromone(overrides: Partial<PheromoneData> = {}): PheromoneData {
  return {
    contextHash: 'ph_test1234',
    path: 'dispatch/computation/node-alpha',
    toolName: 'node:node-alpha',
    strength: 50,
    successfulTraversals: 5,
    abandonments: 0,
    lastTraversedAt: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Pheromone Dispatch Learning
// ═══════════════════════════════════════════════════════════════════════════

describe('Dispatch Learning — buildDispatchContext', () => {
  it('creates a context with node: prefix toolName', () => {
    const ctx = buildDispatchContext('node-alpha', 'computation')
    expect(ctx.toolName).toBe('node:node-alpha')
    expect(ctx.query).toBe('dispatch computation')
  })

  it('includes skill as additionalContext', () => {
    const ctx = buildDispatchContext('node-beta', 'analysis', 'data-crunch')
    expect(ctx.additionalContext).toBe('skill:data-crunch')
  })

  it('includes tenantSlug', () => {
    const ctx = buildDispatchContext('node-gamma', 'generation', undefined, 'my-tenant')
    expect(ctx.tenantSlug).toBe('my-tenant')
  })

  it('omits additionalContext when no skill', () => {
    const ctx = buildDispatchContext('node-alpha', 'computation')
    expect(ctx.additionalContext).toBeUndefined()
  })

  it('produces deterministic hashes for same inputs', () => {
    const a = buildDispatchContext('node-x', 'computation', 'skill-a', 'tenant-1')
    const b = buildDispatchContext('node-x', 'computation', 'skill-a', 'tenant-1')
    expect(hashContext(a)).toBe(hashContext(b))
  })
})

describe('Dispatch Learning — buildDispatchSuccess', () => {
  it('creates a new trail on first successful dispatch', () => {
    const result = buildDispatchSuccess(null, 'node-alpha', 'computation', undefined, undefined, NOW)
    expect(result.isNew).toBe(true)
    expect(result.pheromone.path).toBe('dispatch/computation/node-alpha')
    expect(result.pheromone.toolName).toBe('node:node-alpha')
    expect(result.pheromone.successfulTraversals).toBe(1)
    expect(result.pheromone.abandonments).toBe(0)
    expect(result.pheromone.strength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
    expect(result.newStrength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)
  })

  it('reinforces an existing trail', () => {
    const existing = makePheromone({
      successfulTraversals: 3,
      strength: 30,
    })
    const result = buildDispatchSuccess(existing, 'node-alpha', 'computation', undefined, undefined, NOW)
    expect(result.isNew).toBe(false)
    expect(result.pheromone.successfulTraversals).toBe(4)
    expect(result.previousStrength).toBe(30)
    expect(result.newStrength).toBeGreaterThan(30)
  })

  it('caps strength at 100 even with many traversals', () => {
    const existing = makePheromone({
      successfulTraversals: 15,
      strength: 100,
    })
    const result = buildDispatchSuccess(existing, 'node-alpha', 'computation', undefined, undefined, NOW)
    expect(result.pheromone.strength).toBeLessThanOrEqual(100)
  })

  it('includes skill context in the path', () => {
    const result = buildDispatchSuccess(null, 'node-beta', 'analysis', 'ml-predict', 'my-tenant', NOW)
    expect(result.pheromone.path).toBe('dispatch/analysis/node-beta')
    expect(result.pheromone.toolName).toBe('node:node-beta')
  })
})

describe('Dispatch Learning — buildDispatchFailure', () => {
  it('creates a new trail with abandonment on first failure', () => {
    const result = buildDispatchFailure(null, 'node-bad', 'computation', undefined, undefined, NOW)
    expect(result.path).toBe('dispatch/computation/node-bad')
    expect(result.toolName).toBe('node:node-bad')
    expect(result.successfulTraversals).toBe(0)
    expect(result.abandonments).toBe(1)
    expect(result.strength).toBe(0)
  })

  it('increments abandonments on existing trail', () => {
    const existing = makePheromone({
      successfulTraversals: 5,
      abandonments: 1,
      strength: 40,
    })
    const result = buildDispatchFailure(existing, 'node-alpha', 'computation', undefined, undefined, NOW)
    expect(result.abandonments).toBe(2)
    // Strength is recalculated from scratch — compare against what
    // the formula gives before the new abandonment was added
    const preAbandonmentStrength = calculateStrength(5, 0, 1)
    expect(result.strength).toBeLessThan(preAbandonmentStrength)
  })

  it('severely weakens trail after many failures', () => {
    const existing = makePheromone({
      successfulTraversals: 3,
      abandonments: 5,
      strength: 20,
    })
    const result = buildDispatchFailure(existing, 'node-alpha', 'computation', undefined, undefined, NOW)
    expect(result.abandonments).toBe(6)
    // Strength recalculated from traversals — compare against pre-abandonment formula value
    const preAbandonmentStrength = calculateStrength(3, 0, 5)
    expect(result.strength).toBeLessThan(preAbandonmentStrength)
  })
})

describe('Dispatch Learning — extractDispatchHints', () => {
  it('filters to dispatch paths only', () => {
    const pheromones: PheromoneData[] = [
      makePheromone({ path: 'dispatch/computation/node-alpha', toolName: 'node:node-alpha' }),
      makePheromone({ path: '/dashboard', toolName: 'navigate' }),
      makePheromone({ path: 'dispatch/analysis/node-beta', toolName: 'node:node-beta' }),
    ]
    const hints = extractDispatchHints(pheromones)
    expect(hints).toHaveLength(2)
    expect(hints[0].nodeId).toBe('node-alpha')
    expect(hints[1].nodeId).toBe('node-beta')
  })

  it('returns empty array when no dispatch trails', () => {
    const pheromones = [
      makePheromone({ path: '/settings', toolName: 'navigate' }),
    ]
    expect(extractDispatchHints(pheromones)).toHaveLength(0)
  })

  it('extracts correct hint fields', () => {
    const pheromones = [
      makePheromone({
        path: 'dispatch/computation/node-x',
        toolName: 'node:node-x',
        successfulTraversals: 10,
        abandonments: 2,
        strength: 75,
      }),
    ]
    const hints = extractDispatchHints(pheromones)
    expect(hints[0]).toEqual({
      nodeId: 'node-x',
      successfulDispatches: 10,
      abandonments: 2,
      strength: 75,
    })
  })

  it('handles empty input', () => {
    expect(extractDispatchHints([])).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Cross-Engine Integration: Pheromone → Workload
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Engine — Pheromone hints influence routing', () => {
  it('pheromone bonus increases total score', () => {
    const hint: PheromoneHint = {
      nodeId: 'node-alpha',
      successfulDispatches: 10,
      abandonments: 0,
      strength: 80,
    }
    const bonus = calculatePheromoneBonus(hint)
    expect(bonus).toBeGreaterThan(0)
    expect(bonus).toBeLessThanOrEqual(15)
  })

  it('no hint produces zero bonus', () => {
    expect(calculatePheromoneBonus(undefined)).toBe(0)
  })

  it('zero-strength hint produces zero bonus', () => {
    const hint: PheromoneHint = {
      nodeId: 'node-dead',
      successfulDispatches: 0,
      abandonments: 10,
      strength: 0,
    }
    expect(calculatePheromoneBonus(hint)).toBe(0)
  })

  it('routing prefers node with pheromone history', () => {
    const unit = makeWorkUnit()
    const workerA = makeWorker({ nodeId: 'no-history', nodeName: 'Fresh Node' })
    const workerB = makeWorker({ nodeId: 'proven-node', nodeName: 'Proven Node' })

    const hints: PheromoneHint[] = [{
      nodeId: 'proven-node',
      successfulDispatches: 20,
      abandonments: 0,
      strength: 100,
    }]

    const decision = routeWorkUnit(unit, [workerA, workerB], hints)
    expect(decision.selectedWorker).not.toBeNull()
    expect(decision.selectedWorker!.worker.nodeId).toBe('proven-node')
    expect(decision.selectedWorker!.pheromoneBonus).toBeGreaterThan(0)
  })

  it('pheromone bonus is not enough to override much better scores', () => {
    const unit = makeWorkUnit()
    // Worker A: excellent capacity but no pheromone
    const workerA = makeWorker({
      nodeId: 'strong-node',
      activeWorkUnits: 0,
      maxConcurrent: 10,
      compositeTrustScore: 95,
      completedCount: 200,
      failedCount: 0,
    })
    // Worker B: near capacity, but has pheromone history
    const workerB = makeWorker({
      nodeId: 'proven-node',
      activeWorkUnits: 4,
      maxConcurrent: 5,
      compositeTrustScore: 50,
    })

    const hints: PheromoneHint[] = [{
      nodeId: 'proven-node',
      successfulDispatches: 10,
      abandonments: 0,
      strength: 100,
    }]

    const decision = routeWorkUnit(unit, [workerA, workerB], hints)
    // The strong node should win despite no pheromone history
    expect(decision.selectedWorker!.worker.nodeId).toBe('strong-node')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Capacity Snapshot Round-Trip
// ═══════════════════════════════════════════════════════════════════════════

describe('Capacity Snapshot — heartbeat integration', () => {
  it('buildCapacitySnapshot produces valid snapshot', () => {
    const worker = makeWorker({
      activeWorkUnits: 2,
      maxConcurrent: 5,
    })
    const snapshot = buildCapacitySnapshot(worker, NOW)
    expect(snapshot.nodeId).toBe('node-alpha')
    expect(snapshot.availableSlots).toBe(3)
    expect(snapshot.activeWorkUnits).toBe(2)
    expect(snapshot.maxConcurrent).toBe(5)
    expect(snapshot.accepting).toBe(true)
    expect(snapshot.snapshotAt).toBe(NOW.toISOString())
  })

  it('round-trips through parse', () => {
    const worker = makeWorker()
    const snapshot = buildCapacitySnapshot(worker, NOW)
    const parsed = parseCapacitySnapshot(snapshot as unknown as Record<string, unknown>)
    expect(parsed).not.toBeNull()
    expect(parsed!.nodeId).toBe(snapshot.nodeId)
    expect(parsed!.computeClass).toBe(snapshot.computeClass)
    expect(parsed!.maxConcurrent).toBe(snapshot.maxConcurrent)
    expect(parsed!.activeWorkUnits).toBe(snapshot.activeWorkUnits)
    expect(parsed!.accepting).toBe(snapshot.accepting)
  })

  it('parseCapacitySnapshot rejects invalid data', () => {
    expect(parseCapacitySnapshot({})).toBeNull()
    expect(parseCapacitySnapshot({ nodeId: 123 } as any)).toBeNull()
    expect(parseCapacitySnapshot({ nodeId: 'x', computeClass: 'mega' } as any)).toBeNull()
  })

  it('snapshot correctly computes available slots', () => {
    const worker = makeWorker({ activeWorkUnits: 4, maxConcurrent: 5 })
    const snapshot = buildCapacitySnapshot(worker)
    expect(snapshot.availableSlots).toBe(1)
  })

  it('snapshot handles fully loaded worker', () => {
    const worker = makeWorker({ activeWorkUnits: 5, maxConcurrent: 5 })
    const snapshot = buildCapacitySnapshot(worker)
    expect(snapshot.availableSlots).toBe(0)
  })

  it('snapshot includes success rate', () => {
    const worker = makeWorker({ completedCount: 48, failedCount: 2 })
    const snapshot = buildCapacitySnapshot(worker)
    expect(snapshot.successRate).toBeCloseTo(0.96, 1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Routing with Backpressure & Shedding
// ═══════════════════════════════════════════════════════════════════════════

describe('Backpressure & Shedding — dispatch integration', () => {
  it('detectBackpressure triggers when all workers heavily loaded', () => {
    const workers = [
      makeWorker({ activeWorkUnits: 5, maxConcurrent: 5 }),
      makeWorker({ nodeId: 'b', activeWorkUnits: 4, maxConcurrent: 5 }),
    ]
    const bp = detectBackpressure(workers, 3)
    expect(bp.triggered).toBe(true)
    expect(bp.queueDepth).toBe(3)
  })

  it('detectBackpressure does not trigger when workers have room', () => {
    const workers = [
      makeWorker({ activeWorkUnits: 1, maxConcurrent: 10 }),
      makeWorker({ nodeId: 'b', activeWorkUnits: 2, maxConcurrent: 10 }),
    ]
    const bp = detectBackpressure(workers, 0)
    expect(bp.triggered).toBe(false)
  })

  it('shouldShed never sheds critical work', () => {
    const unit = makeWorkUnit({ priority: 'critical' })
    const bp = { triggered: true, reason: 'test', queueDepth: 10, estimatedWaitMs: 5000, recommendedAction: 'reject' as const }
    const result = shouldShed(unit, bp)
    expect(result.shed).toBe(false)
  })

  it('shouldShed sheds background work under any backpressure', () => {
    const unit = makeWorkUnit({ priority: 'background' })
    const bp = { triggered: true, reason: 'test', queueDepth: 5, estimatedWaitMs: 1000, recommendedAction: 'queue' as const }
    const result = shouldShed(unit, bp)
    expect(result.shed).toBe(true)
  })

  it('shouldShed sheds low priority work under any backpressure', () => {
    const unit = makeWorkUnit({ priority: 'low' })
    const bp = { triggered: true, reason: 'test', queueDepth: 5, estimatedWaitMs: 1000, recommendedAction: 'queue' as const }
    const result = shouldShed(unit, bp)
    expect(result.shed).toBe(true)
  })

  it('shouldShed keeps high priority unless action is reject', () => {
    const unit = makeWorkUnit({ priority: 'high' })
    const bpQueue = { triggered: true, reason: 'test', queueDepth: 5, estimatedWaitMs: 1000, recommendedAction: 'queue' as const }
    expect(shouldShed(unit, bpQueue).shed).toBe(false)

    const bpReject = { ...bpQueue, recommendedAction: 'reject' as const }
    expect(shouldShed(unit, bpReject).shed).toBe(true)
  })

  it('shouldShed returns false when no backpressure', () => {
    const unit = makeWorkUnit({ priority: 'background' })
    const bp = { triggered: false, reason: 'ok', queueDepth: 0, estimatedWaitMs: 0, recommendedAction: 'queue' as const }
    expect(shouldShed(unit, bp).shed).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Routing End-to-End
// ═══════════════════════════════════════════════════════════════════════════

describe('routeWorkUnit — dispatch-grade routing', () => {
  it('selects best worker from pool', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'a', compositeTrustScore: 50, activeWorkUnits: 3 }),
      makeWorker({ nodeId: 'b', compositeTrustScore: 90, activeWorkUnits: 0 }),
      makeWorker({ nodeId: 'c', compositeTrustScore: 70, activeWorkUnits: 1 }),
    ]
    const decision = routeWorkUnit(unit, workers)
    expect(decision.selectedWorker).not.toBeNull()
    expect(decision.selectedWorker!.worker.nodeId).toBe('b')
    expect(decision.localFallback).toBe(false)
  })

  it('falls back to local when no workers', () => {
    const unit = makeWorkUnit()
    const decision = routeWorkUnit(unit, [])
    expect(decision.selectedWorker).toBeNull()
    expect(decision.localFallback).toBe(true)
  })

  it('falls back to local when forceLocal is set', () => {
    const unit = makeWorkUnit()
    const workers = [makeWorker()]
    const decision = routeWorkUnit(unit, workers, undefined, { forceLocal: true })
    expect(decision.selectedWorker).toBeNull()
    expect(decision.localFallback).toBe(true)
  })

  it('excludes specified nodes', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'excluded' }),
      makeWorker({ nodeId: 'available', compositeTrustScore: 60 }),
    ]
    const decision = routeWorkUnit(unit, workers, undefined, { excludeNodes: ['excluded'] })
    expect(decision.selectedWorker!.worker.nodeId).toBe('available')
  })

  it('filters workers that lack required compute class', () => {
    const unit = makeWorkUnit({
      requirements: {
        ...makeWorkUnit().requirements,
        computeClass: 'heavy',
      },
    })
    const workers = [
      makeWorker({ nodeId: 'lightweight', computeClass: 'lightweight' }),
      makeWorker({ nodeId: 'heavy', computeClass: 'heavy' }),
    ]
    const decision = routeWorkUnit(unit, workers)
    expect(decision.selectedWorker!.worker.nodeId).toBe('heavy')
  })

  it('filters workers below trust threshold', () => {
    const unit = makeWorkUnit({
      type: 'generation', // requires 'vouched' trust
      requirements: {
        ...makeWorkUnit().requirements,
        minTrustLevel: 'vouched',
        requiredCapabilities: ['generation'],
      },
    })
    const workers = [
      makeWorker({ nodeId: 'low-trust', trustLevel: 'probationary', supportedWorkTypes: ['generation'] }),
      makeWorker({ nodeId: 'high-trust', trustLevel: 'full', supportedWorkTypes: ['generation'] }),
    ]
    const decision = routeWorkUnit(unit, workers)
    expect(decision.selectedWorker!.worker.nodeId).toBe('high-trust')
  })

  it('returns alternates', () => {
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'a', compositeTrustScore: 90 }),
      makeWorker({ nodeId: 'b', compositeTrustScore: 80 }),
      makeWorker({ nodeId: 'c', compositeTrustScore: 70 }),
    ]
    const decision = routeWorkUnit(unit, workers, undefined, { maxResults: 3 })
    expect(decision.alternates.length).toBe(2)
  })

  it('records routingTimeMs', () => {
    const unit = makeWorkUnit()
    const decision = routeWorkUnit(unit, [makeWorker()])
    expect(decision.routingTimeMs).toBeGreaterThanOrEqual(0)
    expect(typeof decision.routedAt).toBe('string')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Work Unit State Machine (dispatch lifecycle)
// ═══════════════════════════════════════════════════════════════════════════

describe('Work Unit State Machine — dispatch lifecycle', () => {
  it('pending → claimed is valid', () => {
    expect(validateWorkTransition('pending', 'claimed').valid).toBe(true)
  })

  it('claimed → executing is valid', () => {
    expect(validateWorkTransition('claimed', 'executing').valid).toBe(true)
  })

  it('executing → completed is valid', () => {
    expect(validateWorkTransition('executing', 'completed').valid).toBe(true)
  })

  it('executing → failed is valid', () => {
    expect(validateWorkTransition('executing', 'failed').valid).toBe(true)
  })

  it('failed → pending is valid (retry)', () => {
    expect(validateWorkTransition('failed', 'pending').valid).toBe(true)
  })

  it('completed → pending is invalid (terminal)', () => {
    expect(validateWorkTransition('completed', 'pending').valid).toBe(false)
  })

  it('cancelled → anything is invalid (terminal)', () => {
    expect(validateWorkTransition('cancelled', 'pending').valid).toBe(false)
    expect(validateWorkTransition('cancelled', 'claimed').valid).toBe(false)
  })

  it('isTerminal correctly identifies terminal states', () => {
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('pending')).toBe(false)
    expect(isTerminal('executing')).toBe(false)
  })

  it('canRetry checks attempt count vs policy', () => {
    // canRetry requires status 'failed' or 'timeout' before checking attempt count
    const unit = makeWorkUnit({ attemptCount: 2, status: 'failed' })
    expect(canRetry(unit)).toBe(true)

    const maxedOut = makeWorkUnit({ attemptCount: 3, status: 'failed' })
    expect(canRetry(maxedOut)).toBe(false)
  })

  it('calculateBackoff produces exponential delays', () => {
    const unit1 = makeWorkUnit({ attemptCount: 1 })
    const unit2 = makeWorkUnit({ attemptCount: 2 })
    const unit3 = makeWorkUnit({ attemptCount: 3 })

    const b1 = calculateBackoff(unit1)
    const b2 = calculateBackoff(unit2)
    const b3 = calculateBackoff(unit3)

    expect(b1).toBe(1000) // 1000 * 2^0
    expect(b2).toBe(2000) // 1000 * 2^1
    expect(b3).toBe(4000) // 1000 * 2^2
  })

  it('calculateBackoff caps at 5 minutes', () => {
    const unit = makeWorkUnit({ attemptCount: 100 })
    const b = calculateBackoff(unit)
    expect(b).toBeLessThanOrEqual(300_000)
  })

  it('isExpired detects past deadline', () => {
    const pastDeadline = makeWorkUnit({
      deadline: '2026-02-27T00:00:00Z',
    })
    expect(isExpired(pastDeadline, NOW)).toBe(true)

    const futureDeadline = makeWorkUnit({
      deadline: '2026-03-01T00:00:00Z',
    })
    expect(isExpired(futureDeadline, NOW)).toBe(false)
  })

  it('isExpired returns false when no deadline', () => {
    const unit = makeWorkUnit()
    expect(isExpired(unit, NOW)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. Dispatch Feedback Loop — Full Cycle
// ═══════════════════════════════════════════════════════════════════════════

describe('Full Dispatch Cycle — route → execute → learn', () => {
  it('successful dispatch → pheromone reinforcement → better future routing', () => {
    // Step 1: Route work to a node
    const unit = makeWorkUnit()
    const workers = [
      makeWorker({ nodeId: 'node-alpha' }),
      makeWorker({ nodeId: 'node-beta', compositeTrustScore: 60 }),
    ]
    const decision = routeWorkUnit(unit, workers)
    const selectedNodeId = decision.selectedWorker!.worker.nodeId

    // Step 2: Work completes successfully → record pheromone success
    const result = buildDispatchSuccess(null, selectedNodeId, unit.type, undefined, undefined, NOW)
    expect(result.isNew).toBe(true)
    expect(result.pheromone.strength).toBe(PHEROMONE_TRAVERSAL_WEIGHT)

    // Step 3: Second successful dispatch → reinforced trail
    const result2 = buildDispatchSuccess(result.pheromone, selectedNodeId, unit.type, undefined, undefined, NOW)
    expect(result2.pheromone.successfulTraversals).toBe(2)
    expect(result2.pheromone.strength).toBeGreaterThanOrEqual(result.pheromone.strength)

    // Step 4: Use pheromone data in next routing decision
    const hints = extractDispatchHints([result2.pheromone])
    expect(hints).toHaveLength(1)
    expect(hints[0].nodeId).toBe(selectedNodeId)
    expect(hints[0].strength).toBeGreaterThan(0)

    // Step 5: Route again — proven node should get a bonus
    const decision2 = routeWorkUnit(unit, workers, hints)
    const provenMatch = decision2.selectedWorker!
    expect(provenMatch.pheromoneBonus).toBeGreaterThan(0)
  })

  it('failed dispatch → pheromone weakening → penalized in future routing', () => {
    // Step 1: Create a trail with some history
    let trail = buildDispatchSuccess(null, 'node-flaky', 'computation', undefined, undefined, NOW).pheromone
    trail = buildDispatchSuccess(trail, 'node-flaky', 'computation', undefined, undefined, NOW).pheromone

    const initialStrength = trail.strength

    // Step 2: Work fails → record abandonment
    trail = buildDispatchFailure(trail, 'node-flaky', 'computation', undefined, undefined, NOW)
    expect(trail.abandonments).toBe(1)
    expect(trail.strength).toBeLessThan(initialStrength)

    // Step 3: Another failure
    trail = buildDispatchFailure(trail, 'node-flaky', 'computation', undefined, undefined, NOW)
    expect(trail.abandonments).toBe(2)
    expect(trail.strength).toBeLessThan(initialStrength)
  })

  it('trail decays over time — stale routes lose preference', () => {
    // Create trail at time T
    const t0 = new Date('2026-01-01T00:00:00Z')
    const trail = buildDispatchSuccess(null, 'node-old', 'computation', undefined, undefined, t0).pheromone

    // 30 days later, strength should have decayed
    const t30 = new Date('2026-01-31T00:00:00Z')
    const age = ageInDays(trail.createdAt!, t30)
    const decayedStrength = calculateStrength(trail.successfulTraversals, age, trail.abandonments)
    expect(decayedStrength).toBeLessThan(trail.strength)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. Trust Gating for Work Types
// ═══════════════════════════════════════════════════════════════════════════

describe('Trust Gating — sensitive work requires higher trust', () => {
  it('generation work requires vouched trust', () => {
    expect(WORK_TYPE_MIN_TRUST.generation).toBe('vouched')
  })

  it('aggregation work requires vouched trust', () => {
    expect(WORK_TYPE_MIN_TRUST.aggregation).toBe('vouched')
  })

  it('computation work only requires probationary', () => {
    expect(WORK_TYPE_MIN_TRUST.computation).toBe('probationary')
  })

  it('meetsRequirements rejects untrusted node for generation work', () => {
    const worker = makeWorker({
      trustLevel: 'probationary',
      supportedWorkTypes: ['generation'],
    })
    const requirements = {
      computeClass: 'standard' as const,
      minTrustLevel: 'vouched' as const,
      requiredCapabilities: ['generation'],
      estimatedDurationMs: 10000,
      maxDurationMs: 30000,
    }
    expect(meetsRequirements(worker, requirements)).toBe(false)
  })

  it('meetsRequirements accepts trusted node for generation work', () => {
    const worker = makeWorker({
      trustLevel: 'full',
      supportedWorkTypes: ['generation'],
    })
    const requirements = {
      computeClass: 'standard' as const,
      minTrustLevel: 'vouched' as const,
      requiredCapabilities: ['generation'],
      estimatedDurationMs: 10000,
      maxDurationMs: 30000,
    }
    expect(meetsRequirements(worker, requirements)).toBe(true)
  })
})
