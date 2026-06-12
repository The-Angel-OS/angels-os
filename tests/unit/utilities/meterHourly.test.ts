import { describe, it, expect } from 'vitest'
import {
  workedMinutes, billableMinutes, computeInvoice,
  emptySession, clockIn, clockOut, isOnClock,
  type WorkSegment,
} from '@/utilities/meterHourly'

const seg = (inM: number, outM?: number): WorkSegment => ({
  in: new Date(Date.UTC(2026, 5, 12, 9, inM)).toISOString(),
  out: outM != null ? new Date(Date.UTC(2026, 5, 12, 9, outM)).toISOString() : undefined,
})

describe('meterHourly', () => {
  it('sums only time on the clock (calls/breaks are clocked out, not billed)', () => {
    // worked 9:00-9:30 and 9:45-10:00 = 45 min; the 9:30-9:45 gap (phone call) is not billed
    const segments = [seg(0, 30), seg(45, 60)]
    expect(workedMinutes(segments)).toBe(45)
  })

  it('open segment measures to now', () => {
    const now = new Date(Date.UTC(2026, 5, 12, 9, 20)).toISOString()
    expect(workedMinutes([seg(0)], now)).toBe(20)
    expect(isOnClock({ segments: [seg(0)], extraCosts: [] })).toBe(true)
  })

  it('billableMinutes = exact minutes at increment 1 (Ronald)', () => {
    expect(billableMinutes([seg(0, 47)], { incrementMinutes: 1 })).toBe(47)
  })

  it('billableMinutes rounds UP to the increment', () => {
    expect(billableMinutes([seg(0, 47)], { incrementMinutes: 15 })).toBe(60) // 47 → next quarter-hour
    expect(billableMinutes([seg(0, 30)], { incrementMinutes: 15 })).toBe(30)
  })

  it('applies a minimum charge', () => {
    expect(billableMinutes([seg(0, 10)], { incrementMinutes: 1, minimumMinutes: 60 })).toBe(60)
  })

  it('hourly invoice = rate × billable + extra costs', () => {
    // $50/hr, 90 min billed, + $25 materials
    const inv = computeInvoice({
      pricingModel: 'hourly', hourlyRateCents: 5000, billedMinutes: 90,
      extraCosts: [{ label: 'Materials', amountCents: 2500 }],
    })
    expect(inv.laborCents).toBe(7500) // 50 * 90/60 = 75.00
    expect(inv.costsCents).toBe(2500)
    expect(inv.totalCents).toBe(10000)
    expect(inv.lines).toHaveLength(2)
  })

  it('per-unit invoice = rate × units', () => {
    const inv = computeInvoice({ pricingModel: 'per_unit', unitRateCents: 15, units: 2000, unitLabel: 'sq ft' })
    expect(inv.laborCents).toBe(30000) // $0.15 * 2000 = $300
  })

  it('fixed invoice = price + costs', () => {
    const inv = computeInvoice({ pricingModel: 'fixed', fixedPriceCents: 4000, extraCosts: [{ label: 'Trip', amountCents: 1000 }] })
    expect(inv.totalCents).toBe(5000)
  })

  it('clockIn/clockOut transitions are idempotent at the boundaries', () => {
    let s = emptySession()
    s = clockIn(s, seg(0).in)
    expect(isOnClock(s)).toBe(true)
    s = clockIn(s, seg(5).in) // already on the clock → no-op, no double segment
    expect(s.segments).toHaveLength(1)
    s = clockOut(s, seg(0, 30).out!)
    expect(isOnClock(s)).toBe(false)
    s = clockOut(s, seg(0, 40).out!) // not on the clock → no-op
    expect(s.segments[0].out).toBe(seg(0, 30).out)
    expect(billableMinutes(s.segments, { incrementMinutes: 1 })).toBe(30)
  })
})
