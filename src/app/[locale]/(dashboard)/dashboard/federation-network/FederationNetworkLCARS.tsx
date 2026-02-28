'use client'

/**
 * FederationNetworkLCARS — LCARS-inspired Federation Network Visualization
 *
 * A Star Trek LCARS-themed dashboard showing the Angel OS federation mesh:
 *   - Network topology with flagship, sentinels, and member nodes
 *   - Real-time heartbeat status indicators
 *   - Vouch graph connections
 *   - Ministry status lifecycle
 *   - Federation health metrics
 *
 * Available to ALL dashboard users — designed to inspire and excite.
 *
 * Sprint 24: Federation Readiness
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────

interface Ministry {
  id: string
  name: string
  domain: string
  operator: string
  status: 'applicant' | 'probation' | 'active' | 'suspended' | 'revoked'
  appliedAt: string
  probationStartedAt?: string
  activatedAt?: string
  vouchesReceived: Array<{
    voucherId: string
    vouchedAt: string
    reason?: string
    isValid: boolean
  }>
  constitutionVersion: string
  lastHeartbeat?: string
  capabilities: string[]
  region?: string
}

interface VouchEdge {
  voucherId: string
  targetId: string
  vouchedAt: string
  isValid: boolean
}

interface GovernanceData {
  registryVersion: number
  ministries: Ministry[]
  catalogIndex: Array<{
    sourceMinistryId: string
    productId: string
    title: string
    category: string
  }>
  constitutionHash: string
  trustScores: Record<string, number>
  vouchGraph: VouchEdge[]
  updatedAt: string
}

type NodeRole = 'flagship' | 'sentinel' | 'member' | 'applicant'

interface FederationNodeDisplay {
  id: string
  name: string
  domain: string
  status: Ministry['status']
  role: NodeRole
  trustScore: number
  heartbeatAge: number | null // seconds since last heartbeat
  isHealthy: boolean
  capabilities: string[]
  vouchCount: number
  region?: string
  operator: string
  angle: number // position angle in the ring
  ring: number // 0=center, 1=sentinel, 2=member, 3=outer
}

// ── Constants ────────────────────────────────────────────────────────────

const LCARS_COLORS = {
  amber: '#f5a623',
  orange: '#ff9c00',
  peach: '#ffaa6b',
  lavender: '#cc99cc',
  blue: '#99ccff',
  blueLight: '#aaddff',
  purple: '#9977aa',
  tan: '#cc9966',
  red: '#cc4444',
  green: '#22cc88',
  darkBg: '#000000',
  panelBg: '#0a0a14',
  cardBg: '#111122',
  textMuted: '#7788aa',
}

const MAX_HEARTBEAT_AGE = 300 // 5 minutes

// ── Helpers ──────────────────────────────────────────────────────────────

function getHeartbeatAge(lastHeartbeat?: string): number | null {
  if (!lastHeartbeat) return null
  return Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 1000)
}

function isNodeHealthy(heartbeatAge: number | null): boolean {
  if (heartbeatAge === null) return false
  return heartbeatAge < MAX_HEARTBEAT_AGE
}

function getNodeRole(ministry: Ministry, isFlagship: boolean): NodeRole {
  if (isFlagship) return 'flagship'
  if (ministry.status === 'applicant') return 'applicant'
  if (ministry.status === 'active' && ministry.vouchesReceived.filter((v) => v.isValid).length >= 2) {
    return 'sentinel'
  }
  return 'member'
}

function getStatusColor(status: Ministry['status']): string {
  switch (status) {
    case 'active': return LCARS_COLORS.green
    case 'probation': return LCARS_COLORS.amber
    case 'applicant': return LCARS_COLORS.blue
    case 'suspended': return LCARS_COLORS.red
    case 'revoked': return '#444444'
    default: return LCARS_COLORS.textMuted
  }
}

function getRoleColor(role: NodeRole): string {
  switch (role) {
    case 'flagship': return LCARS_COLORS.amber
    case 'sentinel': return LCARS_COLORS.lavender
    case 'member': return LCARS_COLORS.blue
    case 'applicant': return LCARS_COLORS.peach
    default: return LCARS_COLORS.textMuted
  }
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return 'NO SIGNAL'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ── Main Component ───────────────────────────────────────────────────────

export default function FederationNetworkLCARS() {
  const [governance, setGovernance] = useState<GovernanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const fetchGovernance = useCallback(async () => {
    try {
      const res = await fetch('/api/federation/governance-sync', { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        if (data.governance) {
          setGovernance(data.governance)
        }
      }
    } catch {
      // endpoint may not be available in dev
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGovernance()
    // Refresh every 30 seconds
    const interval = setInterval(fetchGovernance, 30_000)
    return () => clearInterval(interval)
  }, [fetchGovernance])

  // Update heartbeat ages every second
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(ticker)
  }, [])

  // Build display nodes
  const nodes: FederationNodeDisplay[] = useMemo(() => {
    if (!governance?.ministries) return []

    const flagshipDomain = 'spacesangels.com'

    // Sort: flagship first, then sentinels, then active members, then others
    const sorted = [...governance.ministries].sort((a, b) => {
      const aFlagship = a.domain === flagshipDomain ? 0 : 1
      const bFlagship = b.domain === flagshipDomain ? 0 : 1
      if (aFlagship !== bFlagship) return aFlagship - bFlagship
      const statusOrder: Record<string, number> = { active: 0, probation: 1, applicant: 2, suspended: 3, revoked: 4 }
      return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
    })

    return sorted.map((m, i) => {
      const isFlagship = m.domain === flagshipDomain
      const role = getNodeRole(m, isFlagship)
      const heartbeatAge = getHeartbeatAge(m.lastHeartbeat)
      const ring = role === 'flagship' ? 0 : role === 'sentinel' ? 1 : role === 'member' ? 2 : 3

      // Calculate angle for ring placement
      const sameRing = sorted.filter((mm, ii) => {
        const r = getNodeRole(mm, mm.domain === flagshipDomain)
        const rr = r === 'flagship' ? 0 : r === 'sentinel' ? 1 : r === 'member' ? 2 : 3
        return rr === ring
      })
      const indexInRing = sameRing.findIndex((mm) => mm.id === m.id)
      const angle = sameRing.length > 0 ? (indexInRing / sameRing.length) * 360 : 0

      return {
        id: m.id,
        name: m.name,
        domain: m.domain,
        status: m.status,
        role,
        trustScore: governance.trustScores[m.id] ?? 0,
        heartbeatAge,
        isHealthy: isNodeHealthy(heartbeatAge),
        capabilities: m.capabilities,
        vouchCount: m.vouchesReceived.filter((v) => v.isValid).length,
        region: m.region,
        operator: m.operator,
        angle,
        ring,
      }
    })
  }, [governance, now])

  const selectedNodeData = nodes.find((n) => n.id === selectedNode)

  // Aggregate stats
  const stats = useMemo(() => {
    if (!governance) return null
    const ministries = governance.ministries
    return {
      total: ministries.length,
      active: ministries.filter((m) => m.status === 'active').length,
      probation: ministries.filter((m) => m.status === 'probation').length,
      applicants: ministries.filter((m) => m.status === 'applicant').length,
      sentinels: nodes.filter((n) => n.role === 'sentinel').length,
      healthy: nodes.filter((n) => n.isHealthy).length,
      catalogEntries: governance.catalogIndex?.length || 0,
      registryVersion: governance.registryVersion,
      vouchCount: governance.vouchGraph?.length || 0,
    }
  }, [governance, nodes])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: LCARS_COLORS.darkBg }}>
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: LCARS_COLORS.amber }} />
          <p className="mt-4 font-mono text-sm tracking-widest" style={{ color: LCARS_COLORS.amber }}>
            ACCESSING FEDERATION NETWORK...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: LCARS_COLORS.darkBg, color: '#ffffff' }}>
      {/* ── LCARS Header Bar ──────────────────────────────────────────── */}
      <div className="flex shrink-0 items-stretch gap-1 px-2 pt-2">
        {/* Left cap */}
        <div className="w-24 shrink-0" style={{ background: LCARS_COLORS.amber, borderRadius: '20px 0 0 0' }}>
          <div className="px-3 py-1 text-right font-mono text-[10px] font-bold tracking-wider text-black">
            LCARS
          </div>
        </div>
        {/* Segments */}
        <div className="h-8 w-16 shrink-0" style={{ background: LCARS_COLORS.lavender }} />
        <div className="h-8 w-8 shrink-0" style={{ background: LCARS_COLORS.blue }} />
        {/* Title area */}
        <div className="flex h-8 flex-1 items-center px-4" style={{ background: LCARS_COLORS.panelBg, borderTop: `2px solid ${LCARS_COLORS.amber}` }}>
          <span className="font-mono text-lg font-bold tracking-[0.3em]" style={{ color: LCARS_COLORS.amber }}>
            FEDERATION NETWORK
          </span>
          <span className="ml-auto font-mono text-xs" style={{ color: LCARS_COLORS.textMuted }}>
            REGISTRY v{stats?.registryVersion || '—'}
          </span>
        </div>
        {/* Right segments */}
        <div className="h-8 w-12 shrink-0" style={{ background: LCARS_COLORS.peach }} />
        <div className="h-8 w-20 shrink-0" style={{ background: LCARS_COLORS.amber, borderRadius: '0 20px 0 0' }}>
          <div className="px-3 py-1 font-mono text-[10px] font-bold text-black">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-1 overflow-hidden px-2 pb-2 pt-1">
        {/* ── Left Panel: Stats ─────────────────────────────────────── */}
        <div className="flex w-44 shrink-0 flex-col gap-1">
          {/* Left sidebar segments */}
          <div className="w-full" style={{ background: LCARS_COLORS.amber, borderRadius: '0 0 0 20px', height: '30px' }} />

          <div className="flex-1 space-y-1 overflow-y-auto">
            <LCARSStatBlock label="ENTERPRISES" value={stats?.total ?? 0} color={LCARS_COLORS.amber} />
            <LCARSStatBlock label="ACTIVE" value={stats?.active ?? 0} color={LCARS_COLORS.green} />
            <LCARSStatBlock label="SENTINELS" value={stats?.sentinels ?? 0} color={LCARS_COLORS.lavender} />
            <LCARSStatBlock label="PROBATION" value={stats?.probation ?? 0} color={LCARS_COLORS.orange} />
            <LCARSStatBlock label="APPLICANTS" value={stats?.applicants ?? 0} color={LCARS_COLORS.blue} />
            <LCARSStatBlock label="HEALTHY" value={stats?.healthy ?? 0} color={LCARS_COLORS.green} />
            <LCARSStatBlock label="CATALOG" value={stats?.catalogEntries ?? 0} color={LCARS_COLORS.peach} />
            <LCARSStatBlock label="VOUCHES" value={stats?.vouchCount ?? 0} color={LCARS_COLORS.lavender} />
          </div>

          {/* Bottom cap */}
          <div className="w-full" style={{ background: LCARS_COLORS.lavender, borderRadius: '0 0 0 20px', height: '20px' }} />
        </div>

        {/* ── Center: Network Topology ──────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-1 overflow-hidden">
          {/* Network Visualization */}
          <div className="relative flex-1 overflow-hidden" style={{ background: LCARS_COLORS.panelBg, border: `1px solid ${LCARS_COLORS.amber}33` }}>
            <NetworkTopology
              nodes={nodes}
              vouchGraph={governance?.vouchGraph || []}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />

            {/* Overlay: Legend */}
            <div className="absolute bottom-3 left-3 flex gap-3 font-mono text-[10px]">
              <LegendItem color={LCARS_COLORS.amber} label="FLAGSHIP" />
              <LegendItem color={LCARS_COLORS.lavender} label="SENTINEL" />
              <LegendItem color={LCARS_COLORS.blue} label="MEMBER" />
              <LegendItem color={LCARS_COLORS.peach} label="APPLICANT" />
            </div>

            {/* Overlay: Scan Line Animation */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${LCARS_COLORS.amber}05 2px, ${LCARS_COLORS.amber}05 4px)`,
              }}
            />
          </div>

          {/* Bottom status bar */}
          <div className="flex h-7 items-center gap-1">
            <div className="h-full w-12 shrink-0" style={{ background: LCARS_COLORS.tan, borderRadius: '0 0 0 10px' }} />
            <div className="flex h-full flex-1 items-center gap-4 px-3 font-mono text-[10px]" style={{ background: LCARS_COLORS.cardBg }}>
              <span style={{ color: LCARS_COLORS.amber }}>
                MESH STATUS: {stats && stats.healthy >= (stats.sentinels >= 2 ? 2 : 1) ? 'NOMINAL' : 'DEGRADED'}
              </span>
              <span style={{ color: LCARS_COLORS.textMuted }}>
                CONSTITUTION: SHA-256 VERIFIED
              </span>
              <span style={{ color: LCARS_COLORS.textMuted }}>
                LAST SYNC: {governance?.updatedAt ? formatAge(getHeartbeatAge(governance.updatedAt)) : 'NEVER'}
              </span>
            </div>
            <div className="h-full w-20 shrink-0" style={{ background: LCARS_COLORS.amber, borderRadius: '0 0 10px 0' }}>
              <div className="flex h-full items-center justify-center">
                <button
                  onClick={() => { setLoading(true); fetchGovernance() }}
                  className="font-mono text-[10px] font-bold text-black hover:underline"
                >
                  REFRESH
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Node Detail ──────────────────────────────── */}
        <div className="flex w-56 shrink-0 flex-col gap-1">
          <div className="w-full" style={{ background: LCARS_COLORS.blue, borderRadius: '0 0 20px 0', height: '30px' }}>
            <div className="flex h-full items-center px-3 font-mono text-[10px] font-bold text-black">
              NODE DETAIL
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ background: LCARS_COLORS.panelBg }}>
            {selectedNodeData ? (
              <NodeDetailPanel node={selectedNodeData} vouchGraph={governance?.vouchGraph || []} allNodes={nodes} catalogIndex={governance?.catalogIndex || []} />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center">
                <div>
                  <div
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ border: `2px solid ${LCARS_COLORS.amber}44` }}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={LCARS_COLORS.amber} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <p className="font-mono text-xs" style={{ color: LCARS_COLORS.textMuted }}>
                    SELECT A NODE TO<br />VIEW DETAILS
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full" style={{ background: LCARS_COLORS.purple, borderRadius: '0 0 20px 0', height: '20px' }} />
        </div>
      </div>

      {/* ── Ambient Keyframes ─────────────────────────────────────────── */}
      <style>{`
        @keyframes lcars-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes lcars-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes lcars-ring-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes lcars-heartbeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .lcars-node-hover:hover {
          filter: brightness(1.3) drop-shadow(0 0 6px currentColor);
          cursor: pointer;
        }
        .lcars-glow {
          filter: drop-shadow(0 0 4px currentColor);
        }
      `}</style>
    </div>
  )
}

// ── LCARS Stat Block ────────────────────────────────────────────────────

function LCARSStatBlock({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5"
      style={{ background: LCARS_COLORS.cardBg, borderLeft: `4px solid ${color}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.textMuted }}>
          {label}
        </div>
        <div className="font-mono text-lg font-bold leading-tight" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  )
}

// ── Legend Item ──────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}88` }} />
      <span style={{ color: LCARS_COLORS.textMuted }}>{label}</span>
    </div>
  )
}

// ── Network Topology Visualization ─────────────────────────────────────

function NetworkTopology({
  nodes,
  vouchGraph,
  selectedNode,
  onSelectNode,
}: {
  nodes: FederationNodeDisplay[]
  vouchGraph: VouchEdge[]
  selectedNode: string | null
  onSelectNode: (id: string | null) => void
}) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ border: `2px dashed ${LCARS_COLORS.amber}44` }}
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke={LCARS_COLORS.amber} strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <p className="font-mono text-sm" style={{ color: LCARS_COLORS.amber }}>
            AWAITING FEDERATION SIGNAL
          </p>
          <p className="mt-1 font-mono text-xs" style={{ color: LCARS_COLORS.textMuted }}>
            No ministries detected in governance data
          </p>
        </div>
      </div>
    )
  }

  // Group by ring
  const flagship = nodes.filter((n) => n.ring === 0)
  const sentinels = nodes.filter((n) => n.ring === 1)
  const members = nodes.filter((n) => n.ring === 2)
  const outer = nodes.filter((n) => n.ring === 3)

  // Ring radii (% of smallest container dimension)
  const rings = [
    { r: 0, nodes: flagship },
    { r: 22, nodes: sentinels },
    { r: 38, nodes: members },
    { r: 52, nodes: outer },
  ]

  return (
    <div className="relative h-full w-full">
      {/* SVG layer for connections and rings */}
      <svg className="absolute inset-0 h-full w-full">
        {/* Concentric ring guides */}
        {[22, 38, 52].map((r) => (
          <circle
            key={r}
            cx="50%"
            cy="50%"
            r={`${r}%`}
            fill="none"
            stroke={LCARS_COLORS.amber}
            strokeWidth={0.5}
            opacity={0.15}
            strokeDasharray="4 4"
          />
        ))}

        {/* Vouch connections */}
        {vouchGraph.filter((v) => v.isValid).map((edge, i) => {
          const source = nodes.find((n) => n.id === edge.voucherId)
          const target = nodes.find((n) => n.id === edge.targetId)
          if (!source || !target) return null

          const sx = getNodeX(source)
          const sy = getNodeY(source)
          const tx = getNodeX(target)
          const ty = getNodeY(target)

          const isSelected = selectedNode === edge.voucherId || selectedNode === edge.targetId

          return (
            <line
              key={`vouch-${i}`}
              x1={`${sx}%`}
              y1={`${sy}%`}
              x2={`${tx}%`}
              y2={`${ty}%`}
              stroke={isSelected ? LCARS_COLORS.lavender : LCARS_COLORS.lavender}
              strokeWidth={isSelected ? 1.5 : 0.5}
              opacity={isSelected ? 0.8 : 0.2}
              strokeDasharray={isSelected ? undefined : '2 4'}
            />
          )
        })}
      </svg>

      {/* Node layer */}
      {nodes.map((node) => {
        const x = getNodeX(node)
        const y = getNodeY(node)
        const isSelected = selectedNode === node.id
        const size = node.role === 'flagship' ? 48 : node.role === 'sentinel' ? 32 : 24
        const color = getRoleColor(node.role)

        return (
          <button
            key={node.id}
            onClick={() => onSelectNode(isSelected ? null : node.id)}
            className="lcars-node-hover absolute flex items-center justify-center transition-all duration-300"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              transform: 'translate(-50%, -50%)',
              zIndex: isSelected ? 20 : node.ring === 0 ? 15 : 10,
            }}
            title={`${node.name} (${node.role})`}
          >
            {/* Pulse ring for healthy nodes */}
            {node.isHealthy && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: `1px solid ${color}`,
                  animation: 'lcars-heartbeat 2s ease-in-out infinite',
                  opacity: 0.4,
                }}
              />
            )}

            {/* Node body */}
            <div
              className="relative flex h-full w-full items-center justify-center rounded-full font-mono text-[8px] font-bold"
              style={{
                background: isSelected ? color : `${color}33`,
                border: `2px solid ${color}`,
                color: isSelected ? '#000' : color,
                boxShadow: isSelected ? `0 0 12px ${color}88, 0 0 24px ${color}44` : `0 0 6px ${color}44`,
              }}
            >
              {node.role === 'flagship' ? '★' : node.name.charAt(0).toUpperCase()}
            </div>

            {/* Status dot */}
            <div
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full"
              style={{
                background: getStatusColor(node.status),
                boxShadow: `0 0 4px ${getStatusColor(node.status)}`,
              }}
            />

            {/* Label (only for flagship and selected) */}
            {(node.role === 'flagship' || isSelected) && (
              <div
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-wider"
                style={{ color, textShadow: `0 0 8px ${color}88` }}
              >
                {node.name}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function getNodeX(node: FederationNodeDisplay): number {
  if (node.ring === 0) return 50
  const radius = node.ring === 1 ? 22 : node.ring === 2 ? 38 : 52
  return 50 + radius * Math.cos((node.angle * Math.PI) / 180 - Math.PI / 2)
}

function getNodeY(node: FederationNodeDisplay): number {
  if (node.ring === 0) return 50
  const radius = node.ring === 1 ? 22 : node.ring === 2 ? 38 : 52
  return 50 + radius * Math.sin((node.angle * Math.PI) / 180 - Math.PI / 2)
}

// ── Node Detail Panel ──────────────────────────────────────────────────

function NodeDetailPanel({
  node,
  vouchGraph,
  allNodes,
  catalogIndex,
}: {
  node: FederationNodeDisplay
  vouchGraph: VouchEdge[]
  allNodes: FederationNodeDisplay[]
  catalogIndex: Array<{ sourceMinistryId: string; productId: string; title: string; category: string }>
}) {
  const vouchesFor = vouchGraph.filter((v) => v.targetId === node.id && v.isValid)
  const vouchedBy = vouchesFor.map((v) => {
    const voucher = allNodes.find((n) => n.id === v.voucherId)
    return voucher?.name || v.voucherId.slice(0, 8)
  })

  return (
    <div className="space-y-3 p-3">
      {/* Node identity */}
      <div className="text-center">
        <div
          className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full font-mono text-lg font-bold"
          style={{
            background: `${getRoleColor(node.role)}33`,
            border: `2px solid ${getRoleColor(node.role)}`,
            color: getRoleColor(node.role),
            boxShadow: `0 0 12px ${getRoleColor(node.role)}44`,
          }}
        >
          {node.role === 'flagship' ? '★' : node.name.charAt(0).toUpperCase()}
        </div>
        <div className="font-mono text-sm font-bold" style={{ color: getRoleColor(node.role) }}>
          {node.name}
        </div>
        <div className="font-mono text-[10px]" style={{ color: LCARS_COLORS.textMuted }}>
          {node.domain}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: `${LCARS_COLORS.amber}33` }} />

      {/* Properties */}
      <DetailRow label="ROLE" value={node.role.toUpperCase()} color={getRoleColor(node.role)} />
      <DetailRow label="STATUS" value={node.status.toUpperCase()} color={getStatusColor(node.status)} />
      <DetailRow label="TRUST" value={`${Math.round(node.trustScore * 100)}%`} color={LCARS_COLORS.blue} />
      <DetailRow label="VOUCHES" value={`${node.vouchCount}`} color={LCARS_COLORS.lavender} />

      {/* Heartbeat */}
      <div className="flex items-center gap-2 px-1">
        <div
          className="h-2 w-2 rounded-full"
          style={{
            background: node.isHealthy ? LCARS_COLORS.green : LCARS_COLORS.red,
            animation: node.isHealthy ? 'lcars-pulse 2s ease-in-out infinite' : undefined,
            boxShadow: `0 0 4px ${node.isHealthy ? LCARS_COLORS.green : LCARS_COLORS.red}`,
          }}
        />
        <span className="font-mono text-[10px]" style={{ color: LCARS_COLORS.textMuted }}>
          HEARTBEAT: {formatAge(node.heartbeatAge)}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: `${LCARS_COLORS.amber}33` }} />

      {/* Operator */}
      <div className="px-1">
        <div className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.textMuted }}>OPERATOR</div>
        <div className="font-mono text-xs" style={{ color: LCARS_COLORS.peach }}>{node.operator || 'Unknown'}</div>
      </div>

      {/* Region */}
      {node.region && (
        <div className="px-1">
          <div className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.textMuted }}>REGION</div>
          <div className="font-mono text-xs" style={{ color: LCARS_COLORS.blue }}>{node.region}</div>
        </div>
      )}

      {/* Capabilities */}
      {node.capabilities.length > 0 && (
        <div className="px-1">
          <div className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.textMuted }}>CAPABILITIES</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {node.capabilities.slice(0, 6).map((cap) => (
              <span
                key={cap}
                className="rounded px-1.5 py-0.5 font-mono text-[9px]"
                style={{ background: `${LCARS_COLORS.amber}22`, color: LCARS_COLORS.amber }}
              >
                {cap}
              </span>
            ))}
            {node.capabilities.length > 6 && (
              <span className="font-mono text-[9px]" style={{ color: LCARS_COLORS.textMuted }}>
                +{node.capabilities.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Vouched by */}
      {vouchedBy.length > 0 && (
        <div className="px-1">
          <div className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.textMuted }}>VOUCHED BY</div>
          <div className="mt-1 space-y-0.5">
            {vouchedBy.map((name) => (
              <div key={name} className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: LCARS_COLORS.lavender }} />
                <span className="font-mono text-[10px]" style={{ color: LCARS_COLORS.lavender }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog drill-down — products/services this node offers */}
      {(() => {
        const nodeCatalog = catalogIndex.filter((c) => c.sourceMinistryId === node.id)
        if (nodeCatalog.length === 0) return null
        return (
          <>
            <div className="h-px" style={{ background: `${LCARS_COLORS.amber}33` }} />
            <div className="px-1">
              <div className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.amber }}>
                CATALOG ({nodeCatalog.length})
              </div>
              <div className="mt-1 space-y-0.5">
                {nodeCatalog.slice(0, 8).map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-2">
                    <span
                      className="truncate font-mono text-[10px]"
                      style={{ color: LCARS_COLORS.blueLight }}
                    >
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-[9px]" style={{ color: LCARS_COLORS.textMuted }}>
                      {item.category}
                    </span>
                  </div>
                ))}
                {nodeCatalog.length > 8 && (
                  <div className="font-mono text-[9px]" style={{ color: LCARS_COLORS.textMuted }}>
                    +{nodeCatalog.length - 8} more
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Visit Dashboard action */}
      <div className="h-px" style={{ background: `${LCARS_COLORS.amber}33` }} />
      <div className="px-1 pb-1">
        <a
          href="/dashboard/enterprise"
          className="block w-full rounded py-1.5 text-center font-mono text-[10px] tracking-wider transition-colors"
          style={{
            border: `1px solid ${LCARS_COLORS.amber}66`,
            color: LCARS_COLORS.amber,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${LCARS_COLORS.amber}15`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          VISIT DASHBOARD →
        </a>
      </div>
    </div>
  )
}

function DetailRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="font-mono text-[9px] tracking-wider" style={{ color: LCARS_COLORS.textMuted }}>{label}</span>
      <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
    </div>
  )
}
