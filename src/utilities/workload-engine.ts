/**
 * Workload Distribution Engine — Sprint 30
 *
 * The distributed musculature of Angel OS. Work units flow to wherever they'll
 * be processed best — scored by trust, capability, capacity, past success
 * (pheromone data), and cost. The wellness virus: inspect → route → execute → learn.
 *
 * Inspired by:
 * - The wellness virus: inspect the mesh, upgrade or route around
 * - Galactic prayer wheel: every node's computation feeds the whole
 * - Conway's Game of Life: nodes that carry load survive; idle ones go dormant
 *
 * Scoring weights (30/25/20/15/10):
 * - Capability match: 30% (binary gate, then quality of fit)
 * - Trust level: 25% (higher trust = preferred for sensitive work)
 * - Load capacity: 20% (prefer nodes with headroom)
 * - Performance: 15% (past success rate + speed)
 * - Cost: 10% (cheaper is a tiebreaker, not primary)
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/collections/Intelligence/WorkUnits.ts — persistence layer
 * @see src/utilities/pheromone-engine.ts — swarm learning integration
 * @see src/utilities/federationEngine.ts — trust levels, heartbeat health
 * @see tests/unit/utilities/workloadEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The kind of computational work being distributed. */
export type WorkType =
  | 'computation'     // CPU-bound: data processing, transformations
  | 'analysis'        // Reasoning: scoring, matching, pattern detection
  | 'generation'      // Creative: content, images, reports
  | 'transformation'  // Data reshaping: format conversion, ETL
  | 'aggregation'     // Rollup: federation health, network stats

/** The compute class required to execute a work unit. */
export type ComputeClass = 'lightweight' | 'standard' | 'heavy'

/** Work unit state machine. */
export type WorkUnitStatus =
  | 'pending'     // Queued, awaiting claim
  | 'claimed'     // A node has claimed it
  | 'executing'   // Work in progress
  | 'completed'   // Successfully finished
  | 'failed'      // Execution error
  | 'timeout'     // Exceeded deadline
  | 'cancelled'   // Manually cancelled

/** Priority levels. */
export type WorkPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

/** Trust level (mirrored from federationEngine to keep zero imports). */
export type TrustLevel = 'none' | 'probationary' | 'vouched' | 'full'

/** Retry policy for failed work units. */
export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
  backoffMultiplier: number
}

/** Resource requirements for executing a work unit. */
export interface ResourceRequirements {
  computeClass: ComputeClass
  minTrustLevel: TrustLevel
  requiredCapabilities: string[]
  preferredRegion?: string
  estimatedDurationMs: number
  maxDurationMs: number
}

/** The atomic unit of distributable work. */
export interface WorkUnit {
  id: string
  type: WorkType
  status: WorkUnitStatus
  priority: WorkPriority
  inputData: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  requirements: ResourceRequirements
  retryPolicy: RetryPolicy
  attemptCount: number
  lastError?: string
  assignedNode?: string
  claimedAt?: string
  startedAt?: string
  completedAt?: string
  deadline?: string
  originNode: string
  originTenant?: number
  skillName?: string
  parentWorkUnitId?: string
  createdAt: string
}

/** What a federation node can process. */
export interface WorkerCapabilities {
  nodeId: string
  nodeName: string
  domain: string
  computeClass: ComputeClass
  supportedWorkTypes: WorkType[]
  maxConcurrent: number
  activeWorkUnits: number
  accepting: boolean
  costPerUnitCents: number
  trustLevel: TrustLevel
  compositeTrustScore: number
  completedCount: number
  failedCount: number
  avgExecutionTimeMs: number
  lastHeartbeat?: string
  isHealthy: boolean
}

/** Scored candidate from the routing algorithm. */
export interface WorkerMatch {
  worker: WorkerCapabilities
  capabilityScore: number
  trustScore: number
  loadScore: number
  performanceScore: number
  costScore: number
  pheromoneBonus: number
  totalScore: number
}

/** Result of executing a work unit. */
export interface WorkResult {
  workUnitId: string
  success: boolean
  output?: unknown
  error?: string
  errorCode?: string
  executionTimeMs: number
  executedBy: string
  completedAt: string
}

/** Backpressure signal when all nodes are overloaded. */
export interface BackpressureSignal {
  triggered: boolean
  reason: string
  queueDepth: number
  estimatedWaitMs: number
  recommendedAction: 'queue' | 'reject' | 'downgrade'
}

/** Routing decision output. */
export interface RoutingDecision {
  workUnit: WorkUnit
  selectedWorker: WorkerMatch | null
  alternates: WorkerMatch[]
  backpressure: BackpressureSignal | null
  routedAt: string
  routingTimeMs: number
  localFallback: boolean
}

/** Pheromone data for work dispatch routing (from the pheromone grid). */
export interface PheromoneHint {
  nodeId: string
  successfulDispatches: number
  abandonments: number
  strength: number
}

/** Capacity snapshot embedded in federation heartbeat. */
export interface CapacitySnapshot {
  nodeId: string
  computeClass: ComputeClass
  supportedWorkTypes: WorkType[]
  maxConcurrent: number
  activeWorkUnits: number
  availableSlots: number
  accepting: boolean
  avgExecutionTimeMs: number
  successRate: number
  costPerUnitCents: number
  snapshotAt: string
}

// ---------------------------------------------------------------------------
// Constants — The DNA of the Workload Colony
// ---------------------------------------------------------------------------

/** Scoring weights for worker ranking (sum = 1.0). */
export const WORKLOAD_WEIGHTS = {
  capability: 0.30,
  trust: 0.25,
  load: 0.20,
  performance: 0.15,
  cost: 0.10,
} as const

/** Maximum pheromone bonus for previously successful dispatch routes. */
export const MAX_PHEROMONE_BONUS = 15

/** Priority numeric values for scoring. */
export const PRIORITY_VALUES: Record<WorkPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  background: 10,
}

/** Priority ordering (index = severity; lower = more urgent). */
export const PRIORITY_ORDER: WorkPriority[] = [
  'critical', 'high', 'normal', 'low', 'background',
]

// ── State Machine ─────────────────────────────────────────────────────────

export const WORK_UNIT_STATES: WorkUnitStatus[] = [
  'pending', 'claimed', 'executing', 'completed', 'failed', 'timeout', 'cancelled',
]

export const VALID_WORK_TRANSITIONS: Record<WorkUnitStatus, WorkUnitStatus[]> = {
  pending:   ['claimed', 'cancelled'],
  claimed:   ['executing', 'pending', 'cancelled'],
  executing: ['completed', 'failed', 'timeout'],
  completed: [],
  failed:    ['pending'],
  timeout:   ['pending'],
  cancelled: [],
}

/** Terminal states — no further transitions allowed. */
export const TERMINAL_STATES: WorkUnitStatus[] = ['completed', 'cancelled']

// ── Timeouts & Limits ─────────────────────────────────────────────────────

/** Default timeout per compute class (ms). */
export const DEFAULT_TIMEOUTS: Record<ComputeClass, number> = {
  lightweight: 5_000,
  standard:    30_000,
  heavy:       120_000,
}

/** Default retry policy. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1_000,
  backoffMultiplier: 2,
}

/** Maximum retries regardless of policy. */
export const MAX_RETRIES_HARD_CAP = 5

/** Circuit breaker: consecutive failures before skipping a node. */
export const CIRCUIT_BREAKER_THRESHOLD = 3

/** Backpressure: average load above this triggers backpressure signal. */
export const BACKPRESSURE_LOAD_THRESHOLD = 0.85

/** Minimum trust level required per work type. */
export const WORK_TYPE_MIN_TRUST: Record<WorkType, TrustLevel> = {
  computation:    'probationary',
  analysis:       'probationary',
  generation:     'vouched',
  transformation: 'probationary',
  aggregation:    'vouched',
}

/** Trust level numeric values for comparison. */
export const TRUST_LEVEL_VALUES: Record<TrustLevel, number> = {
  none: 0,
  probationary: 1,
  vouched: 2,
  full: 3,
}

/** Compute class numeric values for comparison. */
export const COMPUTE_CLASS_VALUES: Record<ComputeClass, number> = {
  lightweight: 1,
  standard: 2,
  heavy: 3,
}

// ---------------------------------------------------------------------------
// State Machine Functions
// ---------------------------------------------------------------------------

/**
 * Validate a work unit status transition.
 */
export function validateWorkTransition(
  from: WorkUnitStatus,
  to: WorkUnitStatus,
): { valid: boolean; reason?: string } {
  if (from === to) {
    return { valid: false, reason: `Cannot transition from ${from} to itself` }
  }
  const allowed = VALID_WORK_TRANSITIONS[from]
  if (!allowed || !allowed.includes(to)) {
    return {
      valid: false,
      reason: `Invalid transition: ${from} → ${to}. Allowed: [${(allowed || []).join(', ')}]`,
    }
  }
  return { valid: true }
}

/**
 * Check if a work unit is in a terminal state.
 */
export function isTerminal(status: WorkUnitStatus): boolean {
  return TERMINAL_STATES.includes(status)
}

/**
 * Check if a work unit is eligible for retry.
 */
export function canRetry(unit: WorkUnit): boolean {
  if (unit.status !== 'failed' && unit.status !== 'timeout') return false
  const maxAllowed = Math.min(unit.retryPolicy.maxRetries, MAX_RETRIES_HARD_CAP)
  return unit.attemptCount < maxAllowed
}

/**
 * Calculate next retry backoff in ms (exponential).
 */
export function calculateBackoff(unit: WorkUnit): number {
  const attempt = Math.max(0, unit.attemptCount - 1)
  return unit.retryPolicy.backoffMs * Math.pow(unit.retryPolicy.backoffMultiplier, attempt)
}

/**
 * Check if a work unit has exceeded its deadline.
 */
export function isExpired(unit: WorkUnit, now: Date = new Date()): boolean {
  if (!unit.deadline) return false
  return now.getTime() > new Date(unit.deadline).getTime()
}

// ---------------------------------------------------------------------------
// Capability Matching Functions
// ---------------------------------------------------------------------------

/**
 * Check if a compute class can handle another.
 * lightweight < standard < heavy (a heavy node can handle lightweight work).
 */
export function computeClassSufficient(
  workerClass: ComputeClass,
  requiredClass: ComputeClass,
): boolean {
  return COMPUTE_CLASS_VALUES[workerClass] >= COMPUTE_CLASS_VALUES[requiredClass]
}

/**
 * Check if trust level meets minimum.
 * none < probationary < vouched < full
 */
export function trustLevelSufficient(
  workerTrust: TrustLevel,
  requiredTrust: TrustLevel,
): boolean {
  return TRUST_LEVEL_VALUES[workerTrust] >= TRUST_LEVEL_VALUES[requiredTrust]
}

/**
 * Compute available slots for a worker.
 */
export function availableSlots(worker: WorkerCapabilities): number {
  return Math.max(0, worker.maxConcurrent - worker.activeWorkUnits)
}

/**
 * Compute success rate for a worker (0-1).
 */
export function successRate(worker: WorkerCapabilities): number {
  const total = worker.completedCount + worker.failedCount
  if (total === 0) return 0.5 // Neutral for new nodes — give them a chance
  return worker.completedCount / total
}

/**
 * Check if a worker meets all resource requirements of a work unit.
 * Binary gate: every requirement must be met.
 */
export function meetsRequirements(
  worker: WorkerCapabilities,
  requirements: ResourceRequirements,
): boolean {
  // Must be accepting work
  if (!worker.accepting) return false

  // Must be healthy
  if (!worker.isHealthy) return false

  // Must have capacity
  if (availableSlots(worker) <= 0) return false

  // Compute class must be sufficient
  if (!computeClassSufficient(worker.computeClass, requirements.computeClass)) return false

  // Trust level must be sufficient
  if (!trustLevelSufficient(worker.trustLevel, requirements.minTrustLevel)) return false

  // Must have all required capabilities
  for (const cap of requirements.requiredCapabilities) {
    if (!worker.supportedWorkTypes.includes(cap as WorkType)) {
      // Also check as generic capability string — supportedWorkTypes covers work types,
      // but requiredCapabilities may include specific skill strings
      // For now, treat supportedWorkTypes as the capability set
      return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Scoring Functions
// ---------------------------------------------------------------------------

/**
 * Score capability match (0-100).
 * Returns 0 if any required capability is missing (binary gate).
 * Otherwise returns the match ratio.
 */
export function calculateCapabilityScore(
  requiredCapabilities: string[],
  workerCapabilities: string[],
): number {
  if (requiredCapabilities.length === 0) return 100
  const workerSet = new Set(workerCapabilities)
  let matched = 0
  for (const cap of requiredCapabilities) {
    if (!workerSet.has(cap)) return 0 // Binary gate — missing one = disqualified
    matched++
  }
  return (matched / requiredCapabilities.length) * 100
}

/**
 * Score trust adequacy (0-100).
 * Returns 0 if below required minimum. Otherwise scales from composite trust score.
 */
export function calculateTrustScore(
  workerTrust: TrustLevel,
  requiredTrust: TrustLevel,
  compositeTrustScore: number,
): number {
  if (!trustLevelSufficient(workerTrust, requiredTrust)) return 0
  return Math.min(100, compositeTrustScore)
}

/**
 * Score available capacity (0-100). More headroom = higher score.
 */
export function calculateLoadScore(
  activeWorkUnits: number,
  maxConcurrent: number,
): number {
  if (maxConcurrent <= 0) return 0
  const available = Math.max(0, maxConcurrent - activeWorkUnits)
  return (available / maxConcurrent) * 100
}

/**
 * Score past performance (0-100).
 * 70% weight on success rate, 30% on speed bonus.
 */
export function calculatePerformanceScore(
  workerSuccessRate: number,
  avgExecutionTimeMs: number,
  estimatedDurationMs: number,
): number {
  // Success rate component (0-70)
  const rateScore = workerSuccessRate * 70

  // Speed bonus (0-30): faster than estimated = bonus
  let speedBonus = 15 // Neutral default
  if (estimatedDurationMs > 0 && avgExecutionTimeMs > 0) {
    const ratio = avgExecutionTimeMs / estimatedDurationMs
    if (ratio <= 0.5) speedBonus = 30       // 2x faster or more
    else if (ratio <= 1.0) speedBonus = 20  // Faster than estimated
    else if (ratio <= 1.5) speedBonus = 10  // Somewhat slower
    else speedBonus = 0                     // Much slower than estimated
  }

  return rateScore + speedBonus
}

/**
 * Score cost (0-100). Cheapest = 100, most expensive = 0.
 * Normalized against the maximum cost in the candidate pool.
 */
export function calculateCostScore(
  costPerUnitCents: number,
  maxCostInPool: number,
): number {
  if (maxCostInPool <= 0) return 100
  if (costPerUnitCents <= 0) return 100
  return Math.max(0, (1 - costPerUnitCents / maxCostInPool) * 100)
}

/**
 * Convert pheromone hint to a bonus score (0 to MAX_PHEROMONE_BONUS).
 */
export function calculatePheromoneBonus(hint: PheromoneHint | undefined): number {
  if (!hint) return 0
  if (hint.strength <= 0) return 0
  // Scale pheromone strength (0-100) into bonus (0-MAX_PHEROMONE_BONUS)
  return Math.min(MAX_PHEROMONE_BONUS, (hint.strength / 100) * MAX_PHEROMONE_BONUS)
}

/**
 * Composite scoring — weighted sum + pheromone bonus.
 */
export function calculateWorkerScore(
  capabilityScore: number,
  trustScore: number,
  loadScore: number,
  performanceScore: number,
  costScore: number,
  pheromoneBonus: number,
): number {
  const weighted =
    capabilityScore * WORKLOAD_WEIGHTS.capability +
    trustScore * WORKLOAD_WEIGHTS.trust +
    loadScore * WORKLOAD_WEIGHTS.load +
    performanceScore * WORKLOAD_WEIGHTS.performance +
    costScore * WORKLOAD_WEIGHTS.cost

  return weighted + pheromoneBonus
}

// ---------------------------------------------------------------------------
// Router — The Core Dispatch Function
// ---------------------------------------------------------------------------

/**
 * Route a work unit to the best available worker.
 *
 * Steps:
 *   1. Filter: drop workers that don't meet requirements
 *   2. Score: rank remaining workers by composite score
 *   3. Select: pick the highest-scored worker
 *   4. Backpressure: if no workers available, signal queue/reject
 *   5. Local fallback: if no remote workers, flag for local execution
 */
export function routeWorkUnit(
  workUnit: WorkUnit,
  workers: WorkerCapabilities[],
  pheromoneData?: PheromoneHint[],
  options?: {
    maxResults?: number
    forceLocal?: boolean
    excludeNodes?: string[]
  },
): RoutingDecision {
  const startTime = Date.now()
  const maxResults = options?.maxResults ?? 3
  const excludeNodes = new Set(options?.excludeNodes ?? [])

  // Force local execution
  if (options?.forceLocal || workers.length === 0) {
    return {
      workUnit,
      selectedWorker: null,
      alternates: [],
      backpressure: null,
      routedAt: new Date().toISOString(),
      routingTimeMs: Date.now() - startTime,
      localFallback: true,
    }
  }

  // Build pheromone lookup
  const pheromoneMap = new Map<string, PheromoneHint>()
  if (pheromoneData) {
    for (const hint of pheromoneData) {
      pheromoneMap.set(hint.nodeId, hint)
    }
  }

  // Filter: exclude nodes and check requirements
  const eligible = workers.filter((w) => {
    if (excludeNodes.has(w.nodeId)) return false
    return meetsRequirements(w, workUnit.requirements)
  })

  // If no eligible workers → check backpressure
  if (eligible.length === 0) {
    const bp = detectBackpressure(workers, 1)
    return {
      workUnit,
      selectedWorker: null,
      alternates: [],
      backpressure: bp.triggered ? bp : null,
      routedAt: new Date().toISOString(),
      routingTimeMs: Date.now() - startTime,
      localFallback: true,
    }
  }

  // Find max cost in pool for normalization
  const maxCost = Math.max(...eligible.map((w) => w.costPerUnitCents), 1)

  // Score all eligible workers
  const matches: WorkerMatch[] = eligible.map((worker) => {
    const capScore = calculateCapabilityScore(
      workUnit.requirements.requiredCapabilities,
      worker.supportedWorkTypes as string[],
    )
    const trustSc = calculateTrustScore(
      worker.trustLevel,
      workUnit.requirements.minTrustLevel,
      worker.compositeTrustScore,
    )
    const loadSc = calculateLoadScore(worker.activeWorkUnits, worker.maxConcurrent)
    const perfSc = calculatePerformanceScore(
      successRate(worker),
      worker.avgExecutionTimeMs,
      workUnit.requirements.estimatedDurationMs,
    )
    const costSc = calculateCostScore(worker.costPerUnitCents, maxCost)
    const phBonus = calculatePheromoneBonus(pheromoneMap.get(worker.nodeId))

    return {
      worker,
      capabilityScore: capScore,
      trustScore: trustSc,
      loadScore: loadSc,
      performanceScore: perfSc,
      costScore: costSc,
      pheromoneBonus: phBonus,
      totalScore: calculateWorkerScore(capScore, trustSc, loadSc, perfSc, costSc, phBonus),
    }
  })

  // Sort by total score descending
  matches.sort((a, b) => b.totalScore - a.totalScore)

  // Select best + alternates
  const selected = matches[0] || null
  const alternates = matches.slice(1, maxResults)

  // Check backpressure across entire pool
  const bp = detectBackpressure(workers, 0)

  return {
    workUnit,
    selectedWorker: selected,
    alternates,
    backpressure: bp.triggered ? bp : null,
    routedAt: new Date().toISOString(),
    routingTimeMs: Date.now() - startTime,
    localFallback: false,
  }
}

// ---------------------------------------------------------------------------
// Backpressure Detection
// ---------------------------------------------------------------------------

/**
 * Check if the network is under backpressure.
 */
export function detectBackpressure(
  workers: WorkerCapabilities[],
  pendingQueueSize: number,
): BackpressureSignal {
  const acceptingWorkers = workers.filter((w) => w.accepting && w.isHealthy)

  if (acceptingWorkers.length === 0) {
    return {
      triggered: true,
      reason: 'No healthy workers accepting work',
      queueDepth: pendingQueueSize,
      estimatedWaitMs: -1,
      recommendedAction: 'reject',
    }
  }

  const totalCapacity = acceptingWorkers.reduce((sum, w) => sum + w.maxConcurrent, 0)
  const totalActive = acceptingWorkers.reduce((sum, w) => sum + w.activeWorkUnits, 0)
  const avgLoad = totalCapacity > 0 ? totalActive / totalCapacity : 1

  if (avgLoad >= BACKPRESSURE_LOAD_THRESHOLD) {
    const avgTime = acceptingWorkers.reduce((sum, w) => sum + w.avgExecutionTimeMs, 0) / acceptingWorkers.length
    const remainingSlots = Math.max(0, totalCapacity - totalActive)
    const estimatedWait = remainingSlots > 0
      ? (pendingQueueSize / remainingSlots) * avgTime
      : avgTime * pendingQueueSize

    return {
      triggered: true,
      reason: `Network load at ${(avgLoad * 100).toFixed(0)}% (threshold: ${(BACKPRESSURE_LOAD_THRESHOLD * 100).toFixed(0)}%)`,
      queueDepth: pendingQueueSize,
      estimatedWaitMs: Math.round(estimatedWait),
      recommendedAction: avgLoad >= 0.95 ? 'reject' : 'queue',
    }
  }

  return {
    triggered: false,
    reason: `Network load at ${(avgLoad * 100).toFixed(0)}% — within capacity`,
    queueDepth: pendingQueueSize,
    estimatedWaitMs: 0,
    recommendedAction: 'queue',
  }
}

/**
 * Recommend shedding action based on priority and backpressure.
 * Critical work is never shed. Background work is shed first.
 */
export function shouldShed(
  workUnit: WorkUnit,
  backpressure: BackpressureSignal,
): { shed: boolean; reason: string } {
  if (!backpressure.triggered) {
    return { shed: false, reason: 'No backpressure — proceed normally' }
  }

  // Critical work is never shed
  if (workUnit.priority === 'critical') {
    return { shed: false, reason: 'Critical work is never shed' }
  }

  // High priority only shed under severe pressure
  if (workUnit.priority === 'high') {
    if (backpressure.recommendedAction === 'reject') {
      return { shed: true, reason: 'Network at capacity — shedding high priority work' }
    }
    return { shed: false, reason: 'High priority work retained under moderate pressure' }
  }

  // Normal: shed if action is reject
  if (workUnit.priority === 'normal') {
    if (backpressure.recommendedAction === 'reject') {
      return { shed: true, reason: 'Network at capacity — shedding normal priority work' }
    }
    return { shed: false, reason: 'Normal priority work queued under moderate pressure' }
  }

  // Low and background: shed under any backpressure
  return {
    shed: true,
    reason: `Shedding ${workUnit.priority} priority work under backpressure`,
  }
}

// ---------------------------------------------------------------------------
// Capacity Snapshot (Heartbeat Integration)
// ---------------------------------------------------------------------------

/**
 * Build a capacity snapshot from a worker's current state.
 * Included in federation heartbeat for distributed capacity awareness.
 */
export function buildCapacitySnapshot(
  worker: WorkerCapabilities,
  now: Date = new Date(),
): CapacitySnapshot {
  return {
    nodeId: worker.nodeId,
    computeClass: worker.computeClass,
    supportedWorkTypes: [...worker.supportedWorkTypes],
    maxConcurrent: worker.maxConcurrent,
    activeWorkUnits: worker.activeWorkUnits,
    availableSlots: availableSlots(worker),
    accepting: worker.accepting,
    avgExecutionTimeMs: worker.avgExecutionTimeMs,
    successRate: successRate(worker),
    costPerUnitCents: worker.costPerUnitCents,
    snapshotAt: now.toISOString(),
  }
}

/**
 * Parse a capacity snapshot from heartbeat data.
 * Returns null if the data is invalid or missing required fields.
 */
export function parseCapacitySnapshot(
  data: Record<string, unknown>,
): CapacitySnapshot | null {
  if (!data || typeof data !== 'object') return null
  if (typeof data.nodeId !== 'string') return null
  if (typeof data.computeClass !== 'string') return null
  if (!Array.isArray(data.supportedWorkTypes)) return null
  if (typeof data.maxConcurrent !== 'number') return null
  if (typeof data.activeWorkUnits !== 'number') return null
  if (typeof data.accepting !== 'boolean') return null

  const validClasses: ComputeClass[] = ['lightweight', 'standard', 'heavy']
  if (!validClasses.includes(data.computeClass as ComputeClass)) return null

  return {
    nodeId: data.nodeId as string,
    computeClass: data.computeClass as ComputeClass,
    supportedWorkTypes: data.supportedWorkTypes as WorkType[],
    maxConcurrent: data.maxConcurrent as number,
    activeWorkUnits: data.activeWorkUnits as number,
    availableSlots: (data.maxConcurrent as number) - (data.activeWorkUnits as number),
    accepting: data.accepting as boolean,
    avgExecutionTimeMs: typeof data.avgExecutionTimeMs === 'number' ? data.avgExecutionTimeMs : 0,
    successRate: typeof data.successRate === 'number' ? data.successRate : 0.5,
    costPerUnitCents: typeof data.costPerUnitCents === 'number' ? data.costPerUnitCents : 0,
    snapshotAt: typeof data.snapshotAt === 'string' ? data.snapshotAt : new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Work Decomposition (Aggregation Fan-Out)
// ---------------------------------------------------------------------------

/**
 * Check if a work unit can be decomposed into sub-units.
 * Only aggregation work with an `items` array > 1 can be decomposed.
 */
export function canDecompose(workUnit: WorkUnit): boolean {
  if (workUnit.type !== 'aggregation') return false
  const items = workUnit.inputData.items
  return Array.isArray(items) && items.length > 1
}

/**
 * Decompose an aggregation work unit into per-item children.
 */
export function decomposeWorkUnit(
  parent: WorkUnit,
  items: unknown[],
  now: Date = new Date(),
): WorkUnit[] {
  return items.map((item, index) => ({
    id: `${parent.id}-child-${index}`,
    type: parent.type,
    status: 'pending' as WorkUnitStatus,
    priority: parent.priority,
    inputData: { item, parentIndex: index },
    outputSchema: parent.outputSchema,
    requirements: { ...parent.requirements },
    retryPolicy: { ...parent.retryPolicy },
    attemptCount: 0,
    originNode: parent.originNode,
    originTenant: parent.originTenant,
    skillName: parent.skillName,
    parentWorkUnitId: parent.id,
    createdAt: now.toISOString(),
  }))
}

/**
 * Check if all children of a parent are complete.
 */
export function allChildrenComplete(children: WorkUnit[]): boolean {
  return children.length > 0 && children.every((c) => c.status === 'completed')
}

/**
 * Aggregate results from completed children into a single WorkResult.
 */
export function aggregateResults(
  parent: WorkUnit,
  childResults: WorkResult[],
): WorkResult {
  const totalTime = childResults.reduce((sum, r) => sum + r.executionTimeMs, 0)
  const allOutputs = childResults
    .filter((r) => r.success && r.output !== undefined)
    .map((r) => r.output)

  const allSucceeded = childResults.every((r) => r.success)
  const errors = childResults.filter((r) => !r.success).map((r) => r.error).filter(Boolean)

  return {
    workUnitId: parent.id,
    success: allSucceeded,
    output: allOutputs,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    executionTimeMs: totalTime,
    executedBy: 'aggregator',
    completedAt: new Date().toISOString(),
  }
}
