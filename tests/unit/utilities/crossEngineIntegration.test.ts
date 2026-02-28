/**
 * Cross-Engine Integration Tests — Sprint 30
 *
 * Verifies that the utility engines (workload, pheromone, federation) work
 * together correctly at their contract boundaries. Pure logic tests — no
 * database, no Payload, no network.
 *
 * These tests catch the subtle bugs that live between modules: type mismatches,
 * incompatible value ranges, ordering assumptions that diverge across engines.
 *
 * @see src/utilities/workload-engine.ts
 * @see src/utilities/pheromone-engine.ts
 * @see src/utilities/federationEngine.ts
 * @see src/utilities/orderRoutingEngine.ts
 */

import { describe, it, expect } from 'vitest'

// From workload-engine
import {
  calculatePheromoneBonus,
  calculateWorkerScore,
  routeWorkUnit,
  buildCapacitySnapshot,
  parseCapacitySnapshot,
  trustLevelSufficient,
  computeClassSufficient,
  WORKLOAD_WEIGHTS,
  TRUST_LEVEL_VALUES,
  WORK_TYPE_MIN_TRUST,
  COMPUTE_CLASS_VALUES,
  MAX_PHEROMONE_BONUS,
  type WorkUnit,
  type WorkerCapabilities,
  type PheromoneHint,
} from '@/utilities/workload-engine'

// From pheromone-engine
import {
  calculateStrength,
  buildTraversal,
  recordAbandonment,
  PHEROMONE_MAX_STRENGTH,
  PHEROMONE_HALF_LIFE_DAYS,
  PHEROMONE_DECAY_THRESHOLD,
  type PheromoneData,
  type PheromoneContext,
} from '@/utilities/pheromone-engine'

// From federation engine
import {
  isHeartbeatHealthy,
  calculateTrustLevel,
  calculateCompositeTrustScore,
  MAX_HEARTBEAT_AGE_SECONDS,
  type Ministry,
  type TrustLevel,
} from '@/utilities/federationEngine'

// From order routing engine (for scoring comparison)
import {
  WEIGHT_CAPABILITY,
  WEIGHT_PROXIMITY,
  WEIGHT_RATING,
  WEIGHT_FAIRNESS,
} from '@/utilities/orderRoutingEngine'

// ---------------------------------------------------------------------------
// Factory Helpers
// ---------------------------------------------------------------------------

function makeWorkUnit(overrides: Partial<WorkUnit> = {}): WorkUnit {
  return {
    id: 'wu-test-001',
    type: 'computation',
    status: 'pending',
    priority: 'normal',
    inputData: { payload: 'test' },
    requirements: {
      computeClass: 'standard',
      minTrustLevel: 'probationary',
      requiredCapabilities: ['computation'],
      estimatedDurationMs: 5000,
      maxDurationMs: 30000,
    },
    retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
    attemptCount: 0,
    originNode: 'origin-node',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeWorker(overrides: Partial<WorkerCapabilities> = {}): WorkerCapabilities {
  return {
    nodeId: 'worker-001',
    nodeName: 'Test Worker',
    domain: 'test.example.com',
    computeClass: 'standard',
    supportedWorkTypes: ['computation', 'analysis'],
    maxConcurrent: 10,
    activeWorkUnits: 2,
    accepting: true,
    costPerUnitCents: 5,
    trustLevel: 'vouched',
    compositeTrustScore: 75,
    completedCount: 100,
    failedCount: 5,
    avgExecutionTimeMs: 3000,
    isHealthy: true,
    ...overrides,
  }
}

function makePheromoneHint(overrides: Partial<PheromoneHint> = {}): PheromoneHint {
  return {
    nodeId: 'worker-001',
    successfulDispatches: 10,
    abandonments: 1,
    strength: 80,
    ...overrides,
  }
}

function makePheromoneData(overrides: Partial<PheromoneData> = {}): PheromoneData {
  return {
    contextHash: 'ph_abcd1234',
    path: '/dashboard/orders',
    strength: 50,
    successfulTraversals: 5,
    abandonments: 1,
    lastTraversedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeMinistry(overrides: Partial<Ministry> = {}): Ministry {
  return {
    id: 'ministry-001',
    name: 'Test Ministry',
    domain: 'test.angel.os',
    operator: 'Test Operator',
    status: 'active',
    appliedAt: '2025-01-01T00:00:00Z',
    vouchesReceived: [],
    constitutionVersion: '1.0.0',
    capabilities: ['commerce', 'logistics'],
    lastHeartbeat: new Date().toISOString(),
    ...overrides,
  }
}

function makePheromoneContext(overrides: Partial<PheromoneContext> = {}): PheromoneContext {
  return {
    query: 'find nearby food providers',
    toolName: 'searchProducts',
    tenantSlug: 'test-tenant',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Workload Engine <-> Pheromone Engine
// ---------------------------------------------------------------------------

describe('Workload Engine <-> Pheromone Engine', () => {
  it('PheromoneHint shape aligns with PheromoneData fields', () => {
    // PheromoneHint uses: nodeId, successfulDispatches, abandonments, strength
    // PheromoneData uses: successfulTraversals, abandonments, strength
    // The "strength" field bridges the two engines
    const pheromoneData = makePheromoneData({
      successfulTraversals: 10,
      abandonments: 2,
      strength: 80,
    })

    const hint: PheromoneHint = {
      nodeId: 'worker-001',
      successfulDispatches: pheromoneData.successfulTraversals,
      abandonments: pheromoneData.abandonments,
      strength: pheromoneData.strength,
    }

    expect(hint.successfulDispatches).toBe(pheromoneData.successfulTraversals)
    expect(hint.abandonments).toBe(pheromoneData.abandonments)
    expect(hint.strength).toBe(pheromoneData.strength)
  })

  it('calculateStrength produces values in range that calculatePheromoneBonus accepts', () => {
    // Pheromone engine: calculateStrength returns 0..PHEROMONE_MAX_STRENGTH (100)
    // Workload engine: calculatePheromoneBonus expects strength 0-100
    const freshStrength = calculateStrength(10, 0, 0)
    expect(freshStrength).toBeGreaterThanOrEqual(0)
    expect(freshStrength).toBeLessThanOrEqual(PHEROMONE_MAX_STRENGTH)

    const bonus = calculatePheromoneBonus({ nodeId: 'n', successfulDispatches: 10, abandonments: 0, strength: freshStrength })
    expect(bonus).toBeGreaterThanOrEqual(0)
    expect(bonus).toBeLessThanOrEqual(MAX_PHEROMONE_BONUS)
  })

  it('max pheromone strength maps to max pheromone bonus', () => {
    const maxStrength = calculateStrength(10, 0, 0) // 10 traversals, age 0, no abandonments = 100
    expect(maxStrength).toBe(PHEROMONE_MAX_STRENGTH)

    const bonus = calculatePheromoneBonus({
      nodeId: 'n',
      successfulDispatches: 10,
      abandonments: 0,
      strength: maxStrength,
    })
    expect(bonus).toBe(MAX_PHEROMONE_BONUS)
  })

  it('zero pheromone strength maps to zero bonus', () => {
    const zeroStrength = calculateStrength(0, 0, 0) // no traversals = 0
    expect(zeroStrength).toBe(0)

    const bonus = calculatePheromoneBonus({
      nodeId: 'n',
      successfulDispatches: 0,
      abandonments: 0,
      strength: zeroStrength,
    })
    expect(bonus).toBe(0)
  })

  it('a node with strong pheromone trails gets a meaningful routing advantage', () => {
    const workUnit = makeWorkUnit()
    const workerA = makeWorker({ nodeId: 'worker-A', compositeTrustScore: 70 })
    const workerB = makeWorker({ nodeId: 'worker-B', compositeTrustScore: 70 })

    // Worker A has strong pheromone trail, Worker B has none
    const pheromoneData: PheromoneHint[] = [
      makePheromoneHint({ nodeId: 'worker-A', strength: PHEROMONE_MAX_STRENGTH }),
    ]

    const decision = routeWorkUnit(workUnit, [workerA, workerB], pheromoneData)

    expect(decision.selectedWorker).not.toBeNull()
    expect(decision.selectedWorker!.worker.nodeId).toBe('worker-A')
    expect(decision.selectedWorker!.pheromoneBonus).toBe(MAX_PHEROMONE_BONUS)

    // Worker B should have zero pheromone bonus
    const altB = decision.alternates.find((a) => a.worker.nodeId === 'worker-B')
    expect(altB?.pheromoneBonus ?? 0).toBe(0)
  })

  it('pheromone bonus is additive to weighted score, not multiplicative', () => {
    // Verify the formula: totalScore = weightedSum + pheromoneBonus
    const capScore = 100
    const trustScore = 80
    const loadScore = 60
    const perfScore = 50
    const costScore = 90

    const weightedWithout = calculateWorkerScore(capScore, trustScore, loadScore, perfScore, costScore, 0)
    const weightedWith = calculateWorkerScore(capScore, trustScore, loadScore, perfScore, costScore, MAX_PHEROMONE_BONUS)

    expect(weightedWith - weightedWithout).toBe(MAX_PHEROMONE_BONUS)
  })

  it('decayed pheromone still produces proportional bonus', () => {
    // After half-life (21 days), strength is roughly halved
    const halfLifeStrength = calculateStrength(10, PHEROMONE_HALF_LIFE_DAYS, 0)
    expect(halfLifeStrength).toBeGreaterThan(0)
    expect(halfLifeStrength).toBeLessThan(PHEROMONE_MAX_STRENGTH)

    const bonus = calculatePheromoneBonus({
      nodeId: 'n',
      successfulDispatches: 10,
      abandonments: 0,
      strength: halfLifeStrength,
    })
    expect(bonus).toBeGreaterThan(0)
    expect(bonus).toBeLessThan(MAX_PHEROMONE_BONUS)

    // The bonus should be proportional to the decayed strength
    const expectedBonus = Math.min(MAX_PHEROMONE_BONUS, (halfLifeStrength / 100) * MAX_PHEROMONE_BONUS)
    expect(bonus).toBe(expectedBonus)
  })
})

// ---------------------------------------------------------------------------
// 2. Workload Engine <-> Federation Engine
// ---------------------------------------------------------------------------

describe('Workload Engine <-> Federation Engine', () => {
  it('trust level values are consistent between engines', () => {
    // Both engines define TrustLevel as 'none' | 'probationary' | 'vouched' | 'full'
    const federationTrustLevels: TrustLevel[] = ['none', 'probationary', 'vouched', 'full']
    const workloadTrustLevels = Object.keys(TRUST_LEVEL_VALUES)

    expect(workloadTrustLevels.sort()).toEqual(federationTrustLevels.sort())
  })

  it('TRUST_LEVEL_VALUES ordering matches federation trust chain progression', () => {
    // Federation trust chain: applicant/revoked -> probation -> vouched (1+ vouch) -> full (2+ vouches)
    expect(TRUST_LEVEL_VALUES.none).toBeLessThan(TRUST_LEVEL_VALUES.probationary)
    expect(TRUST_LEVEL_VALUES.probationary).toBeLessThan(TRUST_LEVEL_VALUES.vouched)
    expect(TRUST_LEVEL_VALUES.vouched).toBeLessThan(TRUST_LEVEL_VALUES.full)
  })

  it('federation calculateTrustLevel returns values workload engine can compare', () => {
    // Probation ministry should get 'probationary'
    const probMinistry = makeMinistry({ status: 'probation' })
    const probTrust = calculateTrustLevel(probMinistry)
    expect(probTrust).toBe('probationary')
    expect(TRUST_LEVEL_VALUES[probTrust]).toBeDefined()

    // Active ministry with 2+ valid vouches should get 'full'
    const fullMinistry = makeMinistry({
      status: 'active',
      vouchesReceived: [
        { voucherId: 'v1', voucherName: 'Voucher 1', vouchedAt: '2025-06-01T00:00:00Z', reason: 'Trusted', isValid: true },
        { voucherId: 'v2', voucherName: 'Voucher 2', vouchedAt: '2025-06-01T00:00:00Z', reason: 'Reliable', isValid: true },
      ],
    })
    const fullTrust = calculateTrustLevel(fullMinistry)
    expect(fullTrust).toBe('full')
    expect(trustLevelSufficient(fullTrust, 'vouched')).toBe(true)
    expect(trustLevelSufficient(fullTrust, 'full')).toBe(true)
  })

  it('WORK_TYPE_MIN_TRUST maps to valid TrustLevel values', () => {
    const validLevels = new Set(Object.keys(TRUST_LEVEL_VALUES))
    for (const [workType, minTrust] of Object.entries(WORK_TYPE_MIN_TRUST)) {
      expect(validLevels.has(minTrust)).toBe(true)
      // Every min trust should be at least 'probationary' (no 'none' work allowed)
      expect(TRUST_LEVEL_VALUES[minTrust]).toBeGreaterThan(TRUST_LEVEL_VALUES.none)
    }
  })

  it('computeClassSufficient ordering is transitive', () => {
    // lightweight < standard < heavy
    expect(computeClassSufficient('lightweight', 'lightweight')).toBe(true)
    expect(computeClassSufficient('standard', 'lightweight')).toBe(true)
    expect(computeClassSufficient('heavy', 'lightweight')).toBe(true)

    expect(computeClassSufficient('lightweight', 'standard')).toBe(false)
    expect(computeClassSufficient('standard', 'standard')).toBe(true)
    expect(computeClassSufficient('heavy', 'standard')).toBe(true)

    expect(computeClassSufficient('lightweight', 'heavy')).toBe(false)
    expect(computeClassSufficient('standard', 'heavy')).toBe(false)
    expect(computeClassSufficient('heavy', 'heavy')).toBe(true)
  })

  it('trustLevelSufficient ordering matches federation trust chain', () => {
    // A 'full' trust worker should meet all trust requirements
    expect(trustLevelSufficient('full', 'none')).toBe(true)
    expect(trustLevelSufficient('full', 'probationary')).toBe(true)
    expect(trustLevelSufficient('full', 'vouched')).toBe(true)
    expect(trustLevelSufficient('full', 'full')).toBe(true)

    // A 'none' trust worker should only meet 'none' requirement
    expect(trustLevelSufficient('none', 'none')).toBe(true)
    expect(trustLevelSufficient('none', 'probationary')).toBe(false)
  })

  it('federation composite trust score feeds into workload trust scoring', () => {
    // Federation generates composite trust scores (0-100)
    // Workload engine uses compositeTrustScore in WorkerCapabilities
    const ministry = makeMinistry({
      status: 'active',
      vouchesReceived: [
        { voucherId: 'v1', voucherName: 'V1', vouchedAt: '2025-06-01T00:00:00Z', reason: 'Good', isValid: true },
        { voucherId: 'v2', voucherName: 'V2', vouchedAt: '2025-06-01T00:00:00Z', reason: 'Great', isValid: true },
      ],
    })
    const compositeScore = calculateCompositeTrustScore(ministry)
    expect(compositeScore).toBeGreaterThan(0)
    expect(compositeScore).toBeLessThanOrEqual(100)

    // This score should be usable as a WorkerCapabilities.compositeTrustScore
    const worker = makeWorker({ compositeTrustScore: compositeScore })
    expect(worker.compositeTrustScore).toBe(compositeScore)
  })
})

// ---------------------------------------------------------------------------
// 3. Federation Engine <-> Pheromone Engine
// ---------------------------------------------------------------------------

describe('Federation Engine <-> Pheromone Engine', () => {
  it('MAX_HEARTBEAT_AGE_SECONDS is shorter than pheromone half-life', () => {
    // Heartbeat staleness (5 min = 300s) should be much shorter than
    // pheromone half-life (21 days = 1,814,400s).
    // This ensures heartbeat health is a finer-grained signal than pheromone decay.
    const heartbeatAgeInDays = MAX_HEARTBEAT_AGE_SECONDS / (60 * 60 * 24)
    expect(heartbeatAgeInDays).toBeLessThan(PHEROMONE_HALF_LIFE_DAYS)
    // Much shorter — orders of magnitude difference
    expect(heartbeatAgeInDays).toBeLessThan(1)
  })

  it('unhealthy heartbeat does not instantly zero out pheromone strength', () => {
    // A node going unhealthy (heartbeat stale) should not destroy its pheromone trails.
    // Pheromone decay is gradual (half-life 21 days), independent of heartbeat.
    const now = new Date()
    const staleHeartbeat = new Date(now.getTime() - (MAX_HEARTBEAT_AGE_SECONDS + 60) * 1000).toISOString()

    expect(isHeartbeatHealthy(staleHeartbeat, now)).toBe(false)

    // But pheromone strength for the same node remains high if trails are fresh
    const strength = calculateStrength(10, 0, 0)
    expect(strength).toBe(PHEROMONE_MAX_STRENGTH) // Still at max
  })

  it('pheromone trails persist long after heartbeat window expires', () => {
    // Pheromone trails at 1 day old are still very strong, while heartbeat
    // from 1 day ago is definitely unhealthy (300s window)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    expect(isHeartbeatHealthy(oneDayAgo)).toBe(false) // Heartbeat stale

    const strength = calculateStrength(10, 1, 0)
    expect(strength).toBeGreaterThan(90) // Pheromone still very strong after 1 day
  })

  it('pheromone trails survive heartbeat recovery cycles', () => {
    // A node that goes offline and comes back should still benefit from
    // existing pheromone trails (they decay slowly, not binary on/off)
    const trailAge = 5 // 5 days old trail
    const strength = calculateStrength(8, trailAge, 1)
    expect(strength).toBeGreaterThan(0)
    expect(strength).toBeGreaterThan(PHEROMONE_DECAY_THRESHOLD) // Still alive

    // The workload engine can still use this for routing bonus
    const bonus = calculatePheromoneBonus({
      nodeId: 'recovered',
      successfulDispatches: 8,
      abandonments: 1,
      strength,
    })
    expect(bonus).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Workload Engine scoring <-> Order Routing scoring
// ---------------------------------------------------------------------------

describe('Workload Engine scoring <-> Order Routing scoring', () => {
  it('workload engine weights sum to 1.0', () => {
    const sum =
      WORKLOAD_WEIGHTS.capability +
      WORKLOAD_WEIGHTS.trust +
      WORKLOAD_WEIGHTS.load +
      WORKLOAD_WEIGHTS.performance +
      WORKLOAD_WEIGHTS.cost
    expect(sum).toBeCloseTo(1.0)
  })

  it('order routing engine weights sum to 1.0', () => {
    const sum = WEIGHT_CAPABILITY + WEIGHT_PROXIMITY + WEIGHT_RATING + WEIGHT_FAIRNESS
    expect(sum).toBeCloseTo(1.0)
  })

  it('both engines produce scores in 0-100 base range', () => {
    // Workload: weighted sum of 0-100 subscores * weights (0-1) = 0-100 base
    // (pheromone bonus is additive on top, up to MAX_PHEROMONE_BONUS)
    const maxWeightedScore = calculateWorkerScore(100, 100, 100, 100, 100, 0)
    expect(maxWeightedScore).toBeCloseTo(100)
    expect(maxWeightedScore).toBeGreaterThanOrEqual(0)

    const minWeightedScore = calculateWorkerScore(0, 0, 0, 0, 0, 0)
    expect(minWeightedScore).toBe(0)
  })

  it('max workload score with pheromone is 100 + MAX_PHEROMONE_BONUS', () => {
    const maxTotal = calculateWorkerScore(100, 100, 100, 100, 100, MAX_PHEROMONE_BONUS)
    expect(maxTotal).toBeCloseTo(100 + MAX_PHEROMONE_BONUS)
  })

  it('both engines use capability as the highest weighted factor', () => {
    // Workload: capability = 0.30 (highest)
    // Order routing: capability = 0.40 (highest)
    const workloadMax = Math.max(
      WORKLOAD_WEIGHTS.capability,
      WORKLOAD_WEIGHTS.trust,
      WORKLOAD_WEIGHTS.load,
      WORKLOAD_WEIGHTS.performance,
      WORKLOAD_WEIGHTS.cost,
    )
    expect(workloadMax).toBe(WORKLOAD_WEIGHTS.capability)
    expect(WEIGHT_CAPABILITY).toBeGreaterThan(WEIGHT_PROXIMITY)
    expect(WEIGHT_CAPABILITY).toBeGreaterThan(WEIGHT_RATING)
    expect(WEIGHT_CAPABILITY).toBeGreaterThan(WEIGHT_FAIRNESS)
  })
})

// ---------------------------------------------------------------------------
// 5. Capacity Snapshot round-trip
// ---------------------------------------------------------------------------

describe('Capacity snapshot round-trip', () => {
  it('buildCapacitySnapshot -> serialize -> parseCapacitySnapshot preserves all data', () => {
    const worker = makeWorker({
      nodeId: 'snap-node-42',
      computeClass: 'heavy',
      supportedWorkTypes: ['computation', 'analysis', 'generation'],
      maxConcurrent: 20,
      activeWorkUnits: 5,
      avgExecutionTimeMs: 7500,
      completedCount: 200,
      failedCount: 10,
      costPerUnitCents: 12,
    })
    const now = new Date('2026-02-28T12:00:00Z')

    const snapshot = buildCapacitySnapshot(worker, now)

    // Serialize to JSON (as would be sent over the wire)
    const serialized = JSON.parse(JSON.stringify(snapshot))

    // Parse it back
    const parsed = parseCapacitySnapshot(serialized)

    expect(parsed).not.toBeNull()
    expect(parsed!.nodeId).toBe(snapshot.nodeId)
    expect(parsed!.computeClass).toBe(snapshot.computeClass)
    expect(parsed!.supportedWorkTypes).toEqual(snapshot.supportedWorkTypes)
    expect(parsed!.maxConcurrent).toBe(snapshot.maxConcurrent)
    expect(parsed!.activeWorkUnits).toBe(snapshot.activeWorkUnits)
    expect(parsed!.availableSlots).toBe(snapshot.availableSlots)
    expect(parsed!.accepting).toBe(snapshot.accepting)
    expect(parsed!.avgExecutionTimeMs).toBe(snapshot.avgExecutionTimeMs)
    expect(parsed!.costPerUnitCents).toBe(snapshot.costPerUnitCents)
    expect(parsed!.snapshotAt).toBe(snapshot.snapshotAt)
  })

  it('parseCapacitySnapshot rejects invalid data gracefully', () => {
    expect(parseCapacitySnapshot({})).toBeNull()
    expect(parseCapacitySnapshot({ nodeId: 123 } as any)).toBeNull()
    expect(parseCapacitySnapshot({ nodeId: 'x', computeClass: 'invalid' } as any)).toBeNull()
  })

  it('snapshot availableSlots is consistent with worker state', () => {
    const worker = makeWorker({ maxConcurrent: 10, activeWorkUnits: 7 })
    const snapshot = buildCapacitySnapshot(worker)

    expect(snapshot.availableSlots).toBe(3)
    expect(snapshot.availableSlots).toBe(snapshot.maxConcurrent - snapshot.activeWorkUnits)
  })

  it('snapshot successRate is derived from worker completed/failed counts', () => {
    const worker = makeWorker({ completedCount: 90, failedCount: 10 })
    const snapshot = buildCapacitySnapshot(worker)

    // successRate = completed / (completed + failed) = 90/100 = 0.9
    expect(snapshot.successRate).toBeCloseTo(0.9)
  })

  it('snapshot preserves full work type list through round-trip', () => {
    const allTypes: Array<'computation' | 'analysis' | 'generation' | 'transformation' | 'aggregation'> = [
      'computation', 'analysis', 'generation', 'transformation', 'aggregation',
    ]
    const worker = makeWorker({ supportedWorkTypes: allTypes })
    const snapshot = buildCapacitySnapshot(worker)
    const serialized = JSON.parse(JSON.stringify(snapshot))
    const parsed = parseCapacitySnapshot(serialized)

    expect(parsed).not.toBeNull()
    expect(parsed!.supportedWorkTypes).toEqual(allTypes)
  })
})

// ---------------------------------------------------------------------------
// 6. Work unit lifecycle -> Pheromone deposit
// ---------------------------------------------------------------------------

describe('Work unit lifecycle -> Pheromone deposit', () => {
  it('successful work completion produces data suitable for buildTraversal', () => {
    // After a work unit completes, the system records a pheromone deposit
    // The pheromone context is built from the work unit metadata
    const workUnit = makeWorkUnit({
      type: 'analysis',
      skillName: 'productSearch',
    })

    const ctx: PheromoneContext = {
      query: `workload:${workUnit.type}`,
      toolName: workUnit.skillName,
      tenantSlug: 'test',
    }
    const path = `/dispatch/${workUnit.assignedNode || 'local'}`

    const result = buildTraversal(null, ctx, path)

    expect(result.isNew).toBe(true)
    expect(result.pheromone.successfulTraversals).toBe(1)
    expect(result.pheromone.abandonments).toBe(0)
    expect(result.newStrength).toBeGreaterThan(0)
    expect(result.pheromone.toolName).toBe(workUnit.skillName)
  })

  it('repeated successful dispatches to same node strengthen the trail', () => {
    const ctx = makePheromoneContext({ query: 'workload:computation', toolName: 'dispatch' })
    const path = '/dispatch/worker-001'
    const now = new Date()

    // First dispatch
    const first = buildTraversal(null, ctx, path, now)
    expect(first.pheromone.successfulTraversals).toBe(1)
    const firstStrength = first.newStrength

    // Second dispatch
    const second = buildTraversal(first.pheromone, ctx, path, now)
    expect(second.pheromone.successfulTraversals).toBe(2)
    expect(second.newStrength).toBeGreaterThan(firstStrength)

    // Third dispatch
    const third = buildTraversal(second.pheromone, ctx, path, now)
    expect(third.pheromone.successfulTraversals).toBe(3)
    expect(third.newStrength).toBeGreaterThan(second.newStrength)
  })

  it('failed work produces data suitable for recordAbandonment', () => {
    // A failed work unit is equivalent to an abandonment in pheromone terms
    const existing = makePheromoneData({
      successfulTraversals: 5,
      abandonments: 0,
      strength: 50,
    })

    const abandoned = recordAbandonment(existing)

    expect(abandoned.abandonments).toBe(1)
    expect(abandoned.strength).toBeLessThan(existing.strength)
    expect(abandoned.successfulTraversals).toBe(existing.successfulTraversals)
  })

  it('multiple failures progressively weaken the trail', () => {
    let trail = makePheromoneData({
      successfulTraversals: 5,
      abandonments: 0,
      strength: 50,
      createdAt: new Date().toISOString(),
    })
    const now = new Date()

    const strengths: number[] = [trail.strength]
    for (let i = 0; i < 4; i++) {
      trail = recordAbandonment(trail, now)
      strengths.push(trail.strength)
    }

    // Each abandonment should weaken the trail (monotonically decreasing)
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeLessThanOrEqual(strengths[i - 1])
    }
  })

  it('trail strength from pheromone engine feeds cleanly into workload bonus', () => {
    // Simulate: work unit dispatched, succeeded, deposit pheromone, use for next routing
    const ctx = makePheromoneContext({ query: 'workload:computation' })
    const path = '/dispatch/worker-prime'
    const now = new Date()

    // 5 successful dispatches
    let pheromone: PheromoneData | null = null
    for (let i = 0; i < 5; i++) {
      const result = buildTraversal(pheromone, ctx, path, now)
      pheromone = result.pheromone
    }

    // Convert to PheromoneHint for workload engine
    const hint: PheromoneHint = {
      nodeId: 'worker-prime',
      successfulDispatches: pheromone!.successfulTraversals,
      abandonments: pheromone!.abandonments,
      strength: pheromone!.strength,
    }

    const bonus = calculatePheromoneBonus(hint)
    expect(bonus).toBeGreaterThan(0)
    expect(bonus).toBeLessThanOrEqual(MAX_PHEROMONE_BONUS)

    // Strength of 50 (5 traversals * 10) should give a meaningful bonus
    expect(hint.strength).toBe(50)
    expect(bonus).toBeCloseTo((50 / 100) * MAX_PHEROMONE_BONUS)
  })

  it('pheromone below decay threshold gives zero workload bonus', () => {
    // Simulate a nearly-dead trail
    const hint: PheromoneHint = {
      nodeId: 'dying-node',
      successfulDispatches: 1,
      abandonments: 10,
      strength: 0, // below PHEROMONE_DECAY_THRESHOLD
    }

    const bonus = calculatePheromoneBonus(hint)
    expect(bonus).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Cross-cutting: Full routing pipeline with federation trust + pheromone data
// ---------------------------------------------------------------------------

describe('Full cross-engine routing pipeline', () => {
  it('routes work to a fully trusted node with strong pheromone over a probationary node', () => {
    const workUnit = makeWorkUnit({
      requirements: {
        computeClass: 'standard',
        minTrustLevel: 'probationary',
        requiredCapabilities: ['computation'],
        estimatedDurationMs: 5000,
        maxDurationMs: 30000,
      },
    })

    // Worker A: full trust, strong pheromone
    const workerA = makeWorker({
      nodeId: 'trusted-veteran',
      trustLevel: 'full',
      compositeTrustScore: 85,
      completedCount: 500,
      failedCount: 5,
    })

    // Worker B: probationary, no pheromone
    const workerB = makeWorker({
      nodeId: 'new-probationary',
      trustLevel: 'probationary',
      compositeTrustScore: 15,
      completedCount: 10,
      failedCount: 2,
    })

    const pheromoneData: PheromoneHint[] = [
      makePheromoneHint({
        nodeId: 'trusted-veteran',
        strength: 90,
        successfulDispatches: 50,
        abandonments: 2,
      }),
    ]

    const decision = routeWorkUnit(workUnit, [workerA, workerB], pheromoneData)

    expect(decision.selectedWorker).not.toBeNull()
    expect(decision.selectedWorker!.worker.nodeId).toBe('trusted-veteran')
    expect(decision.selectedWorker!.pheromoneBonus).toBeGreaterThan(0)
    expect(decision.selectedWorker!.trustScore).toBeGreaterThan(0)
  })

  it('excludes a node that does not meet trust requirements even with max pheromone', () => {
    // Work requires 'vouched' trust, but worker only has 'none'
    const workUnit = makeWorkUnit({
      type: 'generation',
      requirements: {
        computeClass: 'standard',
        minTrustLevel: 'vouched',
        requiredCapabilities: ['generation'],
        estimatedDurationMs: 5000,
        maxDurationMs: 30000,
      },
    })

    const untrustedWorker = makeWorker({
      nodeId: 'untrusted',
      trustLevel: 'none',
      supportedWorkTypes: ['generation'],
      compositeTrustScore: 0,
    })

    const strongPheromone: PheromoneHint[] = [
      makePheromoneHint({ nodeId: 'untrusted', strength: PHEROMONE_MAX_STRENGTH }),
    ]

    const decision = routeWorkUnit(workUnit, [untrustedWorker], strongPheromone)

    // Trust gate is binary — pheromone cannot override trust requirements
    expect(decision.selectedWorker).toBeNull()
    expect(decision.localFallback).toBe(true)
  })
})
