/**
 * The 95/5 split.
 *
 * This file previously asserted 60/20/15/5 and a 40% platform application fee —
 * and those assertions PASSED, because the code really did take 40% off Stripe
 * direct charges. A tradesperson's $75 deposit sent $30 to the platform. The
 * tests were faithfully protecting the wrong number, which is why "the tests
 * pass" is not the same as "the behaviour is right".
 *
 * The applied rate now lives in src/utilities/platformFee.ts as a runtime
 * setting; what remains here is the DEFAULT and the arithmetic.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateUltimateFairSplit,
  ULTIMATE_FAIR_SPLIT,
  getPlatformApplicationFeePercent,
} from '@/lib/ultimate-fair-split'
import { DEFAULT_PLATFORM_FEE_BPS } from '@/utilities/platformFee'

const sum = (splits: { amount: number }[]) => splits.reduce((t, s) => t + s.amount, 0)
const share = (splits: { recipient: string; amount: number }[], who: string) =>
  splits.find((s) => s.recipient === who)!.amount

describe('95/5 split', () => {
  it('never loses or invents a cent — the parts equal the whole', () => {
    for (const amount of [10000, 7500, 1, 333, 999999]) {
      expect(sum(calculateUltimateFairSplit(amount))).toBe(amount)
    }
  })

  it('gives the provider 95% and the platform 5%', () => {
    const splits = calculateUltimateFairSplit(10000) // $100
    expect(share(splits, 'PROVIDER')).toBe(9500)
    expect(share(splits, 'PLATFORM')).toBe(500)
  })

  it("takes $3.75 from Ron's $75 deposit — not the $30 the old model took", () => {
    const splits = calculateUltimateFairSplit(7500)
    expect(share(splits, 'PLATFORM')).toBe(375)
    expect(share(splits, 'PROVIDER')).toBe(7125)
  })

  it('honours an explicitly passed rate, so a fee change needs no deploy', () => {
    const splits = calculateUltimateFairSplit(10000, 250) // 2.5%
    expect(share(splits, 'PLATFORM')).toBe(250)
    expect(share(splits, 'PROVIDER')).toBe(9750)
  })

  it('handles zero and sub-cent amounts without going negative', () => {
    expect(sum(calculateUltimateFairSplit(0))).toBe(0)
    const one = calculateUltimateFairSplit(1)
    expect(sum(one)).toBe(1)
    expect(share(one, 'PROVIDER')).toBe(1) // 5% of 1 cent rounds to 0
    expect(share(one, 'PLATFORM')).toBe(0)
  })

  it('constants sum to 1.0 and match the default fee', () => {
    expect(ULTIMATE_FAIR_SPLIT.PROVIDER + ULTIMATE_FAIR_SPLIT.PLATFORM).toBeCloseTo(1, 10)
    expect(ULTIMATE_FAIR_SPLIT.PLATFORM).toBeCloseTo(DEFAULT_PLATFORM_FEE_BPS / 10000, 10)
  })
})

describe('getPlatformApplicationFeePercent (deprecated)', () => {
  it('reports 5%, not the 40% it used to feed into Stripe', () => {
    expect(getPlatformApplicationFeePercent()).toBeCloseTo(0.05, 10)
  })
})
