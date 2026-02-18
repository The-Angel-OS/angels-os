/**
 * Unit tests for Ultimate Fair Payment Splitting — the Angel OS economic model.
 *
 * Tests the pure `calculateSplit()` logic: 60/20/15/5 default split,
 * custom overrides, zero-decimal currencies, rounding, validation,
 * and the transparency report / split breakdown helpers.
 *
 * Stripe interactions are tested separately (integration tests).
 *
 * @see src/utilities/ultimateFairSplit.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Stripe to prevent import-time initialization
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
    transfers: { create: vi.fn() },
  })),
}))

import { UltimateFairSplitter } from '@/utilities/ultimateFairSplit'
import type { PaymentSplit } from '@/utilities/ultimateFairSplit'

describe('UltimateFairSplitter', () => {
  let splitter: UltimateFairSplitter

  beforeEach(() => {
    splitter = new UltimateFairSplitter('sk_test_fake_key')
  })

  describe('calculateSplit — default 60/20/15/5', () => {
    it('splits $100 correctly', () => {
      const split = splitter.calculateSplit(100)
      expect(split.providerAmount).toBe(60)
      expect(split.platformAmount).toBe(20)
      expect(split.operationsAmount).toBe(15)
      expect(split.justiceAmount).toBe(5)
    })

    it('totalAmount echoes the input', () => {
      const split = splitter.calculateSplit(250)
      expect(split.totalAmount).toBe(250)
    })

    it('defaults currency to usd', () => {
      const split = splitter.calculateSplit(100)
      expect(split.currency).toBe('usd')
    })

    it('stripeApplicationFee = platform + operations + justice', () => {
      const split = splitter.calculateSplit(100)
      expect(split.stripeApplicationFee).toBe(
        split.platformAmount + split.operationsAmount + split.justiceAmount,
      )
    })

    it('netToProvider equals providerAmount', () => {
      const split = splitter.calculateSplit(100)
      expect(split.netToProvider).toBe(split.providerAmount)
    })

    it('all shares sum to totalAmount', () => {
      const split = splitter.calculateSplit(100)
      const sum =
        split.providerAmount +
        split.platformAmount +
        split.operationsAmount +
        split.justiceAmount
      expect(sum).toBe(100)
    })
  })

  describe('calculateSplit — various amounts', () => {
    it('handles small amount ($1)', () => {
      const split = splitter.calculateSplit(1)
      expect(split.providerAmount).toBeCloseTo(0.6, 1)
      expect(split.justiceAmount).toBeCloseTo(0.05, 1)
    })

    it('handles large amount ($10,000)', () => {
      const split = splitter.calculateSplit(10000)
      expect(split.providerAmount).toBe(6000)
      expect(split.platformAmount).toBe(2000)
      expect(split.operationsAmount).toBe(1500)
      expect(split.justiceAmount).toBe(500)
    })

    it('handles fractional amount ($33.33)', () => {
      const split = splitter.calculateSplit(33.33)
      // Rounding to cents (via Math.round on cents)
      const sum =
        split.providerAmount +
        split.platformAmount +
        split.operationsAmount +
        split.justiceAmount
      // With rounding, sum should be very close to total
      expect(Math.abs(sum - 33.33)).toBeLessThan(0.05)
    })

    it('handles zero amount', () => {
      const split = splitter.calculateSplit(0)
      expect(split.providerAmount).toBe(0)
      expect(split.platformAmount).toBe(0)
      expect(split.operationsAmount).toBe(0)
      expect(split.justiceAmount).toBe(0)
    })
  })

  describe('calculateSplit — zero-decimal currencies', () => {
    it('handles JPY (no cents multiplier)', () => {
      const split = splitter.calculateSplit(1000, 'jpy')
      expect(split.providerAmount).toBe(600)
      expect(split.platformAmount).toBe(200)
      expect(split.operationsAmount).toBe(150)
      expect(split.justiceAmount).toBe(50)
    })

    it('handles KRW (no cents multiplier)', () => {
      const split = splitter.calculateSplit(50000, 'krw')
      expect(split.providerAmount).toBe(30000)
      expect(split.justiceAmount).toBe(2500)
    })

    it('JPY is case-insensitive', () => {
      const split = splitter.calculateSplit(1000, 'JPY')
      expect(split.providerAmount).toBe(600)
    })

    it('EUR uses cent multiplier (like USD)', () => {
      const split = splitter.calculateSplit(100, 'eur')
      expect(split.providerAmount).toBe(60)
    })
  })

  describe('calculateSplit — custom config override', () => {
    it('accepts custom percentages at call site', () => {
      const split = splitter.calculateSplit(100, 'usd', {
        providerShare: 70,
        platformShare: 15,
        operationsShare: 10,
        justiceShare: 5,
      })
      expect(split.providerAmount).toBe(70)
      expect(split.platformAmount).toBe(15)
      expect(split.operationsAmount).toBe(10)
      expect(split.justiceAmount).toBe(5)
    })

    it('partial override merges with defaults', () => {
      const split = splitter.calculateSplit(100, 'usd', {
        providerShare: 50,
        justiceShare: 15,
      })
      // 50 + 20 + 15 + 15 = 100
      expect(split.providerAmount).toBe(50)
      expect(split.platformAmount).toBe(20)
      expect(split.operationsAmount).toBe(15)
      expect(split.justiceAmount).toBe(15)
    })
  })

  describe('calculateSplit — validation', () => {
    it('throws when percentages do not sum to 100', () => {
      expect(() =>
        splitter.calculateSplit(100, 'usd', {
          providerShare: 50,
          platformShare: 10,
          operationsShare: 10,
          justiceShare: 10,
        }),
      ).toThrow('must sum to 100%')
    })

    it('throws with descriptive message showing the actual total', () => {
      expect(() =>
        splitter.calculateSplit(100, 'usd', {
          providerShare: 50,
          platformShare: 50,
          operationsShare: 50,
          justiceShare: 50,
        }),
      ).toThrow('200%')
    })
  })

  describe('constructor with custom defaults', () => {
    it('uses custom default config', () => {
      const custom = new UltimateFairSplitter('sk_test_fake', {
        providerShare: 70,
        platformShare: 15,
        operationsShare: 10,
        justiceShare: 5,
      })
      const split = custom.calculateSplit(100)
      expect(split.providerAmount).toBe(70)
      expect(split.platformAmount).toBe(15)
    })
  })

  describe('getSplitBreakdown', () => {
    it('returns human-readable breakdown', () => {
      const split = splitter.calculateSplit(100)
      const breakdown = splitter.getSplitBreakdown(split)

      expect(breakdown.provider.amount).toBe(60)
      expect(breakdown.provider.percentage).toBe(60)
      expect(breakdown.provider.description).toContain('provider')

      expect(breakdown.platform.amount).toBe(20)
      expect(breakdown.platform.percentage).toBe(20)

      expect(breakdown.operations.amount).toBe(15)
      expect(breakdown.operations.percentage).toBe(15)

      expect(breakdown.justice.amount).toBe(5)
      expect(breakdown.justice.percentage).toBe(5)
      expect(breakdown.justice.description).toContain('Justice')
    })
  })

  describe('generateTransparencyReport', () => {
    it('aggregates multiple splits', () => {
      const splits: PaymentSplit[] = [
        splitter.calculateSplit(100),
        splitter.calculateSplit(200),
      ]
      const report = splitter.generateTransparencyReport(splits)

      expect(report.totalProcessed).toBe(300)
      expect(report.providersEarned).toBe(180) // 60 + 120
      expect(report.platformInvestment).toBe(60) // 20 + 40
      expect(report.operationsSupport).toBe(45) // 15 + 30
      expect(report.justiceImpact).toBe(15) // 5 + 10
    })

    it('reports ecosystem health as Thriving for default splits', () => {
      const splits = [splitter.calculateSplit(100)]
      const report = splitter.generateTransparencyReport(splits)
      expect(report.ecosystemHealth).toBe('Thriving')
    })

    it('reports Abundant when provider share is > 65%', () => {
      const custom = new UltimateFairSplitter('sk_test_fake', {
        providerShare: 70,
        platformShare: 15,
        operationsShare: 10,
        justiceShare: 5,
      })
      const splits = [custom.calculateSplit(100)]
      const report = custom.generateTransparencyReport(splits)
      expect(report.ecosystemHealth).toBe('Abundant')
    })

    it('handles empty splits array', () => {
      const report = splitter.generateTransparencyReport([])
      expect(report.totalProcessed).toBe(0)
    })
  })
})
