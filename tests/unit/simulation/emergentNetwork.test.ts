/**
 * emergentNetwork — the mockup federation that drives the real engines.
 * Deterministic via injected clock + seeded rng; no network, no DB.
 */
import { describe, it, expect } from 'vitest'
import { EmergentNetwork, type SimNodeConfig } from '@/simulation/emergentNetwork'
import { buildFirstFederation, narrateCentral } from '@/simulation/central'
import { DEFAULT_RETRY_POLICY, type WorkUnit, type WorkType, type ComputeClass, type TrustLevel } from '@/utilities/workload-engine'

const CLOCK = new Date('2026-06-05T00:00:00.000Z')

// Seeded PRNG (mulberry32) — reproducible "luck" for mock execution.
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let n = 0
function work(
  type: WorkType,
  opts: { caps?: string[]; minTrust?: TrustLevel; computeClass?: ComputeClass } = {},
): WorkUnit {
  return {
    id: `w${n++}`,
    type,
    status: 'pending',
    priority: 'normal',
    inputData: {},
    requirements: {
      computeClass: opts.computeClass ?? 'lightweight',
      minTrustLevel: opts.minTrust ?? 'probationary',
      requiredCapabilities: opts.caps ?? [type],
      estimatedDurationMs: 500,
      maxDurationMs: 5000,
    },
    retryPolicy: DEFAULT_RETRY_POLICY,
    attemptCount: 0,
    originNode: 'test-origin',
    createdAt: CLOCK.toISOString(),
  }
}

describe('emergentNetwork — federation topology (real federationEngine)', () => {
  it('elects the flagship as the emergent coordinator (Central)', () => {
    const net = buildFirstFederation({ clock: CLOCK, rng: seeded(1) })
    expect(net.coordinator()?.id).toBe('angel-os')
    const snap = net.snapshot()
    expect(snap.coordinatorId).toBe('angel-os')
    expect(snap.sentinelIds).toContain('angel-os')
    // 2+ vouches ⇒ full trust ⇒ sentinel
    expect(snap.sentinelIds).toEqual(expect.arrayContaining(['angel-os', 'clearwater-cruisin', 'wdeg']))
  })

  it('fails over to the next healthy sentinel when the flagship goes dark', () => {
    const net = buildFirstFederation({ clock: CLOCK, rng: seeded(1) })
    net.setHealthy('angel-os', false)
    const coord = net.coordinator()
    expect(coord).not.toBeNull()
    expect(coord!.id).not.toBe('angel-os')
    expect(['clearwater-cruisin', 'wdeg']).toContain(coord!.id)
    expect(coord!.isHealthy).toBe(true)
  })
})

describe('emergentNetwork — routing (real workload-engine)', () => {
  it('routes work only to capable nodes', async () => {
    const net = buildFirstFederation({ clock: CLOCK, rng: seeded(2) })
    // wdeg does NOT support 'computation' — it must never be chosen for it.
    for (let i = 0; i < 8; i++) {
      const r = await net.dispatch(work('computation'))
      expect(r.selectedNode).not.toBe('wdeg')
      expect(['angel-os', 'holon-compute']).toContain(r.selectedNode)
    }
  })

  it('gates high-trust work to full-trust nodes', async () => {
    const net = buildFirstFederation({ clock: CLOCK, rng: seeded(3) })
    // require full trust → only sentinels (angel-os/clearwater/wdeg), never holon (vouched)
    const r = await net.dispatch(work('generation', { minTrust: 'full' }))
    expect(r.selectedNode).not.toBe('holon-compute')
  })

  it('balances load via slot reservation (emergent)', async () => {
    const cfg = (id: string): SimNodeConfig => ({
      id,
      name: id,
      domain: `${id}.test`,
      operator: 'test',
      computeClass: 'standard',
      supportedWorkTypes: ['analysis'],
      maxConcurrent: 1, // one in-flight slot → the 2nd unit must go elsewhere
      vouches: 2,
      reliability: 1,
      avgExecutionTimeMs: 1000,
    })
    const net = new EmergentNetwork({ clock: CLOCK, rng: seeded(4) })
    net.addNode(cfg('a')).addNode(cfg('b'))
    // Dispatch concurrently: the first reserves its node's only slot, so the
    // second sees it full (availableSlots=0 ⇒ ineligible) and routes to the other.
    const [r1, r2] = await Promise.all([net.dispatch(work('analysis')), net.dispatch(work('analysis'))])
    expect(r1.selectedNode).not.toBeNull()
    expect(r2.selectedNode).not.toBeNull()
    expect(r1.selectedNode).not.toBe(r2.selectedNode)
  })
})

describe('emergentNetwork — pheromone learning (real pheromone signal)', () => {
  it('forms a trail that strengthens with successful dispatches', async () => {
    const net = buildFirstFederation({ clock: CLOCK, rng: seeded(5) })
    for (let i = 0; i < 10; i++) await net.dispatch(work('transformation'))
    const snap = net.snapshot()
    const winner = snap.trails.find((t) => t.workType === 'transformation' && t.successfulDispatches > 0)
    expect(winner).toBeDefined()
    expect(winner!.successfulDispatches).toBeGreaterThan(0)
    // The strongest trail's node keeps earning the work (the network learns where it belongs).
    expect(snap.dispatchLog.filter((d) => d.success).length).toBeGreaterThan(0)
  })
})

describe('emergentNetwork — Central overview + voice', () => {
  it('produces a real network snapshot (visualization engine)', () => {
    const snap = buildFirstFederation({ clock: CLOCK, rng: seeded(6) }).snapshot()
    expect(snap.stats.totalNodes).toBe(4)
    expect(snap.stats.activeNodes).toBe(4)
    expect(snap.edges.length).toBeGreaterThan(0)
    expect(snap.stats.isolatedNodes).toBe(0)
    expect(snap.mock).toBe(4)
    expect(snap.live).toBe(0)
  })

  it('narrates Central from real state only', async () => {
    const net = buildFirstFederation({ clock: CLOCK, rng: seeded(7) })
    await net.dispatch(work('analysis'))
    const text = narrateCentral(net.snapshot())
    expect(text).toContain('Central')
    expect(text).toContain('The Angel OS') // the coordinator names itself
    expect(text).toMatch(/1 unit of work routed/)
  })
})

describe('emergentNetwork — transport swap (fill in live pieces)', () => {
  it('brings a mock node online as a live node and routes over HTTP', async () => {
    let calledUrl = ''
    const fakeFetch = (async (url: string) => {
      calledUrl = String(url)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as typeof fetch

    const net = new EmergentNetwork({ clock: CLOCK, rng: seeded(8), fetchImpl: fakeFetch })
    net.addNode({
      id: 'live-node',
      name: 'Live Node',
      domain: 'live.test',
      operator: 'test',
      computeClass: 'standard',
      supportedWorkTypes: ['analysis'],
      maxConcurrent: 4,
      vouches: 2,
    })
    net.bringOnline('live-node', 'https://live.example.com')

    const snap1 = net.snapshot()
    expect(snap1.live).toBe(1)
    expect(snap1.mock).toBe(0)

    const r = await net.dispatch(work('analysis'))
    expect(r.selectedNode).toBe('live-node')
    expect(r.success).toBe(true)
    expect(calledUrl).toBe('https://live.example.com/api/federation/dispatch-work')
  })
})
