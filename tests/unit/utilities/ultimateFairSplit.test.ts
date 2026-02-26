/**
 * Unit tests for Ultimate Fair Payment Splitting — the Angel OS economic model.
 *
 * Tests the pure `calculateSplit()` logic: 70/20/4/1/5 default split
 * (Endeavor owner / Enterprise operator / Angel OS protocol / Flagship / Justice Fund),
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

  describe('calculateSplit — default 70/20/4/1/5', () => {
    it('splits $100 correctly', () => {
      const split = splitter.calculateSplit(100)
      expect(split.providerAmount).toBe(70)
      expect(split.platformAmount).toBe(20)
      expect(split.operationsAmount).toBe(4)
      expect(split.infrastructureAmount).toBe(1)
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

    it('stripeApplicationFee = platform + operations + infrastructure + justice', () => {
      const split = splitter.calculateSplit(100)
      expect(split.stripeApplicationFee).toBe(
        split.platformAmount + split.operationsAmount + split.infrastructureAmount + split.justiceAmount,
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
        split.infrastructureAmount +
        split.justiceAmount
      expect(sum).toBe(100)
    })
  })

  describe('calculateSplit — various amounts', () => {
    it('handles small amount ($1)', () => {
      const split = splitter.calculateSplit(1)
      expect(split.providerAmount).toBeCloseTo(0.7, 1)
      expect(split.justiceAmount).toBeCloseTo(0.05, 1)
    })

    it('handles large amount ($10,000)', () => {
      const split = splitter.calculateSplit(10000)
      expect(split.providerAmount).toBe(7000)
      expect(split.platformAmount).toBe(2000)
      expect(split.operationsAmount).toBe(400)
      expect(split.infrastructureAmount).toBe(100)
      expect(split.justiceAmount).toBe(500)
    })

    it('handles fractional amount ($33.33)', () => {
      const split = splitter.calculateSplit(33.33)
      // With rounding, sum should be very close to total
      const sum =
        split.providerAmount +
        split.platformAmount +
        split.operationsAmount +
        split.infrastructureAmount +
        split.justiceAmount
      expect(Math.abs(sum - 33.33)).toBeLessThan(0.05)
    })

    it('handles zero amount', () => {
      const split = splitter.calculateSplit(0)
      expect(split.providerAmount).toBe(0)
      expect(split.platformAmount).toBe(0)
      expect(split.operationsAmount).toBe(0)
      expect(split.infrastructureAmount).toBe(0)
      expect(split.justiceAmount).toBe(0)
    })
  })

  describe('calculateSplit — zero-decimal currencies', () => {
    it('handles JPY (no cents multiplier)', () => {
      const split = splitter.calculateSplit(1000, 'jpy')
      expect(split.providerAmount).toBe(700)
      expect(split.platformAmount).toBe(200)
      expect(split.operationsAmount).toBe(40)
      expect(split.infrastructureAmount).toBe(10)
      expect(split.justiceAmount).toBe(50)
    })

    it('handles KRW (no cents multiplier)', () => {
      const split = splitter.calculateSplit(50000, 'krw')
      expect(split.providerAmount).toBe(35000)
      expect(split.justiceAmount).toBe(2500)
    })

    it('JPY is case-insensitive', () => {
      const split = splitter.calculateSplit(1000, 'JPY')
      expect(split.providerAmount).toBe(700)
    })

    it('EUR uses cent multiplier (like USD)', () => {
      const split = splitter.calculateSplit(100, 'eur')
      expect(split.providerAmount).toBe(70)
    })
  })

  describe('calculateSplit — custom config override', () => {
    it('accepts custom percentages at call site', () => {
      const split = splitter.calculateSplit(100, 'usd', {
        providerShare: 60,
        platformShare: 20,
        operationsShare: 10,
        infrastructureShare: 5,
        justiceShare: 5,
      })
      expect(split.providerAmount).toBe(60)
      expect(split.platformAmount).toBe(20)
      expect(split.operationsAmount).toBe(10)
      expect(split.infrastructureAmount).toBe(5)
      expect(split.justiceAmount).toBe(5)
    })

    it('partial override merges with defaults', () => {
      const split = splitter.calculateSplit(100, 'usd', {
        providerShare: 60,
        operationsShare: 10,
        infrastructureShare: 5,
      })
      // 60 + 20 + 10 + 5 + 5 = 100
      expect(split.providerAmount).toBe(60)
      expect(split.platformAmount).toBe(20)
      expect(split.operationsAmount).toBe(10)
      expect(split.infrastructureAmount).toBe(5)
      expect(split.justiceAmount).toBe(5)
    })
  })

  describe('calculateSplit — validation', () => {
    it('throws when percentages do not sum to 100', () => {
      expect(() =>
        splitter.calculateSplit(100, 'usd', {
          providerShare: 50,
          platformShare: 10,
          operationsShare: 10,
          infrastructureShare: 10,
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
          infrastructureShare: 50,
          justiceShare: 50,
        }),
      ).toThrow('250%')
    })
  })

  describe('constructor with custom defaults', () => {
    it('uses custom default config', () => {
      const custom = new UltimateFairSplitter('sk_test_fake', {
        providerShare: 60,
        platformShare: 20,
        operationsShare: 10,
        infrastructureShare: 5,
        justiceShare: 5,
      })
      const split = custom.calculateSplit(100)
      expect(split.providerAmount).toBe(60)
      expect(split.platformAmount).toBe(20)
    })
  })

  describe('getSplitBreakdown', () => {
    it('returns human-readable breakdown', () => {
      const split = splitter.calculateSplit(100)
      const breakdown = splitter.getSplitBreakdown(split)

      expect(breakdown.provider.amount).toBe(70)
      expect(breakdown.provider.percentage).toBe(70)
      expect(breakdown.provider.description).toContain('Endeavor owner')

      expect(breakdown.platform.amount).toBe(20)
      expect(breakdown.platform.percentage).toBe(20)

      expect(breakdown.operations.amount).toBe(4)
      expect(breakdown.operations.percentage).toBe(4)

      expect(breakdown.infrastructure.amount).toBe(1)
      expect(breakdown.infrastructure.percentage).toBe(1)
      expect(breakdown.infrastructure.description).toContain('Flagship')

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
      expect(report.providersEarned).toBe(210) // 70 + 140
      expect(report.platformInvestment).toBe(60) // 20 + 40
      expect(report.operationsSupport).toBe(12) // 4 + 8
      expect(report.justiceImpact).toBe(15) // 5 + 10
    })

    it('reports ecosystem health as Abundant for default 70% provider share', () => {
      const splits = [splitter.calculateSplit(100)]
      const report = splitter.generateTransparencyReport(splits)
      // 70% provider share > 65% threshold = Abundant
      expect(report.ecosystemHealth).toBe('Abundant')
    })

    it('reports Thriving when provider share is between 55-65%', () => {
      const custom = new UltimateFairSplitter('sk_test_fake', {
        providerShare: 60,
        platformShare: 20,
        operationsShare: 10,
        infrastructureShare: 5,
        justiceShare: 5,
      })
      const splits = [custom.calculateSplit(100)]
      const report = custom.generateTransparencyReport(splits)
      expect(report.ecosystemHealth).toBe('Thriving')
    })

    it('handles empty splits array', () => {
      const report = splitter.generateTransparencyReport([])
      expect(report.totalProcessed).toBe(0)
    })
  })
})
