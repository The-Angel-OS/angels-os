'use client'

import React, { useMemo, useState } from 'react'
import { nodeTabs, type CapabilityId } from './capabilities'
import { MerlinConsole } from './MerlinConsole'
import { TabbedPanel, type PanelTab } from '@/components/ui/TabbedPanel'

export type MerlinNode = {
  id: string
  hostname?: string
  name?: string
  url?: string
  lastSeen?: string
  capabilities?: string[]
  stats?: Record<string, unknown>
  [k: string]: unknown
}

const ONLINE_MS = 5 * 60 * 1000

function isOnline(node: MerlinNode) {
  if (!node.lastSeen) return false
  return Date.now() - new Date(node.lastSeen).getTime() < ONLINE_MS
}

function nodeUrl(node: MerlinNode) {
  return node.url || (node.hostname ? `http://${node.hostname}:3000` : null)
}

export function MerlinControlView({
  nodes,
  showNav,
  endeavor,
}: {
  nodes: MerlinNode[]
  showNav: boolean
  endeavor: string
}) {
  const [selectedId, setSelectedId] = useState(nodes[0]?.id ?? '')
  const node = useMemo(() => nodes.find((n) => n.id === selectedId) ?? nodes[0], [nodes, selectedId])
  const capTabs = useMemo(() => nodeTabs(node?.capabilities), [node])

  // Map the node's advertised capabilities onto the universal <TabbedPanel>.
  const panelTabs = useMemo<PanelTab[]>(
    () =>
      capTabs.map((t) => ({
        id: t.id,
        label: t.label,
        icon: <span>{t.icon}</span>,
        content: () => (node ? <ViewBody view={t.id} node={node} endeavor={endeavor} /> : null),
      })),
    [capTabs, node, endeavor],
  )

  if (!nodes.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
        No Merlin nodes registered for <span className="font-mono">{endeavor}</span> yet. A node
        appears here once it posts to <span className="font-mono">/api/node-ops/register</span>.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 gap-4 rounded-xl border border-border bg-card">
      {showNav && (
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-border p-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">Nodes</div>
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                n.id === node?.id ? 'bg-muted font-medium' : 'hover:bg-muted/50'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${isOnline(n) ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
              />
              <span className="truncate">{n.name || n.hostname || n.id}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        {/* Universal control: tab bar shows only the capabilities this node
            advertises; ?tab= makes each capability a deep-linkable surface.
            fill = the control fits its container; panes scroll internally. */}
        <TabbedPanel bare fill tabs={panelTabs} urlParam="tab" />
      </div>
    </div>
  )
}

/** CPU sparkline — fixed 0–100% scale, last point marked. */
function Sparkline({ values }: { values: number[] }) {
  const w = 600
  const h = 64
  const n = values.length
  const pts = values
    .map((v, i) => {
      const x = (i / (n - 1)) * w
      const y = h - (Math.max(0, Math.min(100, v)) / 100) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const lastY = h - (Math.max(0, Math.min(100, values[n - 1])) / 100) * h
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full text-green-500" preserveAspectRatio="none">
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="currentColor" fillOpacity="0.12" stroke="none" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={w} cy={lastY} r="3" fill="currentColor" />
    </svg>
  )
}

function ViewBody({ view, node, endeavor }: { view: CapabilityId; node: MerlinNode; endeavor: string }) {
  const url = nodeUrl(node)

  if (view === 'leo') {
    return <MerlinConsole endeavor={endeavor} nodeId={node.id} online={isOnline(node)} />
  }

  if (view === 'media') {
    return url ? (
      <div className="flex h-full min-h-0 flex-col">
        <a
          href={`${url}/media`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Open media library on {node.name || node.hostname} ↗
        </a>
        <iframe
          src={`${url}/media`}
          className="mt-3 min-h-0 w-full flex-1 rounded-lg border border-border"
          title="Merlin media library"
        />
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No URL reported for this node.</p>
    )
  }

  if (view === 'stats') {
    const stats = node.stats || {}
    const audio = Number(stats.audio_seconds)
    const wall = Number(stats.wall_seconds)
    const rt = audio && wall ? (audio / wall).toFixed(1) : null
    const rawSeries = (stats as Record<string, unknown>).cpu_series
    const series = Array.isArray(rawSeries) ? rawSeries.map(Number).filter((n) => !Number.isNaN(n)) : []
    const cpuPct = Number((stats as Record<string, unknown>).cpu_pct)
    const entries = Object.entries(stats).filter(([k]) => k !== 'cpu_series')
    return (
      <div className="space-y-3">
        {rt && (
          <div className="rounded-lg bg-muted p-4">
            <div className="text-3xl font-bold">{rt}× realtime</div>
            <div className="text-xs text-muted-foreground">audio processed ÷ compute time</div>
          </div>
        )}
        {series.length > 1 && (
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                CPU · last {series.length} samples (2s)
              </span>
              {!Number.isNaN(cpuPct) && <span className="text-2xl font-bold tabular-nums">{cpuPct}%</span>}
            </div>
            <Sparkline values={series} />
          </div>
        )}
        {entries.length ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {entries.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono">{String(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No stats reported yet.</p>
        )}
      </div>
    )
  }

  // leo / camera / screen / aux / telephony — advertised but UI not built yet.
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium">{view}</span> is advertised by this node but its view isn’t wired
      up yet.
    </p>
  )
}
