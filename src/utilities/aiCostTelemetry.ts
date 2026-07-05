/**
 * aiCostTelemetry — read-only AI cost/usage aggregation for the control panel.
 *
 * Reads the per-response telemetry ALREADY captured in `Messages.metadata`
 * (provider, model that actually served, tier, in/out/total tokens, costCents,
 * latencyMs, ttftMs, finishReason, toolCalls, failedOver). See aiUsage.ts for
 * the capture shape and pricing. ZERO schema change — this is pure aggregation.
 *
 * Honest by construction: empty results mean no AI traffic in the window, not
 * missing telemetry. costCents is a best-effort list-price estimate (local
 * models are $0); unpriced responses are counted separately so the panel can
 * be transparent about what the cost number does and does not cover.
 *
 * The dedicated `ai-usage` collection (#18) is the efficient successor for this;
 * until that table exists on every node, the Messages-metadata scan is the
 * source of truth and stays valid as a fallback.
 */
import type { Payload, Where } from 'payload'

// ── Shapes ────────────────────────────────────────────────────────────────────

interface ResponseMetadata {
  model?: string
  provider?: string
  tier?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costCents?: number
  costEstimated?: boolean
  latencyMs?: number
  ttftMs?: number
  finishReason?: string
  toolCallCount?: number
  failedOver?: boolean
  error?: boolean
  partial?: boolean
}

export interface CostBucket {
  /** Grouping key: ISO date (YYYY-MM-DD), model id, or provider name. */
  key: string
  /** Sub-label for display (e.g. the provider behind a model). */
  provider?: string
  responses: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  /** Sum of priced cost in cents (excludes unpriced responses). */
  costCents: number
  /** Responses with no list price (unknown/unpriced model). */
  unpriced: number
  /** Responses that served for $0 (local/free providers). */
  free: number
  /** ISO timestamp of the MOST RECENT response in this bucket — drives the live
   *  "currently employed" indicator (the scan is newest-first, so first-seen wins). */
  lastAt?: string
}

export interface AiCostSummary {
  /** Window in days the summary covers. */
  windowDays: number
  /** ISO timestamp of the start of the window. */
  since: string
  /** ISO timestamp the summary was generated. */
  generatedAt: string

  totals: {
    responses: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    /** Sum of priced cost in cents. */
    costCents: number
    /** Count of responses with no list price. */
    unpricedResponses: number
    /** Count of $0 (local/free) responses. */
    freeResponses: number
    /** Count of paid (cost > 0) responses. */
    paidResponses: number
    /** Count of responses that failed over to a fallback provider. */
    failoverResponses: number
  }

  /** Economics derived from the window. */
  economics: {
    /** Average cost per day in cents over the window. */
    burnRateCentsPerDay: number
    /** Projected 30-day spend in cents at the current burn rate. */
    projectedMonthlyCents: number
    /** Fraction of responses served free (local). 0..1. */
    freeRatio: number
    /** Fraction of responses that failed over. 0..1. */
    failoverRate: number
    /** Average cost per response in cents (priced responses only). */
    avgCostPerResponseCents: number
  }

  latency: {
    avgMs: number
    p50Ms: number
    p95Ms: number
    avgTtftMs: number
    samples: number
  }

  /** Daily breakdown, oldest first. */
  byDay: CostBucket[]
  /** By model, costliest first. */
  byModel: CostBucket[]
  /** By provider, costliest first. */
  byProvider: CostBucket[]

  /** True if the scan hit its hard cap (numbers are a floor, not exact). */
  sampled: boolean
  /** Number of messages scanned. */
  scanned: number
}

// ── Aggregation ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 500
/** Hard cap on messages scanned per request — keeps the scan bounded. */
const SCAN_CAP = 20_000

function emptyBucket(key: string, provider?: string): CostBucket {
  return {
    key,
    provider,
    responses: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costCents: 0,
    unpriced: 0,
    free: 0,
  }
}

function dayKey(iso: string): string {
  // YYYY-MM-DD in UTC — stable, sortable, and matches createdAt storage.
  return iso.slice(0, 10)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

/**
 * Aggregate AI cost/usage telemetry for a tenant over the last N days.
 * Fail-soft: any query error yields an empty-but-valid summary.
 */
export async function getAiCostSummary(
  payload: Payload,
  tenantId: number | string,
  opts: { days?: number } = {},
): Promise<AiCostSummary> {
  const windowDays = Math.max(1, Math.min(90, Math.round(opts.days ?? 30)))
  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const since = new Date(sinceMs).toISOString()
  const generatedAt = new Date().toISOString()

  const base: AiCostSummary = {
    windowDays,
    since,
    generatedAt,
    totals: {
      responses: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costCents: 0,
      unpricedResponses: 0,
      freeResponses: 0,
      paidResponses: 0,
      failoverResponses: 0,
    },
    economics: {
      burnRateCentsPerDay: 0,
      projectedMonthlyCents: 0,
      freeRatio: 0,
      failoverRate: 0,
      avgCostPerResponseCents: 0,
    },
    latency: { avgMs: 0, p50Ms: 0, p95Ms: 0, avgTtftMs: 0, samples: 0 },
    byDay: [],
    byModel: [],
    byProvider: [],
    sampled: false,
    scanned: 0,
  }

  const where: Where = {
    tenant: { equals: tenantId },
    messageType: { equals: 'ai_agent' },
    createdAt: { greater_than: since },
  }

  const byDay = new Map<string, CostBucket>()
  const byModel = new Map<string, CostBucket>()
  const byProvider = new Map<string, CostBucket>()
  const latencies: number[] = []
  const ttfts: number[] = []
  let scanned = 0
  let sampled = false

  try {
    let page = 1
    // Page through ai_agent messages, pulling only what we aggregate.
    // [payload skill: QUERIES.md — select to limit fields, depth 0]
    for (;;) {
      const res = await payload.find({
        collection: 'messages' as any,
        where,
        sort: '-createdAt',
        limit: PAGE_SIZE,
        page,
        depth: 0,
        select: { metadata: true, createdAt: true } as any,
        overrideAccess: true,
      })

      const docs = res.docs as Array<{ metadata?: ResponseMetadata; createdAt?: string }>
      for (const d of docs) {
        const m = d.metadata
        // Only count responses that actually carry telemetry (a served model).
        if (!m || !m.model) continue
        scanned++

        const provider = m.provider || 'unknown'
        const model = m.model
        const inTok = m.inputTokens ?? 0
        const outTok = m.outputTokens ?? 0
        const totTok = m.totalTokens ?? inTok + outTok
        const cost = typeof m.costCents === 'number' ? m.costCents : undefined
        const isUnpriced = cost === undefined
        const isFree = cost === 0
        const dKey = dayKey(d.createdAt || since)

        // Totals
        base.totals.responses++
        base.totals.inputTokens += inTok
        base.totals.outputTokens += outTok
        base.totals.totalTokens += totTok
        if (cost !== undefined) base.totals.costCents += cost
        if (isUnpriced) base.totals.unpricedResponses++
        else if (isFree) base.totals.freeResponses++
        else base.totals.paidResponses++
        if (m.failedOver) base.totals.failoverResponses++

        // Latency samples
        if (typeof m.latencyMs === 'number' && m.latencyMs > 0) latencies.push(m.latencyMs)
        if (typeof m.ttftMs === 'number' && m.ttftMs > 0) ttfts.push(m.ttftMs)

        // Buckets
        for (const [map, key, prov] of [
          [byDay, dKey, undefined],
          [byModel, model, provider],
          [byProvider, provider, undefined],
        ] as Array<[Map<string, CostBucket>, string, string | undefined]>) {
          let b = map.get(key)
          if (!b) {
            b = emptyBucket(key, prov)
            map.set(key, b)
          }
          b.responses++
          b.inputTokens += inTok
          b.outputTokens += outTok
          b.totalTokens += totTok
          if (cost !== undefined) b.costCents += cost
          if (isUnpriced) b.unpriced++
          if (isFree) b.free++
          // Newest-first scan → the first row we see for a bucket is its latest use.
          if (!b.lastAt && d.createdAt) b.lastAt = d.createdAt
        }
      }

      if (scanned >= SCAN_CAP) {
        sampled = true
        break
      }
      if (page >= res.totalPages || docs.length === 0) break
      page++
    }
  } catch {
    // Fail-soft — return whatever we accumulated (often empty).
    return base
  }

  // Round accumulated cents to 3-decimal precision (matches computeCostCents).
  const round3 = (n: number) => Math.round(n * 1000) / 1000
  base.totals.costCents = round3(base.totals.costCents)
  for (const map of [byDay, byModel, byProvider]) {
    for (const b of map.values()) b.costCents = round3(b.costCents)
  }

  // Economics
  const burn = base.totals.costCents / windowDays
  base.economics.burnRateCentsPerDay = round3(burn)
  base.economics.projectedMonthlyCents = round3(burn * 30)
  base.economics.freeRatio =
    base.totals.responses > 0 ? base.totals.freeResponses / base.totals.responses : 0
  base.economics.failoverRate =
    base.totals.responses > 0 ? base.totals.failoverResponses / base.totals.responses : 0
  base.economics.avgCostPerResponseCents =
    base.totals.paidResponses > 0
      ? round3(base.totals.costCents / base.totals.paidResponses)
      : 0

  // Latency
  latencies.sort((a, b) => a - b)
  base.latency = {
    avgMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
    p50Ms: Math.round(percentile(latencies, 50)),
    p95Ms: Math.round(percentile(latencies, 95)),
    avgTtftMs:
      ttfts.length > 0 ? Math.round(ttfts.reduce((a, b) => a + b, 0) / ttfts.length) : 0,
    samples: latencies.length,
  }

  // Sorted breakdowns
  base.byDay = [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)) // oldest → newest
  base.byModel = [...byModel.values()].sort((a, b) => b.costCents - a.costCents || b.responses - a.responses)
  base.byProvider = [...byProvider.values()].sort((a, b) => b.costCents - a.costCents || b.responses - a.responses)

  base.sampled = sampled
  base.scanned = scanned
  return base
}
