/**
 * Unit tests for fee reconciliation (computeFeeReconciliation + ledger helper).
 */
import { describe, it, expect } from 'vitest'
import { computeFeeReconciliation, nonAiPlatformCostFromLedger } from '@/utilities/feeReconciliation'

describe('computeFeeReconciliation', () => {
  it('platform-investing when cost exceeds fee revenue', () => {
    const r = computeFeeReconciliation({ windowDays: 30, aiCostCents: 800, nonAiCostCents: 200, feeRevenueToDateCents: 300 })
    expect(r.costCents).toBe(1000)
    expect(r.shortfallCents).toBe(700)
    expect(r.surplusCents).toBe(0)
    expect(r.coverageRatio).toBeCloseTo(0.3, 3)
    expect(r.verdict).toBe('platform-investing')
    expect(r.recommendedJusticeContributionCents).toBe(0)
  })

  it('surplus-to-justice when fee revenue exceeds cost', () => {
    const r = computeFeeReconciliation({ windowDays: 30, aiCostCents: 100, nonAiCostCents: 100, feeRevenueToDateCents: 500 })
    expect(r.costCents).toBe(200)
    expect(r.surplusCents).toBe(300)
    expect(r.shortfallCents).toBe(0)
    expect(r.verdict).toBe('surplus-to-justice')
    expect(r.recommendedJusticeContributionCents).toBe(300)
  })

  it('cost-recovered when equal', () => {
    const r = computeFeeReconciliation({ windowDays: 30, aiCostCents: 250, nonAiCostCents: 250, feeRevenueToDateCents: 500 })
    expect(r.verdict).toBe('cost-recovered')
    expect(r.surplusCents).toBe(0)
    expect(r.shortfallCents).toBe(0)
    expect(r.coverageRatio).toBeCloseTo(1, 3)
  })

  it('coverageRatio is null when there is no cost', () => {
    const r = computeFeeReconciliation({ windowDays: 30, aiCostCents: 0, nonAiCostCents: 0, feeRevenueToDateCents: 100 })
    expect(r.coverageRatio).toBeNull()
    expect(r.verdict).toBe('surplus-to-justice')
    expect(r.surplusCents).toBe(100)
  })

  it('clamps negative inputs to zero', () => {
    const r = computeFeeReconciliation({ windowDays: 30, aiCostCents: -5, nonAiCostCents: -5, feeRevenueToDateCents: -5 })
    expect(r.costCents).toBe(0)
    expect(r.feeRevenueToDateCents).toBe(0)
    expect(r.verdict).toBe('cost-recovered')
  })
})

describe('nonAiPlatformCostFromLedger', () => {
  it('sums non-intelligence platform cost only', () => {
    const ledger = {
      available: true,
      byCategory: [
        { category: 'intelligence', platformCostCents: 50 },
        { category: 'infra', platformCostCents: 10 },
        { category: 'storage', platformCostCents: 2 },
        { category: 'telephony', platformCostCents: 3 },
      ],
    }
    expect(nonAiPlatformCostFromLedger(ledger as any)).toBe(15) // 10+2+3, AI excluded
  })

  it('returns 0 when ledger unavailable or empty', () => {
    expect(nonAiPlatformCostFromLedger(null)).toBe(0)
    expect(nonAiPlatformCostFromLedger({ available: false } as any)).toBe(0)
    expect(nonAiPlatformCostFromLedger({ available: true, byCategory: [] } as any)).toBe(0)
  })
})
