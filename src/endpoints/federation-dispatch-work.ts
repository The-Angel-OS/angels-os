/**
 * Federation Dispatch Work — POST /api/federation/dispatch-work
 *
 * Accepts a work unit definition, scores federation peers by capacity,
 * routes to the best candidate using the Workload Engine, and persists
 * the WorkUnit record for tracking.
 *
 * Flow:
 *   1. Validate input (type, priority, requirements)
 *   2. Query federation peers with capacity snapshots (from heartbeats)
 *   3. Convert capacity snapshots → WorkerCapabilities
 *   4. Optionally integrate pheromone data for dispatch learning
 *   5. Call routeWorkUnit() for scored candidate selection
 *   6. Persist the WorkUnit record in the work-units collection
 *   7. Return routing decision with workUnitId for polling
 *
 * Authentication: Requires authenticated user (session cookie or API key)
 *
 * Sprint 31 — "Wire the brains to the body"
 *
 * @see src/utilities/workload-engine.ts — Pure routing engine
 * @see src/utilities/pheromone-engine.ts — Swarm learning (dispatch hints)
 * @see src/collections/Intelligence/WorkUnits.ts — Persistence layer
 */

import type { PayloadHandler } from 'payload'
import {
  routeWorkUnit,
  parseCapacitySnapshot,
  detectBackpressure,
  shouldShed,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUTS,
  WORK_TYPE_MIN_TRUST,
  type WorkUnit,
  type WorkerCapabilities,
  type WorkType,
  type ComputeClass,
  type WorkPriority,
  type PheromoneHint,
  type TrustLevel,
  type RoutingDecision,
} from '@/utilities/workload-engine'

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_WORK_TYPES: WorkType[] = ['computation', 'analysis', 'generation', 'transformation', 'aggregation']
const VALID_COMPUTE_CLASSES: ComputeClass[] = ['lightweight', 'standard', 'heavy']
const VALID_PRIORITIES: WorkPriority[] = ['critical', 'high', 'normal', 'low', 'background']

function generateWorkUnitId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `WU-${date}-${rand}`
}

interface DispatchRequestBody {
  type: WorkType
  priority?: WorkPriority
  inputData: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  requirements?: {
    computeClass?: ComputeClass
    requiredCapabilities?: string[]
    preferredRegion?: string
    estimatedDurationMs?: number
    maxDurationMs?: number
  }
  retryPolicy?: {
    maxRetries?: number
    backoffMs?: number
    backoffMultiplier?: number
  }
  deadline?: string
  skillName?: string
  forceLocal?: boolean
}

function validateDispatchBody(body: unknown): { valid: true; data: DispatchRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const b = body as Record<string, unknown>

  // Required: type
  if (!b.type || typeof b.type !== 'string' || !VALID_WORK_TYPES.includes(b.type as WorkType)) {
    return { valid: false, error: `Invalid work type. Must be one of: ${VALID_WORK_TYPES.join(', ')}` }
  }

  // Required: inputData
  if (!b.inputData || typeof b.inputData !== 'object' || Array.isArray(b.inputData)) {
    return { valid: false, error: 'inputData must be a non-null object' }
  }

  // Optional: priority
  if (b.priority !== undefined && (!VALID_PRIORITIES.includes(b.priority as WorkPriority))) {
    return { valid: false, error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` }
  }

  // Optional: requirements.computeClass
  const req = b.requirements as Record<string, unknown> | undefined
  if (req?.computeClass && !VALID_COMPUTE_CLASSES.includes(req.computeClass as ComputeClass)) {
    return { valid: false, error: `Invalid compute class. Must be one of: ${VALID_COMPUTE_CLASSES.join(', ')}` }
  }

  // Optional: deadline must be valid ISO date
  if (b.deadline) {
    const d = new Date(b.deadline as string)
    if (isNaN(d.getTime())) {
      return { valid: false, error: 'deadline must be a valid ISO 8601 date string' }
    }
  }

  return { valid: true, data: b as unknown as DispatchRequestBody }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const federationDispatchWorkHandler: PayloadHandler = async (req) => {
  const startTime = Date.now()

  // ── Parse & validate body ───────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const validation = validateDispatchBody(body)
  if (!validation.valid) {
    return Response.json(
      { success: false, error: validation.error },
      { status: 400 },
    )
  }

  const input = validation.data

  // ── Resolve tenant / origin identity ───────────────────────────
  const tenants = await req.payload.find({
    collection: 'tenants',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    sort: 'createdAt',
  })

  const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
  const tenantId = (tenant?.id as number) || 0
  const setup = tenant?.setup as unknown as Record<string, unknown> | undefined
  const federationId = (setup?.federationId as string) || 'local'

  // ── Build the WorkUnit ──────────────────────────────────────────
  const workUnitId = generateWorkUnitId()
  const computeClass: ComputeClass = (input.requirements?.computeClass as ComputeClass) || 'standard'
  const priority: WorkPriority = input.priority || 'normal'
  const workType = input.type

  const workUnit: WorkUnit = {
    id: workUnitId,
    type: workType,
    status: 'pending',
    priority,
    inputData: input.inputData,
    outputSchema: input.outputSchema,
    requirements: {
      computeClass,
      minTrustLevel: WORK_TYPE_MIN_TRUST[workType] || 'probationary',
      requiredCapabilities: input.requirements?.requiredCapabilities || [],
      preferredRegion: input.requirements?.preferredRegion,
      estimatedDurationMs: input.requirements?.estimatedDurationMs || DEFAULT_TIMEOUTS[computeClass],
      maxDurationMs: input.requirements?.maxDurationMs || DEFAULT_TIMEOUTS[computeClass] * 3,
    },
    retryPolicy: {
      maxRetries: input.retryPolicy?.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries,
      backoffMs: input.retryPolicy?.backoffMs ?? DEFAULT_RETRY_POLICY.backoffMs,
      backoffMultiplier: input.retryPolicy?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
    },
    attemptCount: 0,
    deadline: input.deadline,
    originNode: federationId,
    originTenant: tenantId,
    skillName: input.skillName,
    createdAt: new Date().toISOString(),
  }

  // ── Query federation peers with capacity data ──────────────────
  const workers: WorkerCapabilities[] = []

  try {
    const peers = await req.payload.find({
      collection: 'endeavors',
      where: {
        and: [
          { 'federation.networkVisible': { equals: true } },
          { 'federation.federationId': { exists: true } },
          // Don't route to ourselves (we're the local fallback)
          ...(federationId !== 'local'
            ? [{ 'federation.federationId': { not_equals: federationId } }]
            : []),
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    for (const peer of peers.docs as unknown as Array<Record<string, unknown>>) {
      const peerFed = peer.federation as unknown as Record<string, unknown> | undefined
      if (!peerFed) continue

      const capacityData = peerFed.capacitySnapshot as Record<string, unknown> | undefined
      if (!capacityData) continue

      // Parse validated capacity snapshot from heartbeat data
      const snapshot = parseCapacitySnapshot(capacityData)
      if (!snapshot || !snapshot.accepting) continue

      // Convert CapacitySnapshot → WorkerCapabilities
      const worker: WorkerCapabilities = {
        nodeId: snapshot.nodeId,
        nodeName: (peer.name as string) || 'Unknown',
        domain: (peerFed.domain as string) || (peer.name as string) || '',
        computeClass: snapshot.computeClass,
        supportedWorkTypes: snapshot.supportedWorkTypes,
        maxConcurrent: snapshot.maxConcurrent,
        activeWorkUnits: snapshot.activeWorkUnits,
        accepting: snapshot.accepting,
        costPerUnitCents: snapshot.costPerUnitCents,
        trustLevel: (peerFed.trustLevel as TrustLevel) || 'probationary',
        compositeTrustScore: typeof peerFed.compositeTrustScore === 'number'
          ? peerFed.compositeTrustScore
          : 50,
        completedCount: typeof peerFed.completedCount === 'number' ? peerFed.completedCount : 0,
        failedCount: typeof peerFed.failedCount === 'number' ? peerFed.failedCount : 0,
        avgExecutionTimeMs: snapshot.avgExecutionTimeMs,
        lastHeartbeat: peerFed.lastPingAt as string | undefined,
        isHealthy: isRecentHeartbeat(peerFed.lastPingAt as string | undefined),
      }

      workers.push(worker)
    }
  } catch (err) {
    console.warn('[Dispatch Work] Failed to query federation peers:', err)
    // Non-fatal — we'll fall back to local execution
  }

  // ── Gather pheromone hints for dispatch learning ────────────────
  let pheromoneHints: PheromoneHint[] | undefined

  try {
    const pheromones = await req.payload.find({
      collection: 'pheromones' as any,
      where: {
        path: { contains: 'dispatch' },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
      sort: '-strength',
    })

    if (pheromones.docs.length > 0) {
      pheromoneHints = (pheromones.docs as unknown as Array<Record<string, unknown>>)
        .filter((p) => typeof p.toolName === 'string' && p.toolName.startsWith('node:'))
        .map((p) => ({
          nodeId: (p.toolName as string).replace('node:', ''),
          successfulDispatches: (p.successfulTraversals as number) || 0,
          abandonments: (p.abandonments as number) || 0,
          strength: (p.strength as number) || 0,
        }))
    }
  } catch {
    // Pheromone data is optional — dispatch works without it
  }

  // ── Route the work unit ─────────────────────────────────────────
  const decision: RoutingDecision = routeWorkUnit(
    workUnit,
    workers,
    pheromoneHints,
    {
      forceLocal: input.forceLocal,
      maxResults: 3,
    },
  )

  // ── Check backpressure / shedding ───────────────────────────────
  if (decision.backpressure?.triggered) {
    const shedResult = shouldShed(workUnit, decision.backpressure)
    if (shedResult.shed) {
      return Response.json({
        success: false,
        error: 'Work unit shed due to backpressure',
        reason: shedResult.reason,
        backpressure: decision.backpressure,
        duration: Date.now() - startTime,
      }, { status: 503 })
    }
  }

  // ── Persist the WorkUnit record ─────────────────────────────────
  let persistedId: number | string | undefined

  try {
    const selectedNodeId = decision.selectedWorker?.worker.nodeId
    const selectedNodeName = decision.selectedWorker?.worker.nodeName

    const doc = await req.payload.create({
      collection: 'work-units' as any,
      data: {
        workUnitId,
        type: workUnit.type,
        status: decision.localFallback ? 'pending' : 'claimed',
        priority: workUnit.priority,
        inputData: workUnit.inputData,
        outputSchema: workUnit.outputSchema || null,
        requirements: {
          computeClass: workUnit.requirements.computeClass,
          minTrustLevel: workUnit.requirements.minTrustLevel,
          requiredCapabilities: workUnit.requirements.requiredCapabilities,
          estimatedDurationMs: workUnit.requirements.estimatedDurationMs,
          maxDurationMs: workUnit.requirements.maxDurationMs,
        },
        retryPolicy: {
          maxRetries: workUnit.retryPolicy.maxRetries,
          backoffMs: workUnit.retryPolicy.backoffMs,
          backoffMultiplier: workUnit.retryPolicy.backoffMultiplier,
        },
        attemptCount: decision.localFallback ? 0 : 1,
        assignedNode: selectedNodeId || null,
        claimedAt: decision.localFallback ? null : new Date().toISOString(),
        deadline: workUnit.deadline || null,
        originNode: workUnit.originNode,
        originTenant: workUnit.originTenant,
        skillName: workUnit.skillName || null,
        parentWorkUnitId: workUnit.parentWorkUnitId || null,
        tenant: tenantId || undefined,
      } as any,
      overrideAccess: true,
    })

    persistedId = doc.id
  } catch (err) {
    console.error('[Dispatch Work] Failed to persist work unit:', err)
    return Response.json({
      success: false,
      error: 'Failed to persist work unit',
      detail: err instanceof Error ? err.message : 'Unknown error',
      duration: Date.now() - startTime,
    }, { status: 500 })
  }

  // ── Build response ──────────────────────────────────────────────
  const response: Record<string, unknown> = {
    success: true,
    workUnitId,
    recordId: persistedId,
    routing: {
      localFallback: decision.localFallback,
      selectedWorker: decision.selectedWorker
        ? {
            nodeId: decision.selectedWorker.worker.nodeId,
            nodeName: decision.selectedWorker.worker.nodeName,
            domain: decision.selectedWorker.worker.domain,
            totalScore: Math.round(decision.selectedWorker.totalScore * 10) / 10,
            scores: {
              capability: Math.round(decision.selectedWorker.capabilityScore * 10) / 10,
              trust: Math.round(decision.selectedWorker.trustScore * 10) / 10,
              load: Math.round(decision.selectedWorker.loadScore * 10) / 10,
              performance: Math.round(decision.selectedWorker.performanceScore * 10) / 10,
              cost: Math.round(decision.selectedWorker.costScore * 10) / 10,
              pheromoneBonus: Math.round(decision.selectedWorker.pheromoneBonus * 10) / 10,
            },
          }
        : null,
      alternateCount: decision.alternates.length,
      routingTimeMs: decision.routingTimeMs,
    },
    backpressure: decision.backpressure?.triggered ? decision.backpressure : null,
    peersEvaluated: workers.length,
    duration: Date.now() - startTime,
  }

  return Response.json(response)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a heartbeat timestamp is recent enough to consider the node healthy. */
function isRecentHeartbeat(lastPingAt: string | undefined): boolean {
  if (!lastPingAt) return false
  const age = Date.now() - new Date(lastPingAt).getTime()
  // Healthy if last heartbeat was within 10 minutes (2× the 5-minute cron interval)
  return age < 10 * 60 * 1000
}
