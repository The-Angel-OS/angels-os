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
 */
import type { PayloadHandler } from 'payload'
import { buildFirstFederation, narrateCentral } from '@/simulation/central'
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
  const dispatch = Math.min(200, Math.max(0, parseInt(url.searchParams.get('dispatch') || '12', 10) || 0))
  const seed = parseInt(url.searchParams.get('seed') || '1', 10) || 1

  // Fixed clock so a given seed is fully reproducible.
  const clock = new Date('2026-06-05T00:00:00.000Z')
  const net = buildFirstFederation({ clock, rng: seeded(seed) })

  for (let i = 0; i < dispatch; i++) {
    await net.dispatch(makeWork(i, clock.toISOString()))
  }

  const snapshot = net.snapshot()
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
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      dispatches: snapshot.dispatchLog.length,
      completed: snapshot.dispatchLog.filter((d) => d.success).length,
      heldUnderBackpressure: snapshot.dispatchLog.filter((d) => !d.selectedNode).length,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
