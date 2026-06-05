/**
 * central — the voice and the preset network for the emergent-network mockup.
 *
 * "Central" is not a separate AI; it is the calm, capable narration *over real
 * network state* — the elected coordinator's view of the whole. The character is
 * deliberate: the Primer (it adapts to who is asking), the Iron Giant (a network
 * that chooses to serve — coordination is emergent, never seized), Jarvis (a
 * plain, competent status read), Central (it sees the whole mesh at once).
 *
 * narrateCentral() produces that read from a real NetworkSnapshot — no invented
 * facts, only what the engines actually computed.
 */
import type { NetworkSnapshot, SimNodeConfig } from './emergentNetwork'
import { EmergentNetwork } from './emergentNetwork'

/** A calm, factual status read of the network — Central's voice. */
export function narrateCentral(snap: NetworkSnapshot): string {
  const coord = snap.nodes.find((n) => n.id === snap.coordinatorId)
  const lines: string[] = []

  lines.push(
    coord
      ? `Central, coordinating from ${coord.name}. ${snap.online} node${snap.online === 1 ? '' : 's'} online — ${snap.live} live, ${snap.mock} in simulation.`
      : `Central is listening. No healthy coordinator yet — the mesh is still forming.`,
  )

  if (snap.sentinelIds.length) {
    lines.push(
      `${snap.sentinelIds.length} sentinel${snap.sentinelIds.length === 1 ? '' : 's'} hold governance; ` +
        `coordination is emergent — if ${coord?.name ?? 'the coordinator'} falls, the next in rank takes over without a vote.`,
    )
  }

  const dispatched = snap.dispatchLog.length
  if (dispatched) {
    const ok = snap.dispatchLog.filter((d) => d.success).length
    const dropped = snap.dispatchLog.filter((d) => !d.selectedNode).length
    lines.push(
      `${dispatched} unit${dispatched === 1 ? '' : 's'} of work routed — ${ok} completed` +
        (dropped ? `, ${dropped} held under backpressure (no capable node free)` : '') +
        `. Routing favors capability, trust, and the lightest load.`,
    )
  }

  const topTrail = snap.trails[0]
  if (topTrail && topTrail.successfulDispatches > 0) {
    const node = snap.nodes.find((n) => n.id === topTrail.nodeId)
    lines.push(
      `A trail is forming: ${node?.name ?? topTrail.nodeId} has earned ${topTrail.successfulDispatches} successful ` +
        `${topTrail.workType} dispatch${topTrail.successfulDispatches === 1 ? '' : 'es'} — the network is learning where this kind of work belongs.`,
    )
  }

  if (snap.stats.isolatedNodes > 0) {
    lines.push(`${snap.stats.isolatedNodes} node${snap.stats.isolatedNodes === 1 ? ' is' : 's are'} not yet woven into the mesh.`)
  }

  return lines.join('\n')
}

/**
 * The first federation — a runnable preset. Angel OS is the flagship/substrate;
 * Clearwater Cruisin' Ministries is its main outreach arm; WDEG is the brother's
 * face; plus a couple of holon service nodes. Swap any node's `liveBaseUrl`
 * (or call network.bringOnline) to fill it in with a live piece.
 */
export const FIRST_FEDERATION: SimNodeConfig[] = [
  {
    id: 'angel-os',
    name: 'The Angel OS',
    domain: 'spacesangels.com',
    operator: 'Platform',
    region: 'us-east',
    location: { lat: 39.0, lng: -77.5 },
    persona: { title: 'The Substrate', voice: 'quiet, constitutional, never the face' },
    computeClass: 'heavy',
    supportedWorkTypes: ['computation', 'analysis', 'generation', 'transformation', 'aggregation'],
    maxConcurrent: 12,
    capabilities: ['governance', 'federation', 'aggregation'],
    flagship: true,
    vouches: 3,
    healthy: true,
    reliability: 0.98,
    avgExecutionTimeMs: 600,
  },
  {
    id: 'kendev',
    name: 'Angel OS · KenDev',
    domain: 'federation.kendev.co',
    operator: 'KenDev.Co',
    region: 'us-east',
    location: { lat: 39.29, lng: -76.61 },
    persona: { title: 'The Sibling', voice: 'a second sovereign node — an equal peer, never a subordinate' },
    computeClass: 'heavy',
    supportedWorkTypes: ['computation', 'analysis', 'generation', 'transformation', 'aggregation'],
    maxConcurrent: 12,
    capabilities: ['governance', 'federation', 'compute'],
    vouches: 2,
    healthy: true,
    reliability: 0.97,
    avgExecutionTimeMs: 650,
  },
  {
    id: 'clearwater-cruisin',
    name: "Clearwater Cruisin' Ministries",
    domain: 'clearwater-cruisin.spacesangels.com',
    operator: 'Ken & Ty',
    region: 'us-east',
    location: { lat: 27.9659, lng: -82.8001 },
    persona: { title: 'The Navigator', voice: 'warm, on the road, outreach-first' },
    computeClass: 'standard',
    supportedWorkTypes: ['generation', 'analysis', 'aggregation'],
    maxConcurrent: 6,
    capabilities: ['outreach', 'media', 'journaling'],
    vouches: 2,
    healthy: true,
    reliability: 0.95,
    avgExecutionTimeMs: 900,
  },
  {
    id: 'wdeg',
    name: 'Where Did Everyone Go',
    domain: 'wheredideveryonego.spacesangels.com',
    operator: "Kenneth's brother",
    region: 'us-east',
    location: { lat: 27.97, lng: -82.79 },
    persona: { title: 'The Herald', voice: 'plainspoken, the book made living' },
    computeClass: 'standard',
    supportedWorkTypes: ['generation', 'transformation'],
    maxConcurrent: 4,
    capabilities: ['publishing', 'translation'],
    vouches: 2,
    healthy: true,
    reliability: 0.93,
    avgExecutionTimeMs: 1000,
  },
  {
    id: 'holon-compute',
    name: 'Holon · Compute',
    domain: 'compute.holons.angelos.app',
    operator: 'Federation',
    region: 'us-west',
    location: { lat: 37.77, lng: -122.42 },
    persona: { title: 'The Worker', voice: 'tireless, heads-down' },
    computeClass: 'heavy',
    supportedWorkTypes: ['computation', 'transformation'],
    maxConcurrent: 16,
    capabilities: ['computation'],
    vouches: 1,
    healthy: true,
    reliability: 0.9,
    avgExecutionTimeMs: 400,
  },
]

/** Build a ready-to-run network from the preset (deterministic when seeded). */
export function buildFirstFederation(opts: { clock?: Date; rng?: () => number; fetchImpl?: typeof fetch } = {}): EmergentNetwork {
  const net = new EmergentNetwork(opts)
  for (const node of FIRST_FEDERATION) net.addNode(node)
  return net
}
