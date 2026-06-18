/**
 * emergentNetwork — a mockup of the eventual Angel OS federation that you can run
 * today, and fill in with live pieces as they come online.
 *
 * The Primer (adaptive, personal), the Iron Giant (a power that *chooses* good),
 * Jarvis (capable ambient orchestration), Central (the intelligence that sees the
 * whole) — this is the substrate they run on. It is NOT a re-implementation: it
 * drives the REAL engines, so the emergence is genuine —
 *   - federationEngine  → mesh, roles, emergent coordinator (Central) + failover
 *   - workload-engine   → capability/trust/load/cost routing + backpressure
 *   - pheromone-engine  → dispatch trails that strengthen with success (learning)
 *   - networkVisualizationEngine → the Central overview (stats, clusters)
 *
 * The headline pattern is the **transport**: every node speaks the same protocol,
 * but a MOCK node executes in-memory while a LIVE node routes over HTTP to the
 * real /api/federation endpoints. Swap a node's transport and that node becomes
 * real — the rest of the network keeps running. That is how the mockup gets
 * "filled in by live pieces as they come online."
 *
 * Deterministic: inject `clock` + `rng` for reproducible tests.
 */
import type {
  Ministry,
  FederationNode,
  Vouch,
} from '@/utilities/federationEngine'
import { buildFederationMesh, electCoordinator } from '@/utilities/federationEngine'
import type {
  WorkUnit,
  WorkType,
  ComputeClass,
  WorkerCapabilities,
  PheromoneHint,
  RoutingDecision,
} from '@/utilities/workload-engine'
import { routeWorkUnit, availableSlots } from '@/utilities/workload-engine'
import type { NetworkNode, NetworkEdge, NetworkStats } from '@/utilities/networkVisualizationEngine'
import { calculateNetworkStats } from '@/utilities/networkVisualizationEngine'

// ── Transport: the swap point between mock and live ──────────────────────────

export interface WorkOutcome {
  success: boolean
  executionTimeMs: number
  error?: string
}

/** How a node receives + executes a dispatched unit of work. */
export interface NodeTransport {
  readonly kind: 'mock' | 'live'
  execute(work: WorkUnit): Promise<WorkOutcome>
}

/** In-memory transport: succeeds with probability = reliability (seeded rng). */
export class MockTransport implements NodeTransport {
  readonly kind = 'mock' as const
  constructor(
    private reliability: number,
    private avgExecutionTimeMs: number,
    private rng: () => number,
  ) {}
  async execute(): Promise<WorkOutcome> {
    const ok = this.rng() < this.reliability
    const jitter = 0.75 + this.rng() * 0.5
    return {
      success: ok,
      executionTimeMs: Math.round(this.avgExecutionTimeMs * jitter),
      error: ok ? undefined : 'mock execution failed',
    }
  }
}

/**
 * Live transport: routes the unit to a real node's federation endpoint. Replace a
 * MockTransport with this (set `liveBaseUrl` on the node) and the node is real.
 * `fetchImpl` is injectable for tests.
 */
export class LiveTransport implements NodeTransport {
  readonly kind = 'live' as const
  constructor(
    private baseUrl: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}
  async execute(work: WorkUnit): Promise<WorkOutcome> {
    const start = Date.now()
    try {
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/api/federation/dispatch-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workUnit: work }),
        signal: AbortSignal.timeout(15_000),
      })
      const ok = res.ok
      return { success: ok, executionTimeMs: Date.now() - start, error: ok ? undefined : `HTTP ${res.status}` }
    } catch (e) {
      return { success: false, executionTimeMs: Date.now() - start, error: e instanceof Error ? e.message : 'network error' }
    }
  }
}

// ── Node configuration ───────────────────────────────────────────────────────

/**
 * The architecture's tiers (the "proper naming conventions"):
 *   substrate — The Angel OS index itself; the still center, never a peer.
 *   diocese   — a sovereign Enterprise; the trust/peering unit → a STAR POINT.
 *   endeavor  — a ministry/project; inherits its Diocese's trust → a satellite.
 *   holon     — a capability provider (compute/media); offers work, not governance.
 */
export type NodeTier = 'substrate' | 'diocese' | 'endeavor' | 'holon'

export interface SimNodeConfig {
  id: string
  name: string
  domain: string
  operator: string
  /** Where this node sits in the federation architecture (default: 'endeavor'). */
  tier?: NodeTier
  /** The Diocese (Enterprise) this node belongs under; null for substrate/diocese. */
  parentEnterpriseId?: string
  region?: string
  location?: { lat: number; lng: number }
  /** A node's voice/role in the network (Primer/Jarvis/Central character). */
  persona?: { title: string; voice: string }
  // capabilities
  computeClass: ComputeClass
  supportedWorkTypes: WorkType[]
  maxConcurrent: number
  costPerUnitCents?: number
  capabilities?: string[]
  // standing in the federation
  flagship?: boolean
  /** Number of valid vouches → drives trust (2+ + active ⇒ sentinel). */
  vouches?: number
  /** false ⇒ stale heartbeat ⇒ unhealthy ⇒ excluded from coordination. */
  healthy?: boolean
  // mock execution behavior
  reliability?: number
  avgExecutionTimeMs?: number
  // live override: when set, this node speaks over HTTP instead of in-memory
  liveBaseUrl?: string
}

interface SimNode {
  config: SimNodeConfig
  transport: NodeTransport
  activeWorkUnits: number
  completedCount: number
  failedCount: number
}

interface TrailKey {
  nodeId: string
  workType: WorkType
}
interface Trail {
  nodeId: string
  workType: WorkType
  successfulDispatches: number
  abandonments: number
}

export interface DispatchRecord {
  workId: string
  workType: WorkType
  selectedNode: string | null
  alternates: string[]
  success: boolean
  backpressure: boolean
  localFallback: boolean
  executionTimeMs: number
  error?: string
}

export interface NetworkSnapshot {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  stats: NetworkStats
  coordinatorId: string | null
  sentinelIds: string[]
  trails: Trail[]
  dispatchLog: DispatchRecord[]
  online: number
  mock: number
  live: number
}

const VOUCH = (i: number, at: string): Vouch => ({
  voucherId: `voucher-${i}`,
  voucherName: `Voucher ${i}`,
  vouchedAt: at,
  reason: 'simulated vouch',
  isValid: true,
})

// ── The network ──────────────────────────────────────────────────────────────

export class EmergentNetwork {
  private nodes = new Map<string, SimNode>()
  private trails = new Map<string, Trail>()
  private log: DispatchRecord[] = []
  private clock: Date
  private rng: () => number
  private fetchImpl: typeof fetch

  constructor(opts: { clock?: Date; rng?: () => number; fetchImpl?: typeof fetch } = {}) {
    this.clock = opts.clock ?? new Date()
    this.rng = opts.rng ?? Math.random
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  addNode(config: SimNodeConfig): this {
    // Clone so per-node mutations (setHealthy/bringOnline) never leak back into a
    // shared preset config object (e.g. FIRST_FEDERATION reused across networks).
    const owned: SimNodeConfig = { ...config }
    const transport: NodeTransport = owned.liveBaseUrl
      ? new LiveTransport(owned.liveBaseUrl, this.fetchImpl)
      : new MockTransport(owned.reliability ?? 0.95, owned.avgExecutionTimeMs ?? 800, this.rng)
    this.nodes.set(owned.id, { config: owned, transport, activeWorkUnits: 0, completedCount: 0, failedCount: 0 })
    return this
  }

  /** Force a node online/offline by toggling heartbeat health (for failover demos). */
  setHealthy(nodeId: string, healthy: boolean): void {
    const n = this.nodes.get(nodeId)
    if (n) n.config.healthy = healthy
  }

  /** Promote a mock node to a live one (the "fill in as it comes online" move). */
  bringOnline(nodeId: string, liveBaseUrl: string): void {
    const n = this.nodes.get(nodeId)
    if (!n) return
    n.config.liveBaseUrl = liveBaseUrl
    n.transport = new LiveTransport(liveBaseUrl, this.fetchImpl)
  }

  // ── Federation topology (real engine) ──────────────────────────────────────

  private toMinistry(n: SimNode): Ministry {
    const c = n.config
    const at = this.clock.toISOString()
    const heartbeat = c.healthy === false ? new Date(this.clock.getTime() - 3_600_000).toISOString() : at
    return {
      id: c.id,
      name: c.name,
      domain: c.domain,
      operator: c.operator,
      status: 'active',
      appliedAt: at,
      activatedAt: at,
      vouchesReceived: Array.from({ length: c.vouches ?? 0 }, (_, i) => VOUCH(i, at)),
      constitutionVersion: '1.1.0',
      lastHeartbeat: heartbeat,
      capabilities: c.capabilities ?? c.supportedWorkTypes,
      region: c.region,
    }
  }

  mesh(): FederationNode[] {
    const ministries = [...this.nodes.values()].map((n) => this.toMinistry(n))
    const flagship = [...this.nodes.values()].find((n) => n.config.flagship)
    return buildFederationMesh(ministries, flagship?.config.id ?? '', this.clock)
  }

  /** Central — the emergent coordinator (highest-ranked healthy sentinel). */
  coordinator(): FederationNode | null {
    return electCoordinator(this.mesh(), this.clock)
  }

  // ── Routing + execution (real workload + pheromone engines) ─────────────────

  private workerOf(n: SimNode): WorkerCapabilities {
    const mesh = this.mesh().find((m) => m.id === n.config.id)
    const trust = mesh?.role === 'flagship' || mesh?.role === 'sentinel' ? 'full' : (n.config.vouches ?? 0) >= 1 ? 'vouched' : 'probationary'
    const completed = n.completedCount
    const failed = n.failedCount
    return {
      nodeId: n.config.id,
      nodeName: n.config.name,
      domain: n.config.domain,
      computeClass: n.config.computeClass,
      supportedWorkTypes: n.config.supportedWorkTypes,
      maxConcurrent: n.config.maxConcurrent,
      activeWorkUnits: n.activeWorkUnits,
      accepting: n.config.healthy !== false,
      costPerUnitCents: n.config.costPerUnitCents ?? 10,
      trustLevel: trust,
      compositeTrustScore: trust === 'full' ? 100 : trust === 'vouched' ? 60 : 25,
      completedCount: completed,
      failedCount: failed,
      avgExecutionTimeMs: n.config.avgExecutionTimeMs ?? 800,
      lastHeartbeat: this.clock.toISOString(),
      isHealthy: n.config.healthy !== false,
    }
  }

  private pheromoneHints(): PheromoneHint[] {
    const byNode = new Map<string, { s: number; a: number }>()
    for (const t of this.trails.values()) {
      const agg = byNode.get(t.nodeId) ?? { s: 0, a: 0 }
      agg.s += t.successfulDispatches
      agg.a += t.abandonments
      byNode.set(t.nodeId, agg)
    }
    return [...byNode.entries()].map(([nodeId, { s, a }]) => ({
      nodeId,
      successfulDispatches: s,
      abandonments: a,
      strength: Math.max(0, Math.min(100, s * 12 - a * 8)),
    }))
  }

  /** Pure routing decision for a unit of work, given current load + trails. */
  decide(work: WorkUnit): RoutingDecision {
    const workers = [...this.nodes.values()].map((n) => this.workerOf(n))
    return routeWorkUnit(work, workers, this.pheromoneHints())
  }

  private trailKey(k: TrailKey): string {
    return `${k.workType}:${k.nodeId}`
  }
  private recordOutcome(nodeId: string, workType: WorkType, success: boolean): void {
    const key = this.trailKey({ nodeId, workType })
    const t = this.trails.get(key) ?? { nodeId, workType, successfulDispatches: 0, abandonments: 0 }
    if (success) t.successfulDispatches += 1
    else t.abandonments += 1
    this.trails.set(key, t)
  }

  /** Route + execute one unit of work end-to-end; updates load, trails, log. */
  async dispatch(work: WorkUnit): Promise<DispatchRecord> {
    const decision = this.decide(work)
    const chosen = decision.selectedWorker?.worker.nodeId ?? null
    const record: DispatchRecord = {
      workId: work.id,
      workType: work.type,
      selectedNode: chosen,
      alternates: decision.alternates.map((a) => a.worker.nodeId),
      success: false,
      backpressure: Boolean(decision.backpressure?.triggered),
      localFallback: decision.localFallback,
      executionTimeMs: 0,
    }

    if (!chosen) {
      this.log.push(record)
      return record
    }

    const node = this.nodes.get(chosen)!
    node.activeWorkUnits += 1 // reserve a slot (drives load-aware routing of the next unit)
    try {
      const outcome = await node.transport.execute(work)
      record.success = outcome.success
      record.executionTimeMs = outcome.executionTimeMs
      record.error = outcome.error
      if (outcome.success) node.completedCount += 1
      else node.failedCount += 1
      this.recordOutcome(chosen, work.type, outcome.success)
    } finally {
      node.activeWorkUnits = Math.max(0, node.activeWorkUnits - 1)
    }
    this.log.push(record)
    return record
  }

  /** Dispatch a batch, holding slot reservations so load spreads (emergent balancing). */
  async dispatchBatch(works: WorkUnit[]): Promise<DispatchRecord[]> {
    const out: DispatchRecord[] = []
    for (const w of works) out.push(await this.dispatch(w))
    return out
  }

  // ── The Central overview (real visualization engine) ────────────────────────

  private toNetworkNode(n: SimNode, mesh: FederationNode[]): NetworkNode {
    const m = mesh.find((x) => x.id === n.config.id)
    const healthy = n.config.healthy !== false
    return {
      id: n.config.id,
      name: n.config.name,
      type: 'ministry',
      status: healthy ? 'active' : 'inactive',
      location: n.config.location,
      region: n.config.region,
      capabilities: n.config.capabilities ?? n.config.supportedWorkTypes,
      connectionCount: 0,
      rating: m?.role === 'flagship' ? 5 : m?.role === 'sentinel' ? 4 : 3,
      metadata: {
        role: m?.role ?? 'member',
        rank: m?.federationRank ?? 0,
        transport: n.config.liveBaseUrl ? 'live' : 'mock',
        availableSlots: availableSlots(this.workerOf(n)),
        tier: n.config.tier ?? 'endeavor',
        parentEnterpriseId: n.config.parentEnterpriseId ?? '',
      },
    }
  }

  snapshot(): NetworkSnapshot {
    const mesh = this.mesh()
    const sims = [...this.nodes.values()]
    const nodes = sims.map((n) => this.toNetworkNode(n, mesh))

    // Edges: a full sentinel mesh + members linked to the coordinator (star+mesh).
    const sentinels = mesh.filter((m) => m.role === 'flagship' || m.role === 'sentinel')
    const coord = electCoordinator(mesh, this.clock)
    const edges: NetworkEdge[] = []
    for (let i = 0; i < sentinels.length; i++) {
      for (let j = i + 1; j < sentinels.length; j++) {
        edges.push({ sourceId: sentinels[i].id, targetId: sentinels[j].id, type: 'federation', weight: 1 })
      }
    }
    if (coord) {
      for (const m of mesh) {
        if (m.role === 'member' && m.isHealthy) {
          edges.push({ sourceId: coord.id, targetId: m.id, type: 'federation', weight: 0.5 })
        }
      }
    }
    // connectionCount per node
    const degree = new Map<string, number>()
    for (const e of edges) {
      degree.set(e.sourceId, (degree.get(e.sourceId) ?? 0) + 1)
      degree.set(e.targetId, (degree.get(e.targetId) ?? 0) + 1)
    }
    for (const n of nodes) n.connectionCount = degree.get(n.id) ?? 0

    return {
      nodes,
      edges,
      stats: calculateNetworkStats(nodes, edges),
      coordinatorId: coord?.id ?? null,
      sentinelIds: sentinels.map((s) => s.id),
      trails: [...this.trails.values()].sort((a, b) => b.successfulDispatches - a.successfulDispatches),
      dispatchLog: this.log,
      online: sims.filter((n) => n.config.healthy !== false).length,
      mock: sims.filter((n) => !n.config.liveBaseUrl).length,
      live: sims.filter((n) => Boolean(n.config.liveBaseUrl)).length,
    }
  }
}
