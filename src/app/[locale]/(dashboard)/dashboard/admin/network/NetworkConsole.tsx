'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Radio, Crown, Shield, Circle, Activity } from 'lucide-react'

interface SimNode {
  id: string
  name: string
  status: string
  connectionCount: number
  metadata?: { role?: string; rank?: number; transport?: string; availableSlots?: number }
}
interface SimTrail {
  nodeId: string
  workType: string
  successfulDispatches: number
  abandonments: number
}
interface SimResponse {
  narration: string
  coordinator: string | null
  online: number
  mock: number
  live: number
  stats: { totalNodes: number; activeNodes: number; totalEdges: number }
  sentinels: string[]
  trails: SimTrail[]
  nodes: SimNode[]
  dispatches: number
  completed: number
  heldUnderBackpressure: number
}

const roleBadge = (role?: string) => {
  if (role === 'flagship') return { icon: Crown, label: 'Flagship', cls: 'text-amber-500' }
  if (role === 'sentinel') return { icon: Shield, label: 'Sentinel', cls: 'text-emerald-500' }
  return { icon: Circle, label: 'Member', cls: 'text-muted-foreground' }
}

export function NetworkConsole() {
  const [data, setData] = useState<SimResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dispatch, setDispatch] = useState(24)
  const [seed, setSeed] = useState(3)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/federation/simulate?dispatch=${dispatch}&seed=${seed}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Simulate failed (${res.status})`)
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dispatch, seed])

  useEffect(() => {
    run()
  }, [run])

  const nodeName = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of data?.nodes ?? []) m.set(n.id, n.name)
    return m
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Radio className="h-6 w-6 text-primary" /> The Network — Central
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A live mockup of the federation. Mock nodes here become real by pointing at a peer (e.g. kendev.co).
            Pure simulation — no tokens spent.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Work units
            <input
              type="number"
              min={0}
              max={200}
              value={dispatch}
              onChange={(e) => setDispatch(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
              className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Seed
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 1)}
              className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Run
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Central's voice */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
              <Activity className="h-3.5 w-3.5" /> Central
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{data.narration}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Online', value: `${data.online}/${data.stats.totalNodes}` },
              { label: 'Coordinator', value: nodeName.get(data.coordinator || '') || '—' },
              { label: 'Dispatched', value: `${data.completed}/${data.dispatches}` },
              { label: 'Live / Mock', value: `${data.live} / ${data.mock}` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className="mt-1 truncate text-lg font-semibold">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Nodes */}
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Nodes</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.nodes.map((n) => {
                const b = roleBadge(n.metadata?.role)
                const Icon = b.icon
                const online = n.status === 'active'
                return (
                  <div key={n.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                        <span className="font-semibold">{n.name}</span>
                      </div>
                      <span className={`flex items-center gap-1 text-xs ${b.cls}`}>
                        <Icon className="h-3.5 w-3.5" /> {b.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Transport:{' '}
                        <span className={n.metadata?.transport === 'live' ? 'text-emerald-500' : 'text-amber-500'}>
                          {n.metadata?.transport ?? 'mock'}
                        </span>
                      </span>
                      <span>Slots free: {n.metadata?.availableSlots ?? '—'}</span>
                      <span>Links: {n.connectionCount}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trails */}
          {data.trails.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pheromone trails (where work is learning to flow)
              </h2>
              <div className="space-y-1.5">
                {data.trails.slice(0, 10).map((t) => (
                  <div
                    key={`${t.workType}:${t.nodeId}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{nodeName.get(t.nodeId) || t.nodeId}</span>{' '}
                      <span className="text-muted-foreground">· {t.workType}</span>
                    </span>
                    <span className="font-mono text-xs text-emerald-500">
                      {t.successfulDispatches}✓{t.abandonments ? ` ${t.abandonments}✗` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
