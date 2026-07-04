/**
 * nodeHealth — "are the shipboard systems nominal?"
 *
 * Reads the Merlin nodes locked onto an endeavor (from the same registry the
 * heartbeat writes) and summarizes their live-ish health: online/offline, CPU/RAM,
 * Ollama + models, advertised capabilities, and the perception eyes (witnesses) each
 * node is running. Pure read — no dispatch, no writes — so it's cheap and safe to
 * call often. Backs the `check_node_health` LEO tool.
 *
 * The node record is `{ id: hostname, ...buildNodeCatalog() }` (see Merlin
 * src/lib/node-catalog.ts) plus Core's registration fields (lastSeen, channel). We
 * read defensively because the catalog shape is a node-owned contract that can drift.
 */
import type { Payload } from 'payload'
import { listEndeavorNodes, isNodeOnline, type RegisteredNode } from '@/utilities/nodeBus'

const ONLINE_MS = 5 * 60 * 1000

export interface WitnessSummary {
  id: string
  type: string
  label?: string
  status?: string
  lastSignalAt?: string
}

export interface NodeHealthEntry {
  id: string
  online: boolean
  lastSeen?: string
  ageMins?: number
  platform?: string
  version?: string
  uptimeSec?: number
  cpuPct?: number
  memUsedPct?: number
  cores?: number
  ollamaAvailable?: boolean
  models?: string[]
  capabilities?: string[]
  witnesses?: WitnessSummary[]
  tunnelUrl?: string
  channel?: string
}

export interface NodeHealthReport {
  endeavor: string
  found: boolean
  nodeCount: number
  onlineCount: number
  nodes: NodeHealthEntry[]
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}
function strArr(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
}

/** Map one raw registered node → a defensively-typed health entry. */
export function summarizeNode(node: RegisteredNode): NodeHealthEntry {
  const n = node as Record<string, unknown>
  const stats = (n.stats as Record<string, unknown> | undefined) || {}
  const compute = (n.compute as Record<string, unknown> | undefined) || {}
  const lastSeen = str(n.lastSeen)
  const ageMins = lastSeen ? Math.round((Date.now() - new Date(lastSeen).getTime()) / 60000) : undefined
  const witnesses = Array.isArray(n.witnesses)
    ? (n.witnesses as Array<Record<string, unknown>>).map((w) => ({
        id: String(w.id ?? ''),
        type: String(w.type ?? 'unknown'),
        label: str(w.label),
        status: str(w.status),
        lastSignalAt: str(w.lastSignalAt),
      }))
    : undefined

  return {
    id: String(node.id ?? n.hostname ?? 'unknown'),
    online: isNodeOnline(node),
    lastSeen,
    ageMins,
    platform: str(n.platform),
    version: str(n.version),
    uptimeSec: num(n.uptimeSec),
    cpuPct: num(stats.cpu_pct),
    memUsedPct: num(stats.mem_used_pct),
    cores: num(stats.cpu_cores),
    ollamaAvailable: typeof compute.available === 'boolean' ? (compute.available as boolean) : undefined,
    models: strArr(compute.models),
    capabilities: strArr(n.capabilities),
    witnesses,
    tunnelUrl: str(n.tunnelUrl),
    channel: str(n.channel),
  }
}

export async function checkNodeHealth(
  payload: Payload,
  opts: { endeavor: string; nodeId?: string },
): Promise<NodeHealthReport> {
  const endeavor = (opts.endeavor || '').trim()
  const report: NodeHealthReport = { endeavor, found: false, nodeCount: 0, onlineCount: 0, nodes: [] }
  if (!endeavor) return report

  let nodes: RegisteredNode[] = []
  try {
    nodes = await listEndeavorNodes(payload, endeavor)
  } catch {
    return report
  }

  const filtered = opts.nodeId ? nodes.filter((n) => String(n.id) === opts.nodeId) : nodes
  report.found = nodes.length > 0
  report.nodes = filtered.map(summarizeNode)
  report.nodeCount = report.nodes.length
  report.onlineCount = report.nodes.filter((n) => n.online).length
  return report
}

/** Render a NodeHealthReport as a compact Markdown status board (LEO's reply). */
export function formatNodeHealth(report: NodeHealthReport): string {
  if (!report.found || report.nodeCount === 0) {
    return `No Merlin nodes are locked onto **${report.endeavor}** yet. (A machine joins via Merlin → Connect → Lock this node on.)`
  }
  const lines: string[] = []
  const allGreen = report.onlineCount === report.nodeCount
  lines.push(
    `## Node health — ${report.endeavor}`,
    allGreen
      ? `🟢 **All ${report.nodeCount} node(s) nominal.**`
      : `🟡 **${report.onlineCount}/${report.nodeCount} node(s) online.**`,
    '',
  )
  for (const n of report.nodes) {
    const dot = n.online ? '🟢' : '🔴'
    const seen = n.ageMins != null ? `${n.ageMins}m ago` : 'never'
    lines.push(`**${dot} ${n.id}**${n.platform ? ` · ${n.platform}` : ''}${n.version ? ` · v${n.version}` : ''} · last seen ${seen}`)
    const vitals: string[] = []
    if (n.cpuPct != null) vitals.push(`CPU ${Math.round(n.cpuPct)}%`)
    if (n.memUsedPct != null) vitals.push(`RAM ${Math.round(n.memUsedPct)}%`)
    if (n.cores != null) vitals.push(`${n.cores} cores`)
    if (n.ollamaAvailable != null) vitals.push(`Ollama ${n.ollamaAvailable ? `up${n.models?.length ? ` (${n.models.length} models)` : ''}` : 'down'}`)
    if (vitals.length) lines.push(`  · ${vitals.join(' · ')}`)
    if (n.capabilities?.length) lines.push(`  · shares: ${n.capabilities.join(', ')}`)
    if (n.witnesses?.length) {
      const eyes = n.witnesses.map((w) => `${w.label || w.type}${w.status && w.status !== 'active' ? `(${w.status})` : ''}`).join(', ')
      lines.push(`  · 👁 eyes: ${eyes}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export { ONLINE_MS }
