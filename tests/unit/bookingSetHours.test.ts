import { describe, it, expect } from 'vitest'
import { parseDays } from '@/endpoints/booking-set-hours'

describe('parseDays — the weekly hours editor payload', () => {
  it('accepts a normal week', () => {
    const out = parseDays([
      { day: 1, start: '09:00', end: '17:00' },
      { day: 5, start: '08:30', end: '12:00' },
    ])
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(2)
  })

  it('accepts an empty week (owner closes every day)', () => {
    expect(parseDays([])).toEqual([])
  })

  it.each([
    [[{ day: 7, start: '09:00', end: '17:00' }], 'day must be 0–6'],
    [[{ day: 1, start: '9am', end: '17:00' }], 'start and end must be HH:MM'],
    [[{ day: 1, start: '17:00', end: '09:00' }], 'start must be before end'],
    [[{ day: 1, start: '09:00', end: '09:00' }], 'start must be before end'],
    [
      [
        { day: 1, start: '09:00', end: '10:00' },
        { day: 1, start: '11:00', end: '12:00' },
      ],
      'duplicate day',
    ],
  ])('rejects %j', (input, message) => {
    expect(parseDays(input)).toBe(message)
  })

  it('rejects a non-array', () => {
    expect(parseDays({ day: 1 })).toBe('days must be an array')
  })
})

describe('house hours', () => {
  it('asks for rows with no provider when there is no named one', async () => {
    const { providerWhere } = await import('@/utilities/resolveBookingProvider')
    // A one-person business, and every unclaimed prospect demo, live here.
    expect(providerWhere(null)).toEqual({ provider: { exists: false } })
  })

  it('still scopes to the named provider when there is one', async () => {
    const { providerWhere } = await import('@/utilities/resolveBookingProvider')
    expect(providerWhere(7)).toEqual({ provider: { equals: 7 } })
  })

  it('never matches everyone — the two forms are mutually exclusive', async () => {
    const { providerWhere } = await import('@/utilities/resolveBookingProvider')
    // A clause that matched every row would let one portal's hours leak into
    // another's booking page, which is worse than an empty calendar.
    expect(JSON.stringify(providerWhere(null))).not.toEqual(JSON.stringify(providerWhere(7)))
    expect(providerWhere(0)).toEqual({ provider: { equals: 0 } })
  })
})
