'use client'

/**
 * FederationSimulator — the control panel + star renderer for the emergent
 * network, living on the Federation page.
 *
 * One renderer, two sources (the simulator "attaches wherever a piece needs to
 * attach"):
 *   • SIMULATED FUTURE — /api/federation/simulate. The whole completed federation,
 *     computed now. Graft any node *live* and watch its transport flip from mock
 *     to real. This is the "materialize the OS from its perfect future" view.
 *   • LIVE MESH — /api/federation/governance-sync. The federation as it actually is.
 *
 * The topology: a ring of equals. Every node is an equal participant, so every
 * node sits on one ring — no enthroned center; the coordinator is just a marked
 * peer. The mesh edges draw the star across the ring (at five nodes — the two
 * sovereign nodes plus three participants — a clean pentagon with a pentagram
 * inside). The only thing that breaks the flat ring is a unit proxying through
 * another to reach the mesh (the relay case) — a future slice.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ── Palette (mirrors the LCARS view; kept local so this stays self-contained) ──
const C = {
  amber: '#f5a623',
  orange: '#ff9c00',
  peach: '#ffaa6b',
  lavender: '#cc99cc',
  blue: '#99ccff',
  green: '#22cc88',
  red: '#cc4444',
  darkBg: '#000000',
  panelBg: '#0a0a14',
  cardBg: '#111122',
  textMuted: '#7788aa',
}

type Role = 'flagship' | 'sentinel' | 'member' | 'applicant'
type Tier = 'substrate' | 'diocese' | 'endeavor' | 'holon'
type Source = 'simulated' | 'live'

interface StarNode {
  id: string
  name: string
  role: Role
  tier: Tier
  parentId?: string
  transport: 'mock' | 'live'
  healthy: boolean
  coordinator: boolean
  domain?: string
  operator?: string
  personaTitle?: string
  availableSlots?: number
  capabilities?: string[]
}
interface StarEdge {
  sourceId: string
  targetId: string
  weight: number
}

interface SimResponse {
  narration: string
  coordinator: string | null
  online: number
  mock: number
  live: number
  sentinels: string[]
  nodes: Array<{
    id: string
    name: string
    status: string
    capabilities?: string[]
    metadata?: Record<string, string | number | boolean>
  }>
  edges: StarEdge[]
  dispatches: number
  completed: number
  heldUnderBackpressure: number
  liveDispatchCapped?: boolean
}

// The viz vocabulary IS the architecture's tiers (substrate/diocese/endeavor/holon),
// so nodes are colored + sized by tier, not by the older mesh role.
const TIER_COLOR: Record<Tier, string> = {
  substrate: C.amber,
  diocese: C.lavender,
  endeavor: C.blue,
  holon: C.green,
}
const TIER_RADIUS: Record<Tier, number> = { substrate: 4.4, diocese: 3.6, endeavor: 2.6, holon: 2.4 }

// The preset node ids that can be grafted live (mirrors FIRST_FEDERATION).
// angel-os (spacesangels.com) and kendev (federation.kendev.co) are the two
// real sovereign nodes — graft either to swap its mock transport for the live one.
const GRAFTABLE = [
  { id: 'angel-os', label: 'Angel OS' },
  { id: 'kendev', label: 'KenDev' },
  { id: 'clearwater-cruisin', label: 'Clearwater' },
  { id: 'wdeg', label: 'WDEG' },
  { id: 'holon-compute', label: 'Holon' },
]

// ── Source → StarNode normalization ──────────────────────────────────────────

function fromSimulated(data: SimResponse): { nodes: StarNode[]; edges: StarEdge[]; narration: string } {
  const sentinelSet = new Set(data.sentinels)
  const nodes: StarNode[] = data.nodes.map((n) => {
    const role = (n.metadata?.role as Role) ?? (sentinelSet.has(n.id) ? 'sentinel' : 'member')
    return {
      id: n.id,
      name: n.name,
      role,
      tier: (n.metadata?.tier as Tier) ?? 'endeavor',
      parentId: (n.metadata?.parentEnterpriseId as string) || undefined,
      transport: (n.metadata?.transport as 'mock' | 'live') ?? 'mock',
      healthy: n.status === 'active',
      coordinator: n.id === data.coordinator,
      domain: (n.metadata?.domain as string) || undefined,
      operator: (n.metadata?.operator as string) || undefined,
      personaTitle: (n.metadata?.personaTitle as string) || undefined,
      availableSlots: typeof n.metadata?.availableSlots === 'number' ? (n.metadata.availableSlots as number) : undefined,
      capabilities: n.capabilities,
    }
  })
  return { nodes, edges: data.edges ?? [], narration: data.narration }
}

interface LiveMinistry {
  id: string
  name: string
  domain: string
  operator?: string
  status: string
  vouchesReceived?: Array<{ isValid: boolean }>
  capabilities?: string[]
  lastHeartbeat?: string
}
interface LiveGovernance {
  ministries?: LiveMinistry[]
  vouchGraph?: Array<{ voucherId: string; targetId: string; isValid?: boolean }>
  trustScores?: Record<string, number>
  coordinatorId?: string
}

function fromLive(g: LiveGovernance): { nodes: StarNode[]; edges: StarEdge[]; narration: string } {
  const ministries = g.ministries ?? []
  const trust = g.trustScores ?? {}
  // Flagship: the platform domain; else the highest-trust active node.
  const platform = ministries.find((m) => /(^|\.)spacesangels\.com$/.test(m.domain))
  const topTrust = [...ministries].sort((a, b) => (trust[b.id] ?? 0) - (trust[a.id] ?? 0))[0]
  const flagshipId = platform?.id ?? topTrust?.id

  const roleOf = (m: LiveMinistry): Role => {
    if (m.id === flagshipId) return 'flagship'
    if (m.status === 'applicant' || m.status === 'probation') return 'applicant'
    const validVouches = (m.vouchesReceived ?? []).filter((v) => v.isValid).length
    if ((trust[m.id] ?? 0) >= 60 || validVouches >= 2) return 'sentinel'
    return 'member'
  }

  const tierOf = (r: Role): Tier =>
    r === 'flagship' ? 'substrate' : r === 'sentinel' ? 'diocese' : 'endeavor'

  const FIVE_MIN = 5 * 60 * 1000
  const nodes: StarNode[] = ministries.map((m) => {
    const role = roleOf(m)
    const tier = tierOf(role)
    return {
      id: m.id,
      name: m.name,
      role,
      tier,
      // Live mesh is flat today; endeavors orbit the flagship/substrate when expanded.
      parentId: tier === 'endeavor' && flagshipId ? flagshipId : undefined,
      transport: 'live' as const,
      healthy: m.lastHeartbeat ? Date.now() - new Date(m.lastHeartbeat).getTime() < FIVE_MIN : m.status === 'active',
      coordinator: m.id === g.coordinatorId,
      domain: m.domain,
      operator: m.operator,
      capabilities: m.capabilities,
    }
  })
  const edges: StarEdge[] = (g.vouchGraph ?? [])
    .filter((v) => v.isValid !== false)
    .map((v) => ({ sourceId: v.voucherId, targetId: v.targetId, weight: 1 }))
  const active = nodes.filter((n) => n.healthy).length
  const narration =
    nodes.length === 0
      ? 'Central is listening. No peers in the live mesh yet.'
      : `Central, reading the live mesh. ${nodes.length} Diocese${nodes.length === 1 ? '' : 's'} — ${active} healthy. Coordination is emergent.`
  return { nodes, edges, narration }
}

// ── Layout: a ring of equals ──────────────────────────────────────────────────
//
// Every node is an equal participant, so every node sits on ONE ring — no
// enthroned center. Hierarchy is emergent: the coordinator is marked in place,
// not raised above its peers. The mesh edges draw the star *across* the ring (at
// five nodes: a pentagon with a pentagram inside). The one thing that breaks the
// flat ring is a unit that can only reach the mesh by proxying through another —
// the relay case — which sits just outside, spoked to its proxy (future slice).

// Tier-aware layout. The Dioceses (sovereign Enterprises) are the STAR POINTS on
// the ring; the substrate sits at the still center; endeavors/holons orbit their
// parent Diocese as satellites and only appear when that Diocese is expanded.
function layout(nodes: StarNode[], collapsed: Set<string>): Map<string, { x: number; y: number }> {
  const cx = 50
  const cy = 50
  const pos = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return pos

  const substrate = nodes.filter((n) => n.tier === 'substrate')
  const dioceses = nodes.filter((n) => n.tier === 'diocese')
  const satellites = nodes.filter((n) => n.tier === 'endeavor' || n.tier === 'holon')

  // Center: the substrate (or, if none, a lone node).
  if (substrate.length) {
    pos.set(substrate[0].id, { x: cx, y: cy })
  } else if (dioceses.length === 0 && nodes.length === 1) {
    pos.set(nodes[0].id, { x: cx, y: cy })
    return pos
  }

  // Star points: the Dioceses, evenly spaced, coordinator leading the top.
  const points = [...dioceses].sort((a, b) => (a.coordinator ? -1 : 0) - (b.coordinator ? -1 : 0))
  const R = 36
  const count = points.length || 1
  points.forEach((node, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count
    pos.set(node.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) })
  })

  // Satellites: orbit their parent (Diocese or substrate). Shown by default —
  // the full star is the payoff; clicking a parent COLLAPSES its satellites away.
  const byParent = new Map<string, StarNode[]>()
  for (const s of satellites) {
    const key = s.parentId && pos.has(s.parentId) ? s.parentId : substrate[0]?.id ?? ''
    if (!key) continue
    if (collapsed.has(key)) continue
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(s)
  }
  for (const [parentId, kids] of byParent) {
    const p = pos.get(parentId)!
    const r = parentId === substrate[0]?.id ? 16 : 10
    const atCenter = Math.hypot(p.x - cx, p.y - cy) < 1
    if (atCenter) {
      // Parent is the still center → ring its satellites a full 360°.
      kids.forEach((kid, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / kids.length
        pos.set(kid.id, { x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a) })
      })
    } else {
      // Fan outward from center so satellites don't overlap the ring.
      const outAngle = Math.atan2(p.y - cy, p.x - cx)
      kids.forEach((kid, i) => {
        const spread = (i - (kids.length - 1) / 2) * 0.5
        const a = outAngle + spread
        pos.set(kid.id, { x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a) })
      })
    }
  }
  return pos
}

// The permanent five-pointed star — the {5/2} pentagram, drawn without lifting the
// pen: distinct sovereign points, one unbroken connection, no center that rules.
// It is the ideal the live mesh always approximates, so it is ALWAYS present.
const STAR_PTS = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
  return { x: 50 + 46 * Math.cos(a), y: 50 + 46 * Math.sin(a) }
})
const PENTAGRAM = [0, 2, 4, 1, 3]
  .map((i) => `${STAR_PTS[i].x.toFixed(2)},${STAR_PTS[i].y.toFixed(2)}`)
  .join(' ')
const PENTAGON = STAR_PTS.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

// ── Component ─────────────────────────────────────────────────────────────────

export default function FederationSimulator() {
  const [source, setSource] = useState<Source>('simulated')
  const [dispatch, setDispatch] = useState(12)
  const [seed, setSeed] = useState(1)
  const [liveIds, setLiveIds] = useState<string[]>([])
  const [data, setData] = useState<{ nodes: StarNode[]; edges: StarEdge[]; narration: string } | null>(null)
  const [meta, setMeta] = useState<Pick<SimResponse, 'online' | 'mock' | 'live' | 'dispatches' | 'completed' | 'heldUnderBackpressure' | 'liveDispatchCapped'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    try {
      if (source === 'simulated') {
        const params = new URLSearchParams({ dispatch: String(dispatch), seed: String(seed) })
        if (liveIds.length) params.set('live', liveIds.join(','))
        const res = await fetch(`/api/federation/simulate?${params}`, { signal: ac.signal })
        const json = (await res.json()) as SimResponse
        setData(fromSimulated(json))
        setMeta({
          online: json.online,
          mock: json.mock,
          live: json.live,
          dispatches: json.dispatches,
          completed: json.completed,
          heldUnderBackpressure: json.heldUnderBackpressure,
          liveDispatchCapped: json.liveDispatchCapped,
        })
      } else {
        const res = await fetch('/api/federation/governance-sync', { signal: ac.signal, credentials: 'include' })
        const json = await res.json()
        setData(fromLive((json?.governance as LiveGovernance) ?? {}))
        setMeta(null)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setData({ nodes: [], edges: [], narration: 'Signal lost. Could not reach the network.' })
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [source, dispatch, seed, liveIds])

  // Debounce so dragging the slider doesn't fire a request per pixel.
  useEffect(() => {
    const t = setTimeout(refetch, 250)
    return () => clearTimeout(t)
  }, [refetch])

  const positions = useMemo(() => layout(data?.nodes ?? [], collapsed), [data, collapsed])
  const nodeById = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data])
  const selectedNode = selected ? nodeById.get(selected) : null
  const tierTally = useMemo(() => {
    const t: Record<Tier, number> = { substrate: 0, diocese: 0, endeavor: 0, holon: 0 }
    for (const n of data?.nodes ?? []) t[n.tier]++
    return t
  }, [data])
  const hasChildren = useMemo(() => {
    const s = new Set<string>()
    for (const n of data?.nodes ?? []) if (n.parentId) s.add(n.parentId)
    return s
  }, [data])

  const toggleLive = (id: string) =>
    setLiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Click a Diocese/substrate that has satellites → fan its endeavors in/out
  // (shown by default; clicking collapses them away).
  const onNodeClick = (id: string) => {
    setSelected(id)
    if (hasChildren.has(id)) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden" style={{ background: C.darkBg, color: '#fff' }}>
      {/* ── Control Panel ──────────────────────────────────────────────── */}
      <div className="flex w-full shrink-0 flex-col gap-3 p-3 md:w-72 md:overflow-y-auto" style={{ background: C.panelBg, borderRight: `1px solid ${C.amber}22` }}>
        {/* Source toggle */}
        <div className="grid grid-cols-2 gap-1">
          {(['simulated', 'live'] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSource(s); setSelected(null) }}
              className="rounded px-2 py-2 font-mono text-[10px] font-bold tracking-wider transition-colors"
              style={{
                background: source === s ? C.amber : C.cardBg,
                color: source === s ? '#000' : C.textMuted,
              }}
            >
              {s === 'simulated' ? 'SIMULATED FUTURE' : 'LIVE MESH'}
            </button>
          ))}
        </div>

        {/* Narration — Central's voice */}
        <div className="rounded p-2 font-mono text-[11px] leading-relaxed" style={{ background: C.cardBg, color: C.blue, borderLeft: `3px solid ${C.lavender}` }}>
          {loading ? <span style={{ color: C.textMuted }}>Reading the network…</span> : (data?.narration || '—').split('\n').map((line, i) => <p key={i} className={i ? 'mt-1.5' : ''}>{line}</p>)}
        </div>

        {/* Tier tally — the architecture read at a glance */}
        {!loading && (data?.nodes.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 font-mono text-[10px]">
            {([
              ['diocese', 'Diocese', 'Dioceses'],
              ['endeavor', 'endeavor', 'endeavors'],
              ['holon', 'holon', 'holons'],
            ] as [Tier, string, string][])
              .filter(([k]) => tierTally[k] > 0)
              .map(([k, one, many]) => (
                <span key={k} className="flex items-center gap-1" style={{ color: C.textMuted }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: TIER_COLOR[k] }} />
                  {tierTally[k]} {tierTally[k] === 1 ? one : many}
                </span>
              ))}
          </div>
        )}

        {/* Simulator controls */}
        {source === 'simulated' && (
          <div className="flex flex-col gap-3 rounded p-2" style={{ background: C.cardBg }}>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-wider" style={{ color: C.textMuted }}>
                DISPATCH WORK: <span style={{ color: C.amber }}>{dispatch}</span> units
              </span>
              <input type="range" min={0} max={48} value={dispatch} onChange={(e) => setDispatch(Number(e.target.value))} style={{ accentColor: C.amber }} />
            </label>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-wider" style={{ color: C.textMuted }}>SEED</span>
              <input
                type="number"
                value={seed}
                min={1}
                onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded px-2 py-1 font-mono text-xs"
                style={{ background: C.panelBg, color: C.amber, border: `1px solid ${C.amber}44` }}
              />
              <button onClick={() => setSeed((s) => s + 1)} className="rounded px-2 py-1 font-mono text-[10px] font-bold" style={{ background: C.amber, color: '#000' }}>
                RESEED
              </button>
            </div>

            {/* Graft-live chips */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-wider" style={{ color: C.textMuted }}>GRAFT LIVE (real transport)</span>
              <div className="flex flex-wrap gap-1">
                {GRAFTABLE.map((g) => {
                  const on = liveIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleLive(g.id)}
                      className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold transition-colors"
                      style={{
                        background: on ? C.green : C.panelBg,
                        color: on ? '#000' : C.textMuted,
                        border: `1px solid ${on ? C.green : C.textMuted + '44'}`,
                      }}
                    >
                      {on ? '◉ ' : '○ '}{g.label}
                    </button>
                  )
                })}
              </div>
              {meta?.liveDispatchCapped && (
                <span className="font-mono text-[9px]" style={{ color: C.orange }}>
                  ⚠ dispatch clamped to 24 while grafting live (bounds real network calls)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 font-mono">
          <Stat label="ONLINE" value={meta?.online ?? (data?.nodes.filter((n) => n.healthy).length ?? 0)} color={C.green} />
          <Stat label="LIVE" value={meta ? meta.live : (data?.nodes.filter((n) => n.transport === 'live').length ?? 0)} color={C.amber} />
          <Stat label="MOCK" value={meta ? meta.mock : 0} color={C.lavender} />
          {source === 'simulated' && (
            <>
              <Stat label="ROUTED" value={meta?.dispatches ?? 0} color={C.blue} />
              <Stat label="DONE" value={meta?.completed ?? 0} color={C.green} />
              <Stat label="HELD" value={meta?.heldUnderBackpressure ?? 0} color={C.orange} />
            </>
          )}
        </div>

        {/* Selected node detail */}
        {selectedNode && (
          <div className="rounded p-2 font-mono text-[10px]" style={{ background: C.cardBg, borderLeft: `3px solid ${TIER_COLOR[selectedNode.tier]}` }}>
            <div className="text-sm font-bold" style={{ color: TIER_COLOR[selectedNode.tier] }}>{selectedNode.name}</div>
            <div style={{ color: C.textMuted }}>{selectedNode.personaTitle || selectedNode.tier.toUpperCase()}</div>
            <div className="mt-1.5 flex flex-col gap-0.5" style={{ color: C.textMuted }}>
              {selectedNode.domain && <span>⌁ {selectedNode.domain}</span>}
              {selectedNode.operator && <span>☉ {selectedNode.operator}</span>}
              <span>transport: <span style={{ color: selectedNode.transport === 'live' ? C.green : C.lavender }}>{selectedNode.transport}</span>{selectedNode.coordinator ? ' · coordinator' : ''}</span>
              {typeof selectedNode.availableSlots === 'number' && <span>free slots: {selectedNode.availableSlots}</span>}
              {selectedNode.capabilities?.length ? <span>{selectedNode.capabilities.slice(0, 4).join(' · ')}</span> : null}
            </div>
          </div>
        )}
      </div>

      {/* ── Star Renderer ──────────────────────────────────────────────── */}
      <div className="relative flex min-h-[60vh] flex-1 items-center justify-center p-3 md:min-h-0">
        <svg viewBox="0 0 100 100" className="h-full max-h-[78vh] w-full" style={{ maxWidth: 'min(100%, 80vh)' }}>
          {/* The permanent five-pointed star — pentagram + pentagon, always present,
              the ideal the live mesh approximates (one unbroken line, no center that rules). */}
          <polygon points={PENTAGON} fill="none" stroke={`${C.amber}10`} strokeWidth={0.25} />
          <polygon points={PENTAGRAM} fill="none" stroke={`${C.amber}1e`} strokeWidth={0.35} strokeLinejoin="round" />
          <circle cx={50} cy={50} r={46} fill="none" stroke={`${C.lavender}10`} strokeWidth={0.3} strokeDasharray="1 1.5" />

          {/* Edges */}
          {(data?.edges ?? []).map((e, i) => {
            const a = positions.get(e.sourceId)
            const b = positions.get(e.targetId)
            if (!a || !b) return null
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.amber} strokeWidth={0.25 + e.weight * 0.25} strokeOpacity={0.18 + e.weight * 0.22} />
          })}

          {/* Nodes */}
          {(data?.nodes ?? []).map((n) => {
            const p = positions.get(n.id)
            if (!p) return null
            const r = TIER_RADIUS[n.tier]
            const color = TIER_COLOR[n.tier]
            const isSel = n.id === selected
            return (
              <g key={n.id} onClick={() => onNodeClick(n.id)} style={{ cursor: 'pointer' }}>
                {/* collapsed ring — a Diocese with its satellites tucked behind it */}
                {hasChildren.has(n.id) && collapsed.has(n.id) && (
                  <circle cx={p.x} cy={p.y} r={r + 1} fill="none" stroke={color} strokeWidth={0.25} strokeDasharray="0.5 0.7" opacity={0.6} />
                )}
                {/* live glow / coordinator pulse */}
                {n.transport === 'live' && n.healthy && <circle cx={p.x} cy={p.y} r={r + 1.6} fill="none" stroke={C.green} strokeWidth={0.4} opacity={0.7} />}
                {n.coordinator && <circle cx={p.x} cy={p.y} r={r + 2.8} fill="none" stroke={color} strokeWidth={0.3} opacity={0.5}><animate attributeName="r" values={`${r + 2.2};${r + 3.6};${r + 2.2}`} dur="2.4s" repeatCount="indefinite" /></circle>}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={n.healthy ? `${color}cc` : `${C.red}66`}
                  stroke={isSel ? '#fff' : color}
                  strokeWidth={isSel ? 0.8 : 0.4}
                  strokeDasharray={n.transport === 'mock' ? '0.8 0.8' : undefined}
                />
                <text x={p.x} y={p.y + r + 3.2} textAnchor="middle" fontSize={2.6} fill={C.textMuted} style={{ pointerEvents: 'none' }}>
                  {n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name}
                </text>
              </g>
            )
          })}

          {loading && <text x={50} y={50} textAnchor="middle" fontSize={3} fill={C.amber}>materializing…</text>}
          {!loading && (data?.nodes.length ?? 0) === 0 && <text x={50} y={50} textAnchor="middle" fontSize={3} fill={C.textMuted}>no nodes</text>}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 font-mono text-[9px]">
          <Legend color={C.amber} label="SUBSTRATE" />
          <Legend color={C.lavender} label="DIOCESE" />
          <Legend color={C.blue} label="ENDEAVOR" />
          <Legend color={C.green} label="HOLON" />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-2 py-1.5" style={{ background: C.cardBg, borderLeft: `3px solid ${color}` }}>
      <div className="text-[8px] tracking-wider" style={{ color: C.textMuted }}>{label}</div>
      <div className="text-base font-bold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1" style={{ color: C.textMuted }}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
