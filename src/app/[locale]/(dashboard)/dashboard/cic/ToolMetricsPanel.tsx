'use client'

import React, { useEffect, useState, useCallback } from 'react'

// Read-model over Message.metadata.toolChain — see /api/metrics-ops/tools.
interface ToolRow { name: string; calls: number; errorRate: number; p50: number; p95: number; p99: number; maxMs: number }
interface ModelRow { name: string; responses: number; p50: number; p95: number; p99: number; totalCostCents: number; avgTokens: number }
interface MetricsData { messagesScanned: number; tracesWithSteps: number; stepsTotal: number; tools: ToolRow[]; models: ModelRow[] }

const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`)

export default function ToolMetricsPanel() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics-ops/tools?limit=3000', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 403 ? ' — super_admin only' : ''}`)
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Performance — Tools &amp; Models</h2>
          {data && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.messagesScanned} turns · {data.tracesWithSteps} with tool-chains · {data.stepsTotal} steps · latency p50/p95/p99
            </p>
          )}
        </div>
        <button onClick={load} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Refresh</button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading metrics…</div>
      ) : error ? (
        <div className="py-4 text-sm text-amber-400/80">Metrics unavailable: {error}</div>
      ) : !data || (!data.tools.length && !data.models.length) ? (
        <div className="py-4 text-sm text-muted-foreground">No tool-chain telemetry yet.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tools — slowest first */}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Tools (slowest p95 first)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2">Tool</th><th className="py-1 px-2 text-right">Calls</th>
                    <th className="py-1 px-2 text-right">Err</th><th className="py-1 px-2 text-right">p50</th>
                    <th className="py-1 px-2 text-right">p95</th><th className="py-1 pl-2 text-right">p99</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tools.map((t) => (
                    <tr key={t.name} className="border-t border-border/50">
                      <td className="py-1 pr-2 font-mono">{t.name}</td>
                      <td className="py-1 px-2 text-right">{t.calls}</td>
                      <td className={`py-1 px-2 text-right ${t.errorRate > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{Math.round(t.errorRate * 100)}%</td>
                      <td className="py-1 px-2 text-right">{ms(t.p50)}</td>
                      <td className={`py-1 px-2 text-right ${t.p95 >= 10000 ? 'text-amber-400' : ''}`}>{ms(t.p95)}</td>
                      <td className="py-1 pl-2 text-right">{ms(t.p99)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Models — latency + cost (two-lane posture) */}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Models (latency &amp; cost)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2">Provider / Model</th><th className="py-1 px-2 text-right">Resp</th>
                    <th className="py-1 px-2 text-right">p50</th><th className="py-1 px-2 text-right">p95</th>
                    <th className="py-1 px-2 text-right">Cost</th><th className="py-1 pl-2 text-right">Tok</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => (
                    <tr key={m.name} className="border-t border-border/50">
                      <td className="py-1 pr-2 font-mono">{m.name}</td>
                      <td className="py-1 px-2 text-right">{m.responses}</td>
                      <td className="py-1 px-2 text-right">{ms(m.p50)}</td>
                      <td className="py-1 px-2 text-right">{ms(m.p95)}</td>
                      <td className="py-1 px-2 text-right">${(m.totalCostCents / 100).toFixed(2)}</td>
                      <td className="py-1 pl-2 text-right">{m.avgTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
