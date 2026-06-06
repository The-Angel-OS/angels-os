/**
 * Unit tests for the AI cost/usage aggregator (getAiCostSummary).
 *
 * Uses a mocked payload.find that pages over fixture messages, mirroring how the
 * aggregator scans Messages.metadata. Verifies totals, free/paid/unpriced split,
 * burn rate + projection, latency p95, and the day/model/provider breakdowns.
 */
import { describe, it, expect, vi } from 'vitest'
import { getAiCostSummary } from '@/utilities/aiCostTelemetry'

type Doc = { metadata?: Record<string, unknown>; createdAt?: string }

/**
 * Build a mocked Payload whose find() pages over the given docs and honors the
 * messageType/model filtering the aggregator relies on (it filters in JS too).
 */
function mockPayload(docs: Doc[], pageSize = 500) {
  const find = vi.fn(async ({ page = 1, limit = pageSize }: { page?: number; limit?: number }) => {
    const start = (page - 1) * limit
    const slice = docs.slice(start, start + limit)
    return {
      docs: slice,
      totalDocs: docs.length,
      totalPages: Math.max(1, Math.ceil(docs.length / limit)),
      page,
    }
  })
  return { find } as any
}

const now = Date.now()
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()

describe('getAiCostSummary', () => {
  it('returns an empty-but-valid summary when there is no traffic', async () => {
    const s = await getAiCostSummary(mockPayload([]), 1, { days: 30 })
    expect(s.totals.responses).toBe(0)
    expect(s.totals.costCents).toBe(0)
    expect(s.byDay).toEqual([])
    expect(s.byModel).toEqual([])
    expect(s.economics.projectedMonthlyCents).toBe(0)
    expect(s.latency.samples).toBe(0)
  })

  it('skips messages without telemetry (no model)', async () => {
    const docs: Doc[] = [
      { metadata: { streaming: false }, createdAt: daysAgo(1) }, // no model → skipped
      { metadata: {}, createdAt: daysAgo(1) }, // empty → skipped
      {
        metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', inputTokens: 1000, outputTokens: 1000, totalTokens: 2000, costCents: 1.8 },
        createdAt: daysAgo(1),
      },
    ]
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 30 })
    expect(s.totals.responses).toBe(1)
    expect(s.scanned).toBe(1)
  })

  it('aggregates totals, free/paid/unpriced split, and cost', async () => {
    const docs: Doc[] = [
      // paid sonnet
      { metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', inputTokens: 1000, outputTokens: 500, totalTokens: 1500, costCents: 1.05 }, createdAt: daysAgo(1) },
      // free local
      { metadata: { model: 'ollama/qwen2.5:7b', provider: 'ollama', inputTokens: 2000, outputTokens: 300, totalTokens: 2300, costCents: 0 }, createdAt: daysAgo(1) },
      // unpriced (unknown model, costCents undefined)
      { metadata: { model: 'unknown/mystery', provider: 'unknown', inputTokens: 100, outputTokens: 100, totalTokens: 200 }, createdAt: daysAgo(2) },
    ]
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 30 })
    expect(s.totals.responses).toBe(3)
    expect(s.totals.paidResponses).toBe(1)
    expect(s.totals.freeResponses).toBe(1)
    expect(s.totals.unpricedResponses).toBe(1)
    expect(s.totals.costCents).toBeCloseTo(1.05, 3)
    expect(s.totals.totalTokens).toBe(1500 + 2300 + 200)
    expect(s.economics.avgCostPerResponseCents).toBeCloseTo(1.05, 3) // only 1 paid
  })

  it('computes burn rate and 30-day projection from the window', async () => {
    // 10 cents total over a 10-day window → 1 cent/day → 30 cent projection
    const docs: Doc[] = Array.from({ length: 10 }, (_, i) => ({
      metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', inputTokens: 100, outputTokens: 100, totalTokens: 200, costCents: 1 },
      createdAt: daysAgo(i),
    }))
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 10 })
    expect(s.totals.costCents).toBeCloseTo(10, 3)
    expect(s.economics.burnRateCentsPerDay).toBeCloseTo(1, 3)
    expect(s.economics.projectedMonthlyCents).toBeCloseTo(30, 3)
  })

  it('computes free ratio and failover rate', async () => {
    const docs: Doc[] = [
      { metadata: { model: 'ollama/x', provider: 'ollama', costCents: 0 }, createdAt: daysAgo(1) },
      { metadata: { model: 'ollama/x', provider: 'ollama', costCents: 0 }, createdAt: daysAgo(1) },
      { metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', costCents: 2, failedOver: true }, createdAt: daysAgo(1) },
      { metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', costCents: 2 }, createdAt: daysAgo(1) },
    ]
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 30 })
    expect(s.economics.freeRatio).toBeCloseTo(0.5, 5) // 2 of 4 free
    expect(s.economics.failoverRate).toBeCloseTo(0.25, 5) // 1 of 4
    expect(s.totals.failoverResponses).toBe(1)
  })

  it('computes latency p95 from samples', async () => {
    const docs: Doc[] = Array.from({ length: 100 }, (_, i) => ({
      metadata: { model: 'm/x', provider: 'gateway', costCents: 0, latencyMs: i + 1, ttftMs: 10 },
      createdAt: daysAgo(1),
    }))
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 30 })
    // sorted 1..100; p95 index = floor(0.95*100)=95 → value 96
    expect(s.latency.p95Ms).toBe(96)
    expect(s.latency.p50Ms).toBe(51)
    expect(s.latency.avgTtftMs).toBe(10)
    expect(s.latency.samples).toBe(100)
  })

  it('breaks down by model and provider, costliest first', async () => {
    const docs: Doc[] = [
      { metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', costCents: 5, totalTokens: 100 }, createdAt: daysAgo(1) },
      { metadata: { model: 'google/gemini-2.5-flash', provider: 'google', costCents: 1, totalTokens: 100 }, createdAt: daysAgo(1) },
      { metadata: { model: 'google/gemini-2.5-flash', provider: 'google', costCents: 1, totalTokens: 100 }, createdAt: daysAgo(1) },
      { metadata: { model: 'ollama/qwen', provider: 'ollama', costCents: 0, totalTokens: 100 }, createdAt: daysAgo(1) },
    ]
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 30 })
    expect(s.byModel[0].key).toBe('anthropic/claude-sonnet-4-6') // costliest
    expect(s.byModel[0].provider).toBe('anthropic')
    const gemini = s.byModel.find((b) => b.key === 'google/gemini-2.5-flash')!
    expect(gemini.responses).toBe(2)
    expect(gemini.costCents).toBeCloseTo(2, 3)
    const ollama = s.byProvider.find((b) => b.key === 'ollama')!
    expect(ollama.free).toBe(1)
  })

  it('groups by UTC day, oldest first', async () => {
    const docs: Doc[] = [
      { metadata: { model: 'm/x', provider: 'gateway', costCents: 1 }, createdAt: '2026-06-03T10:00:00.000Z' },
      { metadata: { model: 'm/x', provider: 'gateway', costCents: 1 }, createdAt: '2026-06-03T22:00:00.000Z' },
      { metadata: { model: 'm/x', provider: 'gateway', costCents: 1 }, createdAt: '2026-06-05T01:00:00.000Z' },
    ]
    const s = await getAiCostSummary(mockPayload(docs), 1, { days: 90 })
    expect(s.byDay.map((d) => d.key)).toEqual(['2026-06-03', '2026-06-05'])
    expect(s.byDay[0].responses).toBe(2)
  })

  it('pages through multiple result pages', async () => {
    const docs: Doc[] = Array.from({ length: 1200 }, () => ({
      metadata: { model: 'm/x', provider: 'gateway', costCents: 0.001, totalTokens: 10 },
      createdAt: daysAgo(1),
    }))
    const payload = mockPayload(docs, 500)
    const s = await getAiCostSummary(payload, 1, { days: 30 })
    expect(s.totals.responses).toBe(1200)
    expect(payload.find).toHaveBeenCalledTimes(3) // 500 + 500 + 200
  })

  it('clamps the window to 1..90 days', async () => {
    const a = await getAiCostSummary(mockPayload([]), 1, { days: 0 })
    expect(a.windowDays).toBe(1)
    const b = await getAiCostSummary(mockPayload([]), 1, { days: 999 })
    expect(b.windowDays).toBe(90)
  })

  it('fails soft when the query throws', async () => {
    const payload = { find: vi.fn(async () => { throw new Error('db down') }) } as any
    const s = await getAiCostSummary(payload, 1, { days: 30 })
    expect(s.totals.responses).toBe(0)
    expect(s.byDay).toEqual([])
  })
})
