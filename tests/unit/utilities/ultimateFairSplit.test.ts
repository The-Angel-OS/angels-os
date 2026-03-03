/**
 * UltimateFairSplitter — Unit Tests (pure methods only)
 *
 * Tests calculateSplit, getSplitBreakdown, and generateTransparencyReport.
 * All three methods are pure (no Stripe API calls). The constructor accepts
 * any string as stripeSecretKey without making network calls.
 */
import { describe, it, expect } from 'vitest'
import { UltimateFairSplitter } from '@/utilities/ultimateFairSplit'

// Fake key — constructor stores it but does not call Stripe
const splitter = new UltimateFairSplitter('sk_test_fake')

// ── calculateSplit ────────────────────────────────────────────────────────────

describe('UltimateFairSplitter.calculateSplit', () => {
  it('uses the 70/20/4/1/5 default split', () => {
    const result = splitter.calculateSplit(100, 'usd')
    expect(result.providerAmount).toBe(70)
    expect(result.platformAmount).toBe(20)
    expect(result.operationsAmount).toBe(4)
    expect(result.infrastructureAmount).toBe(1)
    expect(result.justiceAmount).toBe(5)
  })

  it('sets totalAmount to the input amount', () => {
    const result = splitter.calculateSplit(200, 'usd')
    expect(result.totalAmount).toBe(200)
  })

  it('sets currency on the result', () => {
    const result = splitter.calculateSplit(100, 'eur')
    expect(result.currency).toBe('eur')
  })

  it('stripeApplicationFee equals platform + operations + infrastructure + justice', () => {
    const result = splitter.calculateSplit(100, 'usd')
    const expected =
      result.platformAmount +
      result.operationsAmount +
      result.infrastructureAmount +
      result.justiceAmount
    expect(result.stripeApplicationFee).toBe(expected)
  })

  it('netToProvider equals providerAmount', () => {
    const result = splitter.calculateSplit(100, 'usd')
    expect(result.netToProvider).toBe(result.providerAmount)
  })

  it('applies a custom split config', () => {
    const result = splitter.calculateSplit(100, 'usd', {
      providerShare: 80,
      platformShare: 10,
      operationsShare: 4,
      infrastructureShare: 1,
      justiceShare: 5,
    })
    expect(result.providerAmount).toBe(80)
    expect(result.platformAmount).toBe(10)
  })

  it('throws when percentages do not sum to 100', () => {
    expect(() =>
      splitter.calculateSplit(100, 'usd', {
        providerShare: 50,
        platformShare: 20,
        operationsShare: 4,
        infrastructureShare: 1,
        justiceShare: 5,
      }),
    ).toThrow(/sum to 100/i)
  })

  it('handles zero-decimal currencies (JPY) without multiplying by 100', () => {
    const result = splitter.calculateSplit(1000, 'jpy')
    // JPY multiplier = 1, so provider = 1000 * 70/100 = 700
    expect(result.providerAmount).toBe(700)
    expect(result.platformAmount).toBe(200)
  })

  it('correctly splits a non-round amount within 5 cents rounding tolerance', () => {
    const result = splitter.calculateSplit(33, 'usd')
    const sum =
      result.providerAmount +
      result.platformAmount +
      result.operationsAmount +
      result.infrastructureAmount +
      result.justiceAmount
    expect(Math.abs(sum - 33)).toBeLessThanOrEqual(0.05)
  })

  it('defaults currency to usd when not provided', () => {
    const result = splitter.calculateSplit(100)
    expect(result.currency).toBe('usd')
  })
})

// ── getSplitBreakdown ─────────────────────────────────────────────────────────

describe('UltimateFairSplitter.getSplitBreakdown', () => {
  const splits = splitter.calculateSplit(100, 'usd')

  it('returns the correct percentage for each stakeholder', () => {
    const breakdown = splitter.getSplitBreakdown(splits)
    expect(breakdown.provider.percentage).toBe(70)
    expect(breakdown.platform.percentage).toBe(20)
    expect(breakdown.operations.percentage).toBe(4)
    expect(breakdown.infrastructure.percentage).toBe(1)
    expect(breakdown.justice.percentage).toBe(5)
  })

  it('includes description strings for each stakeholder', () => {
    const breakdown = splitter.getSplitBreakdown(splits)
    expect(breakdown.provider.description).toBeTruthy()
    expect(breakdown.justice.description).toMatch(/justice fund/i)
  })

  it('amounts match the splits object', () => {
    const breakdown = splitter.getSplitBreakdown(splits)
    expect(breakdown.provider.amount).toBe(splits.providerAmount)
    expect(breakdown.platform.amount).toBe(splits.platformAmount)
  })
})

// ── generateTransparencyReport ────────────────────────────────────────────────

describe('UltimateFairSplitter.generateTransparencyReport', () => {
  it('sums amounts correctly across multiple splits', () => {
    const s1 = splitter.calculateSplit(100, 'usd')
    const s2 = splitter.calculateSplit(200, 'usd')
    const report = splitter.generateTransparencyReport([s1, s2])
    expect(report.totalProcessed).toBeCloseTo(300, 1)
    expect(report.providersEarned).toBeCloseTo(210, 1)
  })

  it('returns "Abundant" when provider share is > 65%', () => {
    const s = splitter.calculateSplit(100, 'usd') // 70% to provider
    const report = splitter.generateTransparencyReport([s])
    expect(report.ecosystemHealth).toBe('Abundant')
  })

  it('returns "Thriving" when provider share is between 55 and 65%', () => {
    const midSplitter = new UltimateFairSplitter('sk_test_fake', {
      providerShare: 60,
      platformShare: 20,
      operationsShare: 10,
      infrastructureShare: 5,
      justiceShare: 5,
    })
    const s = midSplitter.calculateSplit(100, 'usd')
    const report = midSplitter.generateTransparencyReport([s])
    expect(report.ecosystemHealth).toBe('Thriving')
  })

  it('returns "Needs Attention" when provider share is < 50%', () => {
    const stressedSplitter = new UltimateFairSplitter('sk_test_fake', {
      providerShare: 40,
      platformShare: 30,
      operationsShare: 15,
      infrastructureShare: 5,
      justiceShare: 10,
    })
    const s = stressedSplitter.calculateSplit(100, 'usd')
    const report = stressedSplitter.generateTransparencyReport([s])
    expect(report.ecosystemHealth).toBe('Needs Attention')
  })

  it('returns justiceImpact > 0', () => {
    const s = splitter.calculateSplit(100, 'usd')
    const report = splitter.generateTransparencyReport([s])
    expect(report.justiceImpact).toBeGreaterThan(0)
  })

  it('handles an empty splits array without throwing', () => {
    expect(() => splitter.generateTransparencyReport([])).not.toThrow()
    const report = splitter.generateTransparencyReport([])
    expect(report.totalProcessed).toBe(0)
  })
})
