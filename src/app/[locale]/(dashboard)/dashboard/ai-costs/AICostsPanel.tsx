'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Types (mirror AiCostSummary from src/utilities/aiCostTelemetry.ts)
// ---------------------------------------------------------------------------

interface CostBucket {
  key: string
  provider?: string
  responses: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCents: number
  unpriced: number
  free: number
}

interface AiCostSummary {
  windowDays: number
  since: string
  generatedAt: string
  totals: {
    responses: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costCents: number
    unpricedResponses: number
    freeResponses: number
    paidResponses: number
    failoverResponses: number
  }
  economics: {
    burnRateCentsPerDay: number
    projectedMonthlyCents: number
    freeRatio: number
    failoverRate: number
    avgCostPerResponseCents: number
  }
  latency: { avgMs: number; p50Ms: number; p95Ms: number; avgTtftMs: number; samples: number }
  byDay: CostBucket[]
  byModel: CostBucket[]
  byProvider: CostBucket[]
  sampled: boolean
  scanned: number
  ledger?: CostLedgerSummary
}

interface LedgerCategoryBucket {
  category: string
  events: number
  costCents: number
  byokCostCents: number
  platformCostCents: number
}

interface CostLedgerSummary {
  available: boolean
  totals: { events: number; costCents: number; platformCostCents: number; byokCostCents: number }
  byCategory: LedgerCategoryBucket[]
  byProvider: { provider: string; category: string; events: number; costCents: number }[]
}

const CATEGORY_LABELS: Record<string, string> = {
  intelligence: 'Intelligence (AI)',
  telephony: 'Telephony / Realtime',
  storage: 'Storage',
  infra: 'Infrastructure',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  intelligence: 'bg-purple-500',
  telephony: 'bg-cyan-500',
  storage: 'bg-blue-500',
  infra: 'bg-orange-500',
  other: 'bg-gray-400',
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Cents → "$1.2345" / "$12.34" / "<$0.01" / "$0". Cost telemetry is in cents. */
function fmtUsd(cents: number): string {
  if (!cents) return '$0'
  const dollars = cents / 100
  if (dollars > 0 && dollars < 0.01) return '<$0.01'
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: dollars < 1 ? 4 : 2 })}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function fmtMs(ms: number): string {
  if (!ms) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

const PROVIDER_COLORS: Record<string, string> = {
  ollama: 'bg-emerald-500',
  groq: 'bg-amber-500',
  anthropic: 'bg-orange-500',
  google: 'bg-blue-500',
  openai: 'bg-teal-500',
  gateway: 'bg-purple-500',
  unknown: 'bg-gray-400',
}

const WINDOWS = [7, 30, 90]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AICostsPanel() {
  const [data, setData] = useState<AiCostSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchData = useCallback(async (window: number) => {
    try {
      const res = await fetch(`/api/cic/ai-costs?days=${window}`, { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as AiCostSummary
      setData(json)
      setError(null)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI cost data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 60s; refetch immediately when the window changes.
  useEffect(() => {
    setLoading(true)
    fetchData(days)
    const interval = setInterval(() => fetchData(days), 60_000)
    return () => clearInterval(interval)
  }, [fetchData, days])

  const maxDayCost = useMemo(
    () => (data ? Math.max(1, ...data.byDay.map((d) => d.costCents)) : 1),
    [data],
  )

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Tallying AI spend…</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-amber-200/30 bg-amber-950/20 p-6">
          <h2 className="mb-2 text-lg font-semibold text-amber-200">AI Costs Warming Up</h2>
          <p className="mb-1 text-sm text-amber-400/70">
            Couldn&apos;t load cost telemetry. This is normal on first load or after a deploy.
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            onClick={() => fetchData(days)}
            className="mt-3 rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const t = data.totals
  const e = data.economics

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Costs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What LEO is costing — read-only from per-response telemetry. Costs are list-price
            estimates; local (Ollama) inference is $0.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-border">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={`px-3 py-1 text-xs transition-colors ${
                  days === w ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => fetchData(days)}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top Cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card label={`Spend · last ${data.windowDays}d`}>
          <div className="text-3xl font-bold">{fmtUsd(t.costCents)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t.responses.toLocaleString()} responses · {fmtTokens(t.totalTokens)} tokens
          </div>
        </Card>

        <Card label="Burn Rate">
          <div className="text-3xl font-bold">{fmtUsd(e.burnRateCentsPerDay)}<span className="ml-1 text-sm font-normal text-muted-foreground">/day</span></div>
          <div className="mt-2 text-xs text-muted-foreground">
            avg {fmtUsd(e.avgCostPerResponseCents)} / response
          </div>
        </Card>

        <Card label="Projected Monthly">
          <div className="text-3xl font-bold">{fmtUsd(e.projectedMonthlyCents)}</div>
          <div className="mt-2 text-xs text-muted-foreground">at current burn × 30 days</div>
        </Card>

        <Card label="Free (local) ratio">
          <div className="text-3xl font-bold">{fmtPct(e.freeRatio)}</div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-emerald-600">{t.freeResponses} free</span>
            <span className="text-orange-600">{t.paidResponses} paid</span>
            {t.unpricedResponses > 0 && (
              <span className="text-muted-foreground">{t.unpricedResponses} unpriced</span>
            )}
          </div>
        </Card>
      </div>

      {/* ── Operating Costs by Category (unified ledger) ───────── */}
      {data.ledger?.available && data.ledger.byCategory.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Operating Costs by Category
            </h2>
            <span className="text-xs text-muted-foreground">
              ledger · {fmtUsd(data.ledger.totals.costCents)} total
              {data.ledger.totals.byokCostCents > 0 && (
                <> · {fmtUsd(data.ledger.totals.byokCostCents)} BYOK ($0 to platform)</>
              )}
            </span>
          </div>
          <div className="space-y-2">
            {data.ledger.byCategory.map((c) => {
              const share = data.ledger!.totals.costCents > 0 ? c.costCents / data.ledger!.totals.costCents : 0
              const color = CATEGORY_COLORS[c.category] || 'bg-gray-400'
              return (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                    <span className="font-medium">{CATEGORY_LABELS[c.category] || c.category}</span>
                    <span className="ml-auto shrink-0 font-semibold">{fmtUsd(c.costCents)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, share * 100)}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground">
                      {c.events} event{c.events === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Live from the cost-events ledger — accrues forward across all cost sources (AI,
            telephony, storage, infra). The AI breakdown below covers full history from message
            telemetry.
          </p>
        </div>
      )}

      {/* ── Daily spend sparkline + Failover/Latency ───────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily spend bars (2 cols) */}
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Daily Spend</h2>
          {data.byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI traffic in this window.</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {data.byDay.map((d) => (
                <div key={d.key} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-purple-500/70 transition-all group-hover:bg-purple-400"
                    style={{ height: `${Math.max(2, (d.costCents / maxDayCost) * 100)}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow group-hover:block">
                    <div className="font-medium">{d.key}</div>
                    <div>{fmtUsd(d.costCents)} · {d.responses} resp</div>
                    <div className="text-muted-foreground">{fmtTokens(d.totalTokens)} tokens</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.byDay.length > 0 && (
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{data.byDay[0]?.key}</span>
              <span>{data.byDay[data.byDay.length - 1]?.key}</span>
            </div>
          )}
        </div>

        {/* Reliability + latency */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Reliability & Latency</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Failover rate">
              <span className={data.totals.failoverResponses > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                {fmtPct(e.failoverRate)} ({t.failoverResponses})
              </span>
            </Row>
            <Row label="Avg latency">{fmtMs(data.latency.avgMs)}</Row>
            <Row label="p95 latency">{fmtMs(data.latency.p95Ms)}</Row>
            <Row label="Avg TTFT">{fmtMs(data.latency.avgTtftMs)}</Row>
            <Row label="Tokens in / out">
              {fmtTokens(t.inputTokens)} / {fmtTokens(t.outputTokens)}
            </Row>
          </dl>
        </div>
      </div>

      {/* ── By model + By provider ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable title="By Model" buckets={data.byModel} showProvider totalCost={t.costCents} />
        <BreakdownTable title="By Provider" buckets={data.byProvider} totalCost={t.costCents} colorByKey />
      </div>

      {/* ── Footer / honesty note ──────────────────────────────── */}
      <p className="text-xs text-muted-foreground">
        Scanned {data.scanned.toLocaleString()} responses{data.sampled ? ' (capped — totals are a floor)' : ''}.
        Costs are best-effort list-price estimates from per-response telemetry, not an authoritative bill.
        The dedicated ai-usage ledger will make these exact.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function BreakdownTable({
  title,
  buckets,
  showProvider,
  colorByKey,
  totalCost,
}: {
  title: string
  buckets: CostBucket[]
  showProvider?: boolean
  colorByKey?: boolean
  totalCost: number
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">{title}</h2>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {buckets.map((b) => {
            const share = totalCost > 0 ? b.costCents / totalCost : 0
            const colorKey = colorByKey ? b.key : b.provider || 'unknown'
            const color = PROVIDER_COLORS[colorKey] || 'bg-gray-400'
            return (
              <div key={b.key} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                  <span className="truncate font-medium" title={b.key}>{b.key}</span>
                  {showProvider && b.provider && (
                    <span className="shrink-0 text-xs text-muted-foreground">{b.provider}</span>
                  )}
                  <span className="ml-auto shrink-0 text-sm font-semibold">{fmtUsd(b.costCents)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground">
                    {b.responses} · {fmtTokens(b.totalTokens)}
                    {b.free > 0 ? ` · ${b.free} free` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
