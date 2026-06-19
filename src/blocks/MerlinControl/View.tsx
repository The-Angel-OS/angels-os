'use client'

import React, { useMemo, useState } from 'react'
import { nodeTabs, type CapabilityId } from './capabilities'

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
  const tabs = useMemo(() => nodeTabs(node?.capabilities), [node])
  const [view, setView] = useState<CapabilityId>(tabs[0]?.id ?? 'media')

  // keep the active view valid when the node changes
  const activeView = tabs.some((t) => t.id === view) ? view : (tabs[0]?.id ?? 'media')

  if (!nodes.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
        No Merlin nodes registered for <span className="font-mono">{endeavor}</span> yet. A node
        appears here once it posts to <span className="font-mono">/api/node-ops/register</span>.
      </div>
    )
  }

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card">
      {showNav && (
        <nav className="w-56 shrink-0 border-r border-border p-2">
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

      <div className="min-w-0 flex-1 p-4">
        {/* tab bar — only the capabilities this node advertises */}
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                t.id === activeView ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {node && <ViewBody view={activeView} node={node} />}
      </div>
    </div>
  )
}

function ViewBody({ view, node }: { view: CapabilityId; node: MerlinNode }) {
  const url = nodeUrl(node)

  if (view === 'media') {
    return url ? (
      <div>
        <a
          href={`${url}/media`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Open media library on {node.name || node.hostname} ↗
        </a>
        <iframe
          src={`${url}/media`}
          className="mt-3 h-[60vh] w-full rounded-lg border border-border"
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
    const entries = Object.entries(stats)
    return (
      <div className="space-y-3">
        {rt && (
          <div className="rounded-lg bg-muted p-4">
            <div className="text-3xl font-bold">{rt}× realtime</div>
            <div className="text-xs text-muted-foreground">audio processed ÷ compute time</div>
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
