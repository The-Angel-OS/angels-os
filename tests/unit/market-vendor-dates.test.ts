/**
 * upcomingMarketDates — recurrence math for the market-vendor "Find Us" calendar.
 */
import { describe, it, expect } from 'vitest'
import { upcomingMarketDates, type MarketStop } from '@/utilities/provisionMarketVendorSite'

const weekly: MarketStop = { title: 'Weekly Sat', cadence: 'Every Saturday', weekday: 6 }
const secondSat: MarketStop = { title: '2nd Sat', cadence: '2nd Saturday monthly', weekday: 6, nth: 2 }

describe('upcomingMarketDates', () => {
  it('weekly: returns the next N matching weekdays, all in the future', () => {
    const from = new Date(2026, 5, 16) // Tue Jun 16 2026
    const dates = upcomingMarketDates(weekly, from, 3)
    expect(dates).toHaveLength(3)
    expect(dates.every((d) => d.getDay() === 6)).toBe(true)
    expect(dates.every((d) => d >= from)).toBe(true)
    // First Saturday after Tue Jun 16 is Jun 20; then 27; then Jul 4.
    expect(dates.map((d) => d.getDate())).toEqual([20, 27, 4])
  })

  it('monthly nth: returns the 2nd Saturday across coming months', () => {
    const from = new Date(2026, 5, 16) // past June's 2nd Sat (Jun 13) → start July
    const dates = upcomingMarketDates(secondSat, from, 3)
    expect(dates).toHaveLength(3)
    expect(dates.every((d) => d.getDay() === 6)).toBe(true)
    // 2nd Saturdays: Jul 11, Aug 8, Sep 12 (2026).
    expect(dates.map((d) => [d.getMonth(), d.getDate()])).toEqual([[6, 11], [7, 8], [8, 12]])
  })

  it('monthly nth: includes the current month when its date is still ahead', () => {
    const from = new Date(2026, 5, 1) // Jun 1 → Jun's 2nd Sat (Jun 13) is ahead
    const [first] = upcomingMarketDates(secondSat, from, 1)
    expect([first.getMonth(), first.getDate()]).toEqual([5, 13])
  })
})
