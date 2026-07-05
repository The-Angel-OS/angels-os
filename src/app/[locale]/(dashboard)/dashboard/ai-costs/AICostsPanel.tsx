'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

/** "Currently employed" window — a provider/model used within this is shown live. */
const ACTIVE_MS = 10 * 60 * 1000

/** Human "time ago" from an ISO string, relative to a ticking `now`. */
function timeAgo(iso: string | undefined, now: number): string {
  if (!iso) return 'never'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

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
  /** ISO timestamp of the most recent response in this bucket (live indicator). */
  lastAt?: string
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
  budget?: AiBudgetStatus
  reconciliation?: FeeReconciliation
}

interface FeeReconciliation {
  scope: 'tenant' | 'platform'
  windowDays: number
  aiCostCents: number
  nonAiCostCents: number
  costCents: number
  feeRevenueToDateCents: number
  coverageRatio: number | null
  surplusCents: number
  shortfallCents: number
  recommendedJusticeContributionCents: number
  verdict: 'platform-investing' | 'cost-recovered' | 'surplus-to-justice'
  note: string
}

interface AiBudgetStatus {
  limitCents: number
  spentCents: number
  remainingCents: number
  usedRatio: number
  overBudget: boolean
  hasOwnKey: boolean
  ownKeyProvider: 'anthropic' | 'openrouter' | 'openai' | null
  limitSource: 'tenant' | 'default'
  enforcementEnabled: boolean
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
  // Ticks every 5s so the live "in play" recency updates without a full refetch.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])
  // Deep-link to the AI tab of this portal's Settings (same locale prefix).
  const pathname = usePathname()
  const settingsHref = `${pathname.replace(/\/ai-costs\/?$/, '')}/admin/settings?tab=ai`

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
    const interval = setInterval(() => fetchData(days), 30_000)
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
          <a
            href={settingsHref}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Provider keys, model & AI settings"
          >
            AI Settings →
          </a>
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

      {/* ── Providers in play (live status from per-call telemetry) ─ */}
      <LiveProvidersPanel byProvider={data.byProvider} byModel={data.byModel} now={now} />

      {/* ── AI Budget (the economic close) ─────────────────────── */}
      {data.budget && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              AI Budget · month to date
            </h2>
            <span className="text-xs text-muted-foreground">
              {fmtUsd(data.budget.spentCents)} of {fmtUsd(data.budget.limitCents)} used
              {' · '}
              {data.budget.limitSource === 'tenant' ? 'tenant budget' : 'free tier'}
            </span>
          </div>
          <div className="mb-2 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${data.budget.overBudget ? 'bg-red-500' : data.budget.usedRatio > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.max(1, data.budget.usedRatio * 100))}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className={data.budget.overBudget ? 'font-medium text-red-600' : 'text-emerald-600'}>
              {data.budget.overBudget
                ? 'Over budget'
                : `${fmtUsd(data.budget.remainingCents)} remaining`}
            </span>
            <span className="text-muted-foreground">
              BYOK key:{' '}
              {data.budget.hasOwnKey ? (
                <span className="text-foreground">{data.budget.ownKeyProvider} ✓</span>
              ) : (
                <span>none</span>
              )}
            </span>
            <span className="text-muted-foreground">
              Enforcement: {data.budget.enforcementEnabled ? 'on' : 'off (visibility only)'}
            </span>
          </div>
          {data.budget.overBudget && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {data.budget.hasOwnKey
                ? `Past the free budget, this tenant's own ${data.budget.ownKeyProvider} key serves AI at $0 to the platform${data.budget.enforcementEnabled ? '.' : ' (when enforcement is enabled).'}`
                : `Past the free budget, add a provider key under Settings → AI to keep serving at $0 to the platform, or AI routes to the free local tier${data.budget.enforcementEnabled ? '.' : ' (when enforcement is enabled).'}`}
            </p>
          )}
        </div>
      )}

      {/* ── Fee Reconciliation (non-extractive transparency) ───── */}
      {data.reconciliation && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Fee Reconciliation
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                data.reconciliation.verdict === 'surplus-to-justice'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                  : data.reconciliation.verdict === 'platform-investing'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {data.reconciliation.verdict === 'surplus-to-justice'
                ? 'Surplus → Justice Fund'
                : data.reconciliation.verdict === 'platform-investing'
                  ? 'Platform investing'
                  : 'Cost recovered'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Cost (last {data.reconciliation.windowDays}d)</div>
              <div className="text-xl font-bold">{fmtUsd(data.reconciliation.costCents)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                AI {fmtUsd(data.reconciliation.aiCostCents)} · other {fmtUsd(data.reconciliation.nonAiCostCents)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Platform fees to date</div>
              <div className="text-xl font-bold">{fmtUsd(data.reconciliation.feeRevenueToDateCents)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">bootstrap, refundable</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {data.reconciliation.shortfallCents > 0 ? 'Platform investment' : 'Surplus → Justice'}
              </div>
              <div className="text-xl font-bold">
                {fmtUsd(
                  data.reconciliation.shortfallCents > 0
                    ? data.reconciliation.shortfallCents
                    : data.reconciliation.surplusCents,
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                coverage{' '}
                {data.reconciliation.coverageRatio == null
                  ? '—'
                  : `${Math.round(data.reconciliation.coverageRatio * 100)}%`}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{data.reconciliation.note}</p>
        </div>
      )}

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

/**
 * Live "who's serving right now" — read straight from the per-call telemetry (each
 * response records its provider/model + timestamp). Providers/models used within
 * ACTIVE_MS pulse green; the recency ticks every 5s so it reads as real-time even
 * between the 30s data refetches. Sorted most-recent-first, so the model answering
 * this instant sits at the top.
 */
function LiveProvidersPanel({
  byProvider,
  byModel,
  now,
}: {
  byProvider: CostBucket[]
  byModel: CostBucket[]
  now: number
}) {
  const providers = [...byProvider].sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
  const models = [...byModel].sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')).slice(0, 8)
  const isActive = (iso?: string) => Boolean(iso && now - new Date(iso).getTime() < ACTIVE_MS)
  const activeCount = providers.filter((p) => isActive(p.lastAt)).length

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Providers in play</h2>
        <span className="text-xs text-muted-foreground">
          {providers.length === 0 ? 'idle' : `${activeCount} active now · live`}
        </span>
      </div>

      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No AI traffic in this window.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {providers.map((p) => {
              const active = isActive(p.lastAt)
              const color = PROVIDER_COLORS[p.key] || 'bg-gray-400'
              return (
                <span
                  key={p.key}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${active ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'}`}
                  title={`${p.responses} responses · ${fmtUsd(p.costCents)}`}
                >
                  <span className={`h-2 w-2 rounded-full ${color} ${active ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className="font-medium capitalize">{p.key}</span>
                  <span className="text-muted-foreground">{timeAgo(p.lastAt, now)}</span>
                </span>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
              Recent models
            </div>
            {models.map((m) => {
              const active = isActive(m.lastAt)
              const color = PROVIDER_COLORS[m.provider || 'unknown'] || 'bg-gray-400'
              return (
                <div key={m.key} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${color} ${active ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className="min-w-0 truncate font-medium" title={m.key}>{m.key}</span>
                  {m.provider && <span className="shrink-0 text-xs text-muted-foreground">{m.provider}</span>}
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {timeAgo(m.lastAt, now)} · {m.responses} · {fmtUsd(m.costCents)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
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
