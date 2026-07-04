'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Cpu, MemoryStick, Radio, Wifi, WifiOff, ChevronRight } from 'lucide-react'
import { NodeSurface, isOnline, type MerlinNode } from '@/blocks/MerlinControl/View'

/**
 * TelemetryCIC — the Command Information Center for Merlin nodes (/dashboard/telemetry).
 *
 * The premise (per the AI Bus): every node that locks on gets a dedicated channel —
 * its heartbeat, tool-use, and command/result traffic ARE the telemetry. This view is
 * the lens on that: a roster of the portal's nodes (which are alive, their vitals) on
 * the left, and the selected node's live control surface — the conversation + the
 * command uplink — on the right. Nodes are ONE item on the telemetry dashboard; the
 * AI Costs viewscreen stays its own separate concern.
 *
 * Data: polls the endeavor-member-gated /api/node-ops/telemetry. Pure read; the detail
 * surface (NodeSurface) reuses the MerlinControl block's live wiring end-to-end.
 */

type AiBus = { total24h: number; byType: { type: string; count: number }[]; sampled: boolean }

type TelemetryResponse = {
  ok: boolean
  endeavor: string
  canControl: boolean
  total: number
  online: number
  nodes: MerlinNode[]
  aiBus: AiBus | null
  error?: string
}

const MSG_TYPE_LABELS: Record<string, string> = {
  user: 'Human',
  ai_agent: 'LEO',
  system: 'System',
  announcement: 'Announce',
  voice_call: 'Voice',
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Compact 0–100% meter with a label. */
function Meter({ label, pct, icon }: { label: string; pct?: number; icon: React.ReactNode }) {
  const val = pct != null ? Math.max(0, Math.min(100, Math.round(pct))) : null
  const tone = val == null ? 'bg-muted-foreground/30' : val > 85 ? 'bg-red-500' : val > 60 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-1.5" title={`${label}${val != null ? ` ${val}%` : ' —'}`}>
      <span className="text-muted-foreground">{icon}</span>
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${val ?? 0}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{val != null ? `${val}%` : '—'}</span>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold ${accent ?? ''}`}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function ageLabel(lastSeen?: string): string {
  if (!lastSeen) return 'never'
  const mins = Math.round((Date.now() - new Date(lastSeen).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function TelemetryCIC({
  endeavor,
  endeavorName,
}: {
  endeavor: string
  endeavorName: string
}) {
  const [data, setData] = useState<TelemetryResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchTelemetry = useCallback(async () => {
    if (!endeavor) {
      setError('This portal has no endeavor slug — nodes register per endeavor.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/node-ops/telemetry?endeavor=${encodeURIComponent(endeavor)}`, {
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as TelemetryResponse
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
      setError(null)
      setLastRefresh(new Date())
      // Keep selection stable; default to the first (newest-seen) node.
      setSelectedId((cur) => (cur && json.nodes.some((n) => n.id === cur) ? cur : json.nodes[0]?.id ?? ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach node telemetry')
    } finally {
      setLoading(false)
    }
  }, [endeavor])

  useEffect(() => {
    void fetchTelemetry()
    const id = setInterval(() => void fetchTelemetry(), 30_000)
    return () => clearInterval(id)
  }, [fetchTelemetry])

  const nodes = data?.nodes ?? []
  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? nodes[0], [nodes, selectedId])
  const computeCount = useMemo(
    () => nodes.filter((n) => Boolean((n as { compute?: { available?: boolean } }).compute?.available)).length,
    [nodes],
  )

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">
        Establishing node telemetry link…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber-200/30 bg-amber-950/20 p-6">
          <h2 className="mb-2 text-lg font-semibold text-amber-200">Telemetry link not established</h2>
          <p className="mb-1 text-sm text-amber-400/70">
            No node telemetry for <span className="font-mono">{endeavor || 'this portal'}</span> yet — this is
            normal until a Merlin locks on, or if you lack access to this endeavor.
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button onClick={() => void fetchTelemetry()} className="mt-3 rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const aiBus = data?.aiBus

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[36rem] flex-col gap-4 p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telemetry — {endeavorName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Merlin node CIC • each node is a channel on the AI Bus — its conversation is its telemetry
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <span className="text-xs text-muted-foreground">Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button
            onClick={() => void fetchTelemetry()}
            className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Telemetry widget strip (derived from the roster) ── */}
      <div className="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Nodes Online"
          value={<span className={data && data.online > 0 ? 'text-emerald-500' : ''}>{data?.online ?? 0}</span>}
          sub={`${data?.total ?? 0} locked on`}
        />
        <StatCard label="Compute Nodes" value={computeCount} sub="advertising a local brain" />
        <StatCard
          label="AI Bus · 24h"
          value={aiBus?.total24h ?? 0}
          sub={
            aiBus && aiBus.byType.length > 0 ? (
              <span className="inline-flex flex-wrap gap-1">
                {aiBus.byType.slice(0, 4).map((t) => (
                  <span key={t.type} className="rounded-full bg-muted px-1.5 py-0.5">
                    {MSG_TYPE_LABELS[t.type] || t.type} <span className="font-semibold">{t.count}</span>
                  </span>
                ))}
              </span>
            ) : (
              'quiet on the bus'
            )
          }
        />
        <StatCard
          label="Node Traffic"
          value={<Radio className="h-7 w-7 text-primary" />}
          sub={data && data.online > 0 ? 'live — polling every 30s' : 'no nodes reporting'}
        />
      </div>

      {/* ── Roster rail + node detail ────────────────────────── */}
      {nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <div className="max-w-md text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">No Merlin nodes locked onto this portal yet.</p>
            <p className="text-sm">
              A machine joins via Merlin → Connect → lock this node on. Once it posts to{' '}
              <span className="font-mono">/api/node-ops/register</span>, it appears here with a channel on the AI Bus.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
          {/* Roster rail */}
          <div className="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nodes ({nodes.length})
            </div>
            <div className="divide-y divide-border">
              {nodes.map((n) => {
                const online = isOnline(n)
                const stats = (n.stats as Record<string, unknown> | undefined) || {}
                const cpu = num(stats.cpu_pct)
                const mem = num(stats.mem_used_pct)
                const sel = n.id === selected?.id
                const name = n.name || n.hostname || n.id
                return (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={`flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors ${
                      sel ? 'bg-muted' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                      {online ? (
                        <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                      {sel && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </div>
                    <div className="flex items-center gap-3 pl-4">
                      <Meter label="CPU" pct={cpu} icon={<Cpu className="h-3 w-3" />} />
                      <Meter label="RAM" pct={mem} icon={<MemoryStick className="h-3 w-3" />} />
                    </div>
                    <div className="flex items-center gap-2 pl-4 text-[10px] text-muted-foreground">
                      <span>{ageLabel(n.lastSeen)}</span>
                      {typeof n.platform === 'string' && <span>· {n.platform}</span>}
                      {(n as { tunnelUrl?: string }).tunnelUrl && <span className="text-emerald-600 dark:text-emerald-400">· tunnel</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Node detail — the live control surface (conversation + uplink + tabs) */}
          <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
            {selected && (
              <>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${isOnline(selected) ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    <span className="font-semibold">{selected.name || selected.hostname || selected.id}</span>
                    <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {typeof selected.version === 'string' && <span className="rounded bg-muted px-1.5 py-0.5">v{selected.version}</span>}
                    {(selected as { channel?: string }).channel && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono" title="AI Bus channel">
                        {(selected as { channel?: string }).channel}
                      </span>
                    )}
                    {!data?.canControl && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">view-only</span>
                    )}
                  </div>
                </div>
                <div className="min-h-0 flex-1 p-4">
                  <NodeSurface node={selected} endeavor={endeavor} canControl={Boolean(data?.canControl)} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
