/**
 * Unit tests for the cost-events ledger read aggregator (getCostLedgerSummary).
 */
import { describe, it, expect, vi } from 'vitest'
import { getCostLedgerSummary } from '@/utilities/costLedger'

type Doc = { category?: string; provider?: string; costCents?: number; billedToTenantKey?: boolean }

function mockPayload(docs: Doc[], pageSize = 500) {
  const find = vi.fn(async ({ page = 1, limit = pageSize }: { page?: number; limit?: number }) => {
    const start = (page - 1) * limit
    const slice = docs.slice(start, start + limit)
    return { docs: slice, totalDocs: docs.length, totalPages: Math.max(1, Math.ceil(docs.length / limit)), page }
  })
  return { find } as any
}

describe('getCostLedgerSummary', () => {
  it('returns available:false and empty when the table is missing (query throws)', async () => {
    const payload = { find: vi.fn(async () => { throw new Error('relation "cost_events" does not exist') }) } as any
    const s = await getCostLedgerSummary(payload, 1, { days: 30 })
    expect(s.available).toBe(false)
    expect(s.totals.events).toBe(0)
    expect(s.byCategory).toEqual([])
  })

  it('returns available:true with empty data when there are no events', async () => {
    const s = await getCostLedgerSummary(mockPayload([]), 1, { days: 30 })
    expect(s.available).toBe(true)
    expect(s.totals.events).toBe(0)
  })

  it('aggregates by category and splits BYOK vs platform cost', async () => {
    const docs: Doc[] = [
      { category: 'intelligence', provider: 'anthropic', costCents: 2 },
      { category: 'intelligence', provider: 'anthropic', costCents: 3, billedToTenantKey: true },
      { category: 'infra', provider: 'vercel', costCents: 10 },
      { category: 'telephony', provider: 'livekit', costCents: 1 },
    ]
    const s = await getCostLedgerSummary(mockPayload(docs), 1, { days: 30 })
    expect(s.totals.events).toBe(4)
    expect(s.totals.costCents).toBeCloseTo(16, 3)
    expect(s.totals.byokCostCents).toBeCloseTo(3, 3)
    expect(s.totals.platformCostCents).toBeCloseTo(13, 3)
    // costliest category first
    expect(s.byCategory[0].category).toBe('infra')
    const intel = s.byCategory.find((c) => c.category === 'intelligence')!
    expect(intel.events).toBe(2)
    expect(intel.byokCostCents).toBeCloseTo(3, 3)
    expect(intel.platformCostCents).toBeCloseTo(2, 3)
  })

  it('breaks down by provider within category, costliest first', async () => {
    const docs: Doc[] = [
      { category: 'intelligence', provider: 'anthropic', costCents: 5 },
      { category: 'intelligence', provider: 'google', costCents: 1 },
      { category: 'intelligence', provider: 'google', costCents: 1 },
    ]
    const s = await getCostLedgerSummary(mockPayload(docs), 1, { days: 30 })
    expect(s.byProvider[0].provider).toBe('anthropic')
    const google = s.byProvider.find((p) => p.provider === 'google')!
    expect(google.events).toBe(2)
    expect(google.costCents).toBeCloseTo(2, 3)
  })

  it('pages through multiple result pages', async () => {
    const docs: Doc[] = Array.from({ length: 1100 }, () => ({ category: 'infra', provider: 'vercel', costCents: 0.001 }))
    const payload = mockPayload(docs, 500)
    const s = await getCostLedgerSummary(payload, 1, { days: 30 })
    expect(s.totals.events).toBe(1100)
    expect(payload.find).toHaveBeenCalledTimes(3)
  })
})
