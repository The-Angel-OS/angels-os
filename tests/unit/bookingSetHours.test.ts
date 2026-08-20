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
