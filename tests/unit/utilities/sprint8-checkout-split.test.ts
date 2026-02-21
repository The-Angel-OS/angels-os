/**
 * Sprint 8 — Checkout Split Payment Tests
 *
 * Tests the Ultimate Fair Split calculation and Stripe Connect fee computation.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateUltimateFairSplit,
  ULTIMATE_FAIR_SPLIT,
  getPlatformApplicationFeePercent,
} from '@/lib/ultimate-fair-split'
import { getStripeApplicationFeeCents } from '@/lib/stripe-connect-config'

describe('Ultimate Fair Split', () => {
  it('splits sum to original amount (within rounding)', () => {
    const amount = 10000 // $100.00
    const splits = calculateUltimateFairSplit(amount)
    const total = splits.reduce((sum, s) => sum + s.amount, 0)
    // Rounding may cause 1 cent variance
    expect(Math.abs(total - amount)).toBeLessThanOrEqual(1)
  })

  it('calculates 60/20/15/5 split correctly', () => {
    const amount = 10000
    const splits = calculateUltimateFairSplit(amount)

    const provider = splits.find((s) => s.recipient === 'PROVIDER')
    const platform = splits.find((s) => s.recipient === 'PLATFORM_PARTNER')
    const ops = splits.find((s) => s.recipient === 'OPERATIONAL_OVERHEAD')
    const justice = splits.find((s) => s.recipient === 'JUSTICE_FUND')

    expect(provider?.amount).toBe(6000)
    expect(platform?.amount).toBe(2000)
    expect(ops?.amount).toBe(1500)
    expect(justice?.amount).toBe(500)
  })

  it('handles zero-dollar amount', () => {
    const splits = calculateUltimateFairSplit(0)
    for (const split of splits) {
      expect(split.amount).toBe(0)
    }
  })

  it('handles small amounts with rounding', () => {
    const splits = calculateUltimateFairSplit(1) // 1 cent
    // All should be 0 or 1 cent
    for (const split of splits) {
      expect(split.amount).toBeLessThanOrEqual(1)
      expect(split.amount).toBeGreaterThanOrEqual(0)
    }
  })

  it('split constants sum to 1.0', () => {
    const total =
      ULTIMATE_FAIR_SPLIT.PROVIDER +
      ULTIMATE_FAIR_SPLIT.PLATFORM_PARTNER +
      ULTIMATE_FAIR_SPLIT.OPERATIONAL_OVERHEAD +
      ULTIMATE_FAIR_SPLIT.JUSTICE_FUND
    expect(total).toBe(1.0)
  })
})

describe('Platform Application Fee', () => {
  it('returns 40% as platform fee percentage', () => {
    const percent = getPlatformApplicationFeePercent()
    expect(percent).toBeCloseTo(0.4, 10)
  })

  it('calculates application fee correctly for $100', () => {
    const fee = getStripeApplicationFeeCents(10000)
    expect(fee).toBe(4000) // 40% of $100
  })

  it('calculates application fee correctly for $1', () => {
    const fee = getStripeApplicationFeeCents(100)
    expect(fee).toBe(40) // 40% of $1
  })

  it('returns 0 for zero amount', () => {
    const fee = getStripeApplicationFeeCents(0)
    expect(fee).toBe(0)
  })

  it('rounds correctly for odd amounts', () => {
    const fee = getStripeApplicationFeeCents(333) // $3.33
    expect(fee).toBe(133) // Math.round(333 * 0.4) = Math.round(133.2) = 133
  })
})
