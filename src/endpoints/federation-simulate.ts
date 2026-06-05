/**
 * Federation Simulate Endpoint — GET /api/federation/simulate
 *
 * Runs the emergent-network mockup (the "first federation") and returns Central's
 * narration + a full network snapshot: mesh roles, the emergent coordinator,
 * dispatch routing, pheromone trails, and visualization stats. Pure simulation —
 * no DB, no outbound network — so it's safe + deterministic (pass ?seed=).
 *
 * This is the testbed for the eventual live network: every node here speaks the
 * same protocol, and a mock node becomes real by swapping its transport (see
 * EmergentNetwork.bringOnline / SimNodeConfig.liveBaseUrl). Query:
 *   ?dispatch=<n>   run n units of work (default 12, max 200)
 *   ?seed=<n>       seed the mock execution rng (default 1)
 *   ?live=<ids>     comma-separated node ids to *graft live* — swaps their mock
 *                   transport for the real one (POSTs to their dispatch-work).
 *                   Opt-in: default is all-mock + deterministic. When any node is
 *                   live, dispatch is clamped so the request can't fan out into an
 *                   unbounded pile of real network calls.
 */
import type { PayloadHandler } from 'payload'
import { buildFirstFederation, narrateCentral, FIRST_FEDERATION } from '@/simulation/central'
import { WORK_TYPE_MIN_TRUST, DEFAULT_RETRY_POLICY, type WorkType, type WorkUnit } from '@/utilities/workload-engine'

const WORK_TYPES: WorkType[] = ['analysis', 'generation', 'transformation', 'computation', 'aggregation']

function seeded(seed: number): () => number {
  let s = seed || 1
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeWork(i: number, clockIso: string): WorkUnit {
  const type = WORK_TYPES[i % WORK_TYPES.length]
  return {
    id: `sim-${i}`,
    type,
    status: 'pending',
    priority: 'normal',
    inputData: {},
    requirements: {
      computeClass: 'lightweight',
      minTrustLevel: WORK_TYPE_MIN_TRUST[type],
      requiredCapabilities: [type],
      estimatedDurationMs: 500,
      maxDurationMs: 5000,
    },
    retryPolicy: DEFAULT_RETRY_POLICY,
    attemptCount: 0,
    originNode: 'sim-origin',
    createdAt: clockIso,
  }
}

export const federationSimulateHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const requestedDispatch = Math.min(200, Math.max(0, parseInt(url.searchParams.get('dispatch') || '12', 10) || 0))
  const seed = parseInt(url.searchParams.get('seed') || '1', 10) || 1

  // Which nodes to graft live (opt-in). Only ids in the preset can be promoted —
  // their preset domain is their live host.
  const presetById = new Map(FIRST_FEDERATION.map((n) => [n.id, n]))
  const liveIds = (url.searchParams.get('live') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => presetById.has(id))

  // Live nodes mean real network calls (15s timeout each), so clamp dispatch when
  // any node is grafted — a control-panel click must never become a serverless hang.
  const LIVE_DISPATCH_CAP = 24
  const dispatch = liveIds.length ? Math.min(requestedDispatch, LIVE_DISPATCH_CAP) : requestedDispatch

  // Fixed clock so a given seed is fully reproducible.
  const clock = new Date('2026-06-05T00:00:00.000Z')
  const net = buildFirstFederation({ clock, rng: seeded(seed) })

  for (const id of liveIds) {
    net.bringOnline(id, `https://${presetById.get(id)!.domain}`)
  }

  for (let i = 0; i < dispatch; i++) {
    await net.dispatch(makeWork(i, clock.toISOString()))
  }

  const snapshot = net.snapshot()

  // Enrich each node with identity the snapshot doesn't carry (domain, operator,
  // persona) so the star can label and characterize it without a second fetch.
  const nodes = snapshot.nodes.map((n) => {
    const preset = presetById.get(n.id)
    return {
      ...n,
      metadata: {
        ...n.metadata,
        domain: preset?.domain ?? '',
        operator: preset?.operator ?? '',
        personaTitle: preset?.persona?.title ?? '',
        personaVoice: preset?.persona?.voice ?? '',
      },
    }
  })

  return Response.json(
    {
      narration: narrateCentral(snapshot),
      coordinator: snapshot.coordinatorId,
      online: snapshot.online,
      mock: snapshot.mock,
      live: snapshot.live,
      stats: snapshot.stats,
      sentinels: snapshot.sentinelIds,
      trails: snapshot.trails,
      nodes,
      edges: snapshot.edges,
      dispatches: snapshot.dispatchLog.length,
      completed: snapshot.dispatchLog.filter((d) => d.success).length,
      heldUnderBackpressure: snapshot.dispatchLog.filter((d) => !d.selectedNode).length,
      liveDispatchCapped: liveIds.length > 0 && requestedDispatch > LIVE_DISPATCH_CAP,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
