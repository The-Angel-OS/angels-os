'use client'

import React, { useMemo, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2 } from 'lucide-react'
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

export function isOnline(node: MerlinNode) {
  if (!node.lastSeen) return false
  return Date.now() - new Date(node.lastSeen).getTime() < ONLINE_MS
}

/**
 * NodeSurface — the per-node control surface: the node's advertised capabilities
 * (Console / Screenshots / Media / Stats) mapped onto the universal <TabbedPanel>.
 *
 * The single source of truth for "what you can do with one node", shared by the
 * MerlinControl block AND the CIC telemetry control panel (/dashboard/telemetry).
 * When `canControl` is false (a federated, view-only node) the LEO console — the
 * command uplink — is dropped, leaving only the read surfaces.
 */
export function NodeSurface({
  node,
  endeavor,
  canControl = true,
  hideTabBar,
  tabBarRight,
}: {
  node: MerlinNode
  endeavor: string
  canControl?: boolean
  hideTabBar?: boolean
  tabBarRight?: React.ReactNode
}) {
  const capTabs = useMemo(() => {
    const tabs = nodeTabs(node?.capabilities)
    return canControl ? tabs : tabs.filter((t) => t.id !== 'leo')
  }, [node, canControl])

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

  return (
    <TabbedPanel bare fill tabs={panelTabs} urlParam="tab" hideTabBar={hideTabBar} tabBarRight={tabBarRight} />
  )
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
  const [navOpen, setNavOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false) // hide tabs → just the active surface (chat)
  const node = useMemo(() => nodes.find((n) => n.id === selectedId) ?? nodes[0], [nodes, selectedId])

  if (!nodes.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
        No Merlin nodes registered for <span className="font-mono">{endeavor}</span> yet. A node
        appears here once it posts to <span className="font-mono">/api/node-ops/register</span>.
      </div>
    )
  }

  const toggleBtnClass =
    'rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      {/* Node tab bar — replaces the side nav */}
      {showNav && navOpen && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3">
          {nodes.map((n) => {
            const sel = n.id === node?.id
            return (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors ${
                  sel ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${isOnline(n) ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                />
                {n.name || n.hostname || n.id}
                {sel && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />}
              </button>
            )
          })}
        </div>
      )}

      {/* Capability tab panel — shows the selected node's advertised surfaces */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        {node && (
          <NodeSurface
            node={node}
            endeavor={endeavor}
            hideTabBar={focusMode}
            tabBarRight={
              <>
                {showNav && (
                  <button
                    type="button"
                    onClick={() => setNavOpen((v) => !v)}
                    className={toggleBtnClass}
                    title={navOpen ? 'Hide node tabs' : 'Show node tabs'}
                    aria-label={navOpen ? 'Hide node tabs' : 'Show node tabs'}
                  >
                    {navOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFocusMode((v) => !v)}
                  className={toggleBtnClass}
                  title={focusMode ? 'Show tabs' : 'Focus — hide tabs'}
                  aria-label={focusMode ? 'Show tabs' : 'Focus — hide tabs'}
                >
                  {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </>
            }
          />
        )}
      </div>
    </div>
  )
}

type Submittal = { id: string | number; url: string; filename: string; alt?: string; at: string }

/** Screenshots — the node's submitted snapshots (camera/window/sentinel), newest first. */
function Screenshots({ endeavor, nodeId }: { endeavor: string; nodeId: string }) {
  const [items, setItems] = React.useState<Submittal[]>([])
  const [loaded, setLoaded] = React.useState(false)

  const poll = React.useCallback(async () => {
    try {
      const r = await fetch(
        `/api/node-ops/media?endeavor=${encodeURIComponent(endeavor)}&nodeId=${encodeURIComponent(nodeId)}`,
        { credentials: 'include' },
      )
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d.items)) setItems(d.items)
    } catch {
      /* transient */
    } finally {
      setLoaded(true)
    }
  }, [endeavor, nodeId])

  React.useEffect(() => {
    void poll()
    const id = setInterval(() => void poll(), 10000)
    return () => clearInterval(id)
  }, [poll])

  if (loaded && !items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No submittals yet. This node’s camera/window snapshots (and sentinel captures) appear here once it
        submits them.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((s) => (
        <a
          key={String(s.id)}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="group block overflow-hidden rounded-lg border border-border bg-muted/20"
          title={`${s.alt || s.filename} · ${new Date(s.at).toLocaleString()}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- node-submitted media, arbitrary host */}
          <img src={s.url} alt={s.alt || s.filename} className="aspect-video w-full object-cover transition group-hover:opacity-90" loading="lazy" />
          <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">
            {new Date(s.at).toLocaleString()}
          </div>
        </a>
      ))}
    </div>
  )
}

type BrowsableFile = {
  ref: string
  path: string
  name: string
  sizeMB: number
  mtime: string
  root: string
  tunnelUrl?: string
}

/**
 * FileBrowser — a real directory browser, not a dump of paths.
 *
 * What this replaced: a bus round-trip. Core posted a `list_files` command to
 * the node's channel, the node answered with a message, and this component
 * polled every 1.5s for up to 30 seconds hoping the reply had landed. On an
 * eventually-consistent mailbox the only renderable answer is a flat, capped,
 * newest-first list — so that is what it drew, and it cached the result in
 * localStorage because asking again was so expensive.
 *
 * Now it is one synchronous request through the node's tunnel, so the UI can be
 * what it should always have been: folders, a breadcrumb, and files you open.
 * No cache — a stale listing is how you get "not found" on something you just
 * recorded, and at ~100ms there is nothing to hide.
 *
 * Links stay INDIRECT — (endeavor, nodeId, ref) resolved through Core at click
 * time, never a stored tunnel URL. Core looks up the node's current address per
 * request, so a rotating tunnel cannot rot a link. @see /api/node-ops/browse
 */
type BrowseDir = { name: string; ref: string; online?: boolean }
type BrowseResult = {
  ok: boolean
  error?: string
  ref: string
  trail: BrowseDir[]
  dirs: BrowseDir[]
  files: BrowsableFile[]
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|heic)$/i
const VIDEO_RE = /\.(mp4|m4v|mkv|webm|mov|avi|wmv|flv)$/i

function FileBrowser({ endeavor, nodeId, nodeName }: { endeavor: string; nodeId: string; nodeName: string }) {
  const [ref, setRef] = React.useState('')
  const [data, setData] = React.useState<BrowseResult | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = React.useState<string | null>(null)
  const [viewing, setViewing] = React.useState<BrowsableFile | null>(null)

  const hrefFor = React.useCallback(
    (r: string) =>
      `/api/node-ops/file?endeavor=${encodeURIComponent(endeavor)}&nodeId=${encodeURIComponent(nodeId)}&ref=${encodeURIComponent(r)}`,
    [endeavor, nodeId],
  )

  const load = React.useCallback(
    async (next: string) => {
      setStatus('loading')
      setError(null)
      try {
        const res = await fetch(
          `/api/node-ops/browse?endeavor=${encodeURIComponent(endeavor)}&nodeId=${encodeURIComponent(nodeId)}&ref=${encodeURIComponent(next)}`,
          { credentials: 'include' },
        )
        const d = (await res.json()) as BrowseResult
        if (!d.ok) {
          setStatus('error')
          // The node distinguishes "drive not connected" from "folder not found";
          // showing its own words beats a generic failure.
          setError(d.error || `Could not read ${nodeName}`)
          return
        }
        setData(d)
        setRef(d.ref)
        setStatus('ready')
      } catch {
        setStatus('error')
        setError('Network error')
      }
    },
    [endeavor, nodeId, nodeName],
  )

  React.useEffect(() => {
    void load('')
  }, [load])

  const trail = data?.trail ?? []

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Breadcrumb — the sense of place the flat list never had. */}
      <nav className="flex shrink-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <button
          onClick={() => void load('')}
          className="rounded px-1.5 py-0.5 font-medium hover:bg-muted/50 hover:text-foreground"
        >
          {nodeName}
        </button>
        {trail.map((t) => (
          <React.Fragment key={t.ref}>
            <span aria-hidden>/</span>
            <button
              onClick={() => void load(t.ref)}
              className="rounded px-1.5 py-0.5 hover:bg-muted/50 hover:text-foreground"
            >
              {t.name}
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {status === 'loading' && <p className="p-4 text-sm text-muted-foreground">Reading {nodeName}…</p>}

        {status === 'error' && (
          <div className="p-4 text-sm">
            <p className="text-amber-600 dark:text-amber-400">{error}</p>
            <button onClick={() => void load(ref)} className="mt-2 text-xs font-medium text-primary hover:underline">
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && data && (
          <ul className="divide-y divide-border">
            {data.dirs.map((d) => (
              <li key={d.ref}>
                <button
                  onClick={() => d.online !== false && void load(d.ref)}
                  disabled={d.online === false}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span aria-hidden>{d.online === false ? '\u26a0' : '\ud83d\udcc1'}</span>
                  <span className="font-medium">{d.name}</span>
                  {d.online === false && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">drive not connected</span>
                  )}
                </button>
              </li>
            ))}

            {data.files.map((f) => (
              <li key={f.ref} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                <span aria-hidden>{VIDEO_RE.test(f.name) ? '\ud83c\udfac' : IMAGE_RE.test(f.name) ? '\ud83d\uddbc' : '\ud83d\udcc4'}</span>
                <button
                  onClick={() => setViewing(f)}
                  className="min-w-0 flex-1 text-left text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <span className="block truncate">{f.name}</span>
                </button>
                <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{f.sizeMB} MB</span>
                <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                  {new Date(f.mtime).toLocaleDateString()}
                </span>
              </li>
            ))}

            {data.dirs.length === 0 && data.files.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">This folder is empty.</li>
            )}
          </ul>
        )}
      </div>

      {/* Viewer — plays or shows in place; the file never lands on Core's disk. */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewing(null)}
          role="dialog"
          aria-label={viewing.name}
        >
          <div className="max-h-full w-full max-w-4xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {VIDEO_RE.test(viewing.name) ? (
              <video src={hrefFor(viewing.ref)} controls autoPlay className="max-h-[80vh] w-full rounded-lg bg-black" />
            ) : IMAGE_RE.test(viewing.name) ? (
              // eslint-disable-next-line @next/next/no-img-element -- a node file, not a Payload upload
              <img src={hrefFor(viewing.ref)} alt={viewing.name} className="max-h-[80vh] w-full rounded-lg object-contain" />
            ) : (
              <p className="rounded-lg bg-background p-4 text-sm">
                No preview for this type —{' '}
                <a href={hrefFor(viewing.ref)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  open it directly
                </a>
                .
              </p>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-white/80">
              <span className="truncate">{viewing.name}</span>
              <button onClick={() => setViewing(null)} className="rounded px-2 py-1 hover:bg-white/10">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
  if (view === 'leo') {
    return <MerlinConsole endeavor={endeavor} nodeId={node.id} online={isOnline(node)} />
  }

  if (view === 'screenshots') {
    return <Screenshots endeavor={endeavor} nodeId={node.id} />
  }

  if (view === 'media') {
    return <FileBrowser endeavor={endeavor} nodeId={node.id} nodeName={node.name || node.hostname || node.id} />
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
