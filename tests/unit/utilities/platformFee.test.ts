/**
 * The platform's cut is money. These pin the arithmetic and the guards, because
 * the failure modes are silent: a fee that rounds wrong loses cents on every
 * charge, and a fee that reads as 0 when unset would run the platform free
 * forever without anyone noticing.
 */
import { describe, expect, it } from 'vitest'
import {
  feeCents,
  normalizeFeeBps,
  bpsToPercent,
  DEFAULT_PLATFORM_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
} from '@/utilities/platformFee'

describe('normalizeFeeBps', () => {
  it('falls back to the default for junk — never to zero', () => {
    for (const bad of [undefined, null, 'abc', NaN, -1]) {
      expect(normalizeFeeBps(bad)).toBe(DEFAULT_PLATFORM_FEE_BPS)
    }
  })

  it('caps a fat finger rather than charging it', () => {
    expect(normalizeFeeBps(9999)).toBe(MAX_PLATFORM_FEE_BPS)
  })

  it('allows an explicit zero — a deliberate free period is legitimate', () => {
    expect(normalizeFeeBps(0)).toBe(0)
  })
})

describe('feeCents', () => {
  it('is exact at the default 5%', () => {
    expect(feeCents(10000, 500)).toBe(500) // $100 → $5.00
    expect(feeCents(7500, 500)).toBe(375) // Ron's $75 deposit → $3.75
  })

  it('handles fractional rates without drift', () => {
    expect(feeCents(10000, 250)).toBe(250) // 2.5% of $100
    expect(feeCents(333, 250)).toBe(8) // rounds, never truncates to 0
  })

  it('is zero for non-charges', () => {
    expect(feeCents(0, 500)).toBe(0)
    expect(feeCents(-100, 500)).toBe(0)
    expect(feeCents(NaN, 500)).toBe(0)
  })

  it('charges nothing at an explicit 0% — the free-period case', () => {
    expect(feeCents(10000, 0)).toBe(0)
  })
})

describe('bpsToPercent', () => {
  it('reads back the way a human would say it', () => {
    expect(bpsToPercent(500)).toBe('5.00')
    expect(bpsToPercent(250)).toBe('2.50')
  })
})
