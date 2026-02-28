/**
 * Unit tests for Booking Engine — slot generation and conflict detection.
 *
 * Tests the pure algorithmic parts:
 * - generateTimeSlots() — creates time slots within an availability window
 * - mergeOverlappingSlots() — coalesces adjacent available slots
 * - calculateHarmonicScore() — Answer 53 scheduling harmony
 *
 * Payload-dependent methods (getAvailableSlots, createBooking) are tested
 * in integration tests.
 *
 * @see src/utilities/bookingEngine.ts
 */
import { describe, it, expect } from 'vitest'
import {
  generateTimeSlots as generateTimeSlotsRaw,
  mergeOverlappingSlots,
  calculateHarmonicScore,
  type TimeSlot,
} from '@/utilities/bookingEngine'

// ---------------------------------------------------------------------------
// Wrapper: the exported generateTimeSlots includes minAdvanceBooking /
// maxAdvanceBooking parameters that depend on `new Date()`. For unit tests
// we skip those guards by omitting the last two params (they default to
// undefined, so the min-advance check uses 1 hour). To keep old tests
// deterministic we use a far-future test date.
// ---------------------------------------------------------------------------
function generateTimeSlots(
  date: Date,
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number,
  existingBookings: Array<{ id: string; startDateTime: string; endDateTime: string }>,
): TimeSlot[] {
  return generateTimeSlotsRaw(date, startTime, endTime, slotDuration, bufferTime, existingBookings)
}

// ---------------------------------------------------------------------------
// Tests — generateTimeSlots
// ---------------------------------------------------------------------------

describe('generateTimeSlots', () => {
  const testDate = new Date('2026-03-15T00:00:00')

  it('generates correct number of 60-min slots in 9am-5pm window', () => {
    const slots = generateTimeSlots(testDate, '09:00', '17:00', 60, 0, [])
    const available = slots.filter((s) => s.slotType === 'available')
    expect(available).toHaveLength(8) // 8 hours × 1 slot/hour
  })

  it('generates 30-min slots', () => {
    const slots = generateTimeSlots(testDate, '09:00', '12:00', 30, 0, [])
    const available = slots.filter((s) => s.slotType === 'available')
    expect(available).toHaveLength(6) // 3 hours × 2 slots/hour
  })

  it('marks conflicting slots as booked', () => {
    const bookings = [
      {
        id: 'booking_1',
        startDateTime: new Date('2026-03-15T10:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T11:00:00').toISOString(),
      },
    ]
    const slots = generateTimeSlots(
      testDate,
      '09:00',
      '12:00',
      60,
      0,
      bookings,
    )

    expect(slots[0].available).toBe(true) // 9-10
    expect(slots[1].available).toBe(false) // 10-11 (booked)
    expect(slots[1].bookingId).toBe('booking_1')
    expect(slots[2].available).toBe(true) // 11-12
  })

  it('adds buffer slots between appointments', () => {
    const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 15, [])
    const bufferSlots = slots.filter((s) => s.slotType === 'buffer')
    // Each available slot gets a 15-min buffer after it
    expect(bufferSlots.length).toBeGreaterThan(0)
    bufferSlots.forEach((buffer) => {
      expect(buffer.available).toBe(false)
      expect(buffer.slotType).toBe('buffer')
    })
  })

  it('buffer duration matches configuration', () => {
    const slots = generateTimeSlots(testDate, '09:00', '11:00', 60, 15, [])
    const bufferSlot = slots.find((s) => s.slotType === 'buffer')
    if (bufferSlot) {
      const durationMin =
        (bufferSlot.endTime.getTime() - bufferSlot.startTime.getTime()) /
        60000
      expect(durationMin).toBe(15)
    }
  })

  it('does not generate slots past window end', () => {
    const slots = generateTimeSlots(testDate, '09:00', '09:45', 60, 0, [])
    // 60-min slot doesn't fit in 45-min window
    expect(slots).toHaveLength(0)
  })

  it('handles overlapping bookings', () => {
    const bookings = [
      {
        id: 'b1',
        startDateTime: new Date('2026-03-15T09:30:00').toISOString(),
        endDateTime: new Date('2026-03-15T10:30:00').toISOString(),
      },
    ]
    const slots = generateTimeSlots(
      testDate,
      '09:00',
      '12:00',
      60,
      0,
      bookings,
    )
    // 9-10 overlaps with b1 (9:30-10:30)
    expect(slots[0].available).toBe(false)
    // 10-11 also overlaps with b1
    expect(slots[1].available).toBe(false)
    // 11-12 is free
    expect(slots[2].available).toBe(true)
  })

  it('handles booking that spans entire window', () => {
    const bookings = [
      {
        id: 'all-day',
        startDateTime: new Date('2026-03-15T08:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T18:00:00').toISOString(),
      },
    ]
    const slots = generateTimeSlots(
      testDate,
      '09:00',
      '17:00',
      60,
      0,
      bookings,
    )
    expect(slots.every((s) => !s.available)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests — mergeOverlappingSlots
// ---------------------------------------------------------------------------

describe('mergeOverlappingSlots', () => {
  it('merges two adjacent available slots', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
      {
        startTime: new Date('2026-03-15T10:00:00'),
        endTime: new Date('2026-03-15T11:00:00'),
        available: true,
        slotType: 'available',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    expect(merged).toHaveLength(1)
    expect(merged[0].startTime.getHours()).toBe(9)
    expect(merged[0].endTime.getHours()).toBe(11)
  })

  it('does not merge available + booked slots', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
      {
        startTime: new Date('2026-03-15T10:00:00'),
        endTime: new Date('2026-03-15T11:00:00'),
        available: false,
        slotType: 'booked',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    expect(merged).toHaveLength(2)
  })

  it('does not merge available + buffer slots', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
      {
        startTime: new Date('2026-03-15T10:00:00'),
        endTime: new Date('2026-03-15T10:15:00'),
        available: false,
        slotType: 'buffer',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    expect(merged).toHaveLength(2)
  })

  it('returns single slot unchanged', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
    ]
    expect(mergeOverlappingSlots(slots)).toHaveLength(1)
  })

  it('returns empty array unchanged', () => {
    expect(mergeOverlappingSlots([])).toHaveLength(0)
  })

  it('merges chain of 3 adjacent available slots', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
      {
        startTime: new Date('2026-03-15T10:00:00'),
        endTime: new Date('2026-03-15T11:00:00'),
        available: true,
        slotType: 'available',
      },
      {
        startTime: new Date('2026-03-15T11:00:00'),
        endTime: new Date('2026-03-15T12:00:00'),
        available: true,
        slotType: 'available',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    expect(merged).toHaveLength(1)
    expect(merged[0].endTime.getHours()).toBe(12)
  })
})

// ---------------------------------------------------------------------------
// Tests — calculateHarmonicScore (Answer 53)
// ---------------------------------------------------------------------------

describe('calculateHarmonicScore', () => {
  const base = new Date('2026-03-15T10:00:00')

  it('returns 100 for same time (perfect harmony)', () => {
    expect(calculateHarmonicScore(base, base)).toBe(100)
  })

  it('returns 100 for < 1 hour difference', () => {
    const alt = new Date(base.getTime() + 30 * 60 * 1000)
    expect(calculateHarmonicScore(base, alt)).toBe(100)
  })

  it('returns 90 for 1-4 hour difference', () => {
    const alt = new Date(base.getTime() + 2 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, alt)).toBe(90)
  })

  it('returns 70 for same-day different time (4-24h)', () => {
    const alt = new Date(base.getTime() + 6 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, alt)).toBe(70)
  })

  it('returns 50 for next day (24-48h)', () => {
    const alt = new Date(base.getTime() + 30 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, alt)).toBe(50)
  })

  it('decreases for further out alternatives', () => {
    const threeDays = new Date(base.getTime() + 72 * 60 * 60 * 1000)
    const fiveDays = new Date(base.getTime() + 120 * 60 * 60 * 1000)
    const score3 = calculateHarmonicScore(base, threeDays)
    const score5 = calculateHarmonicScore(base, fiveDays)
    expect(score3).toBeGreaterThan(score5)
  })

  it('never returns below 10', () => {
    const farFuture = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, farFuture)).toBeGreaterThanOrEqual(10)
  })

  it('is symmetric (works in both directions)', () => {
    const alt = new Date(base.getTime() + 3 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, alt)).toBe(
      calculateHarmonicScore(alt, base),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — generateTimeSlots edge cases (enhanced coverage)
// ---------------------------------------------------------------------------

describe('generateTimeSlots — edge cases', () => {
  const testDate = new Date('2026-03-15T00:00:00')

  it('generates 15-min slots correctly', () => {
    const slots = generateTimeSlots(testDate, '09:00', '10:00', 15, 0, [])
    const available = slots.filter((s) => s.slotType === 'available')
    expect(available).toHaveLength(4) // 60min / 15min = 4
  })

  it('handles empty window (start equals end)', () => {
    const slots = generateTimeSlots(testDate, '09:00', '09:00', 30, 0, [])
    expect(slots).toHaveLength(0)
  })

  it('handles multiple non-overlapping bookings', () => {
    const bookings = [
      {
        id: 'b1',
        startDateTime: new Date('2026-03-15T09:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T10:00:00').toISOString(),
      },
      {
        id: 'b2',
        startDateTime: new Date('2026-03-15T11:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T12:00:00').toISOString(),
      },
    ]
    const slots = generateTimeSlots(testDate, '09:00', '13:00', 60, 0, bookings)
    // 9-10 booked (b1), 10-11 available, 11-12 booked (b2), 12-13 available
    expect(slots[0].available).toBe(false)
    expect(slots[0].bookingId).toBe('b1')
    expect(slots[1].available).toBe(true)
    expect(slots[2].available).toBe(false)
    expect(slots[2].bookingId).toBe('b2')
    expect(slots[3].available).toBe(true)
  })

  it('correctly marks all slots when all are booked', () => {
    const bookings = [
      {
        id: 'b1',
        startDateTime: new Date('2026-03-15T09:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T10:00:00').toISOString(),
      },
      {
        id: 'b2',
        startDateTime: new Date('2026-03-15T10:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T11:00:00').toISOString(),
      },
    ]
    const slots = generateTimeSlots(testDate, '09:00', '11:00', 60, 0, bookings)
    expect(slots.every(s => !s.available)).toBe(true)
  })

  it('buffer time accounts for slot + buffer in step', () => {
    // 60-min slot + 30-min buffer = 90-min steps
    const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 30, [])
    // 9:00-10:00 (avail) + 10:00-10:30 (buffer), 10:30-11:30 (avail) + 11:30-12:00 (buffer)
    const availSlots = slots.filter(s => s.slotType === 'available')
    const bufferSlots = slots.filter(s => s.slotType === 'buffer')
    expect(availSlots.length).toBe(2) // 2 bookable slots
    expect(bufferSlots.length).toBe(2) // 2 buffer periods
  })

  it('slot timestamps are Date objects', () => {
    const slots = generateTimeSlots(testDate, '09:00', '10:00', 60, 0, [])
    expect(slots[0].startTime).toBeInstanceOf(Date)
    expect(slots[0].endTime).toBeInstanceOf(Date)
  })

  it('slot duration matches configuration', () => {
    const slots = generateTimeSlots(testDate, '09:00', '10:00', 45, 0, [])
    const slot = slots[0]
    const durationMin = (slot.endTime.getTime() - slot.startTime.getTime()) / 60000
    expect(durationMin).toBe(45)
  })
})

// ---------------------------------------------------------------------------
// Tests — mergeOverlappingSlots edge cases
// ---------------------------------------------------------------------------

describe('mergeOverlappingSlots — edge cases', () => {
  it('preserves bookingId on booked slots', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: false,
        slotType: 'booked',
        bookingId: 'booking_123',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    expect(merged).toHaveLength(1)
    expect(merged[0].bookingId).toBe('booking_123')
  })

  it('keeps non-adjacent available slots separate', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
      // Gap: 10:00-11:00 is missing
      {
        startTime: new Date('2026-03-15T11:00:00'),
        endTime: new Date('2026-03-15T12:00:00'),
        available: true,
        slotType: 'available',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    expect(merged).toHaveLength(2)
  })

  it('handles mixed slot types correctly', () => {
    const slots: TimeSlot[] = [
      {
        startTime: new Date('2026-03-15T09:00:00'),
        endTime: new Date('2026-03-15T10:00:00'),
        available: true,
        slotType: 'available',
      },
      {
        startTime: new Date('2026-03-15T10:00:00'),
        endTime: new Date('2026-03-15T10:15:00'),
        available: false,
        slotType: 'buffer',
      },
      {
        startTime: new Date('2026-03-15T10:15:00'),
        endTime: new Date('2026-03-15T11:15:00'),
        available: true,
        slotType: 'available',
      },
    ]
    const merged = mergeOverlappingSlots(slots)
    // available, buffer, available — none should merge
    expect(merged).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Tests — calculateHarmonicScore extended
// ---------------------------------------------------------------------------

describe('calculateHarmonicScore — extended', () => {
  const base = new Date('2026-03-15T10:00:00')

  it('returns > 0 for any time difference', () => {
    const oneYear = new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, oneYear)).toBeGreaterThan(0)
  })

  it('handles exact same Date object', () => {
    const same = new Date(base.getTime())
    expect(calculateHarmonicScore(base, same)).toBe(100)
  })

  it('30-minute difference is perfect harmony', () => {
    const halfHour = new Date(base.getTime() + 30 * 60 * 1000)
    expect(calculateHarmonicScore(base, halfHour)).toBe(100)
  })

  it('59-minute difference is perfect harmony', () => {
    const almostHour = new Date(base.getTime() + 59 * 60 * 1000)
    expect(calculateHarmonicScore(base, almostHour)).toBe(100)
  })

  it('2-hour difference gives good harmony (90)', () => {
    const twoHours = new Date(base.getTime() + 2 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, twoHours)).toBe(90)
  })

  it('3.5-hour difference gives good harmony (90)', () => {
    const threeHalf = new Date(base.getTime() + 3.5 * 60 * 60 * 1000)
    expect(calculateHarmonicScore(base, threeHalf)).toBe(90)
  })

  it('scores are monotonically non-increasing over distance', () => {
    const times = [1, 2, 4, 8, 24, 48, 72, 168].map(
      h => new Date(base.getTime() + h * 60 * 60 * 1000)
    )
    const scores = times.map(t => calculateHarmonicScore(base, t))
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('all scores are in valid range [10, 100]', () => {
    const offsets = [0, 30, 120, 360, 1440, 2880, 10080, 43200] // minutes
    offsets.forEach(offset => {
      const alt = new Date(base.getTime() + offset * 60 * 1000)
      const score = calculateHarmonicScore(base, alt)
      expect(score).toBeGreaterThanOrEqual(10)
      expect(score).toBeLessThanOrEqual(100)
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — Type exports
// ---------------------------------------------------------------------------

describe('BookingEngine type exports', () => {
  it('exports TimeSlot type with required fields', () => {
    const slot: TimeSlot = {
      startTime: new Date(),
      endTime: new Date(),
      available: true,
      slotType: 'available',
    }
    expect(slot.available).toBe(true)
    expect(slot.slotType).toBe('available')
  })

  it('TimeSlot supports all slot types', () => {
    const types: TimeSlot['slotType'][] = ['available', 'booked', 'blocked', 'buffer']
    expect(types).toHaveLength(4)
  })

  it('TimeSlot bookingId is optional', () => {
    const slot: TimeSlot = {
      startTime: new Date(),
      endTime: new Date(),
      available: false,
      slotType: 'booked',
      bookingId: 'test-123',
    }
    expect(slot.bookingId).toBe('test-123')
  })
})

// ---------------------------------------------------------------------------
// Tests — Integration patterns (verifying pure function composition)
// ---------------------------------------------------------------------------

describe('BookingEngine — composition patterns', () => {
  const testDate = new Date('2026-03-15T00:00:00')

  it('generate + merge produces consolidated view', () => {
    const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 0, [])
    const merged = mergeOverlappingSlots(slots)
    // 3 available slots should merge into 1 contiguous block
    expect(merged).toHaveLength(1)
    expect(merged[0].startTime.getHours()).toBe(9)
    expect(merged[0].endTime.getHours()).toBe(12)
  })

  it('generate with bookings + merge preserves structure', () => {
    const bookings = [{
      id: 'b1',
      startDateTime: new Date('2026-03-15T10:00:00').toISOString(),
      endDateTime: new Date('2026-03-15T11:00:00').toISOString(),
    }]
    const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 0, bookings)
    const merged = mergeOverlappingSlots(slots)
    // 9-10 (avail), 10-11 (booked), 11-12 (avail) — no merge possible
    expect(merged).toHaveLength(3)
  })

  it('harmonic scoring works with generated slot times', () => {
    const requestedTime = new Date('2026-03-15T10:00:00')
    const slots = generateTimeSlots(testDate, '09:00', '17:00', 60, 0, [])

    // Score all available slots against requested time
    const scores = slots
      .filter(s => s.available)
      .map(s => ({
        time: s.startTime,
        score: calculateHarmonicScore(requestedTime, s.startTime),
      }))

    // 10:00 slot should have highest score (exact match)
    const bestMatch = scores.reduce((best, curr) =>
      curr.score > best.score ? curr : best
    )
    expect(bestMatch.time.getHours()).toBe(10)
    expect(bestMatch.score).toBe(100)
  })

  it('nearby slots score higher than distant slots', () => {
    const requestedTime = new Date('2026-03-15T10:00:00')
    const nearSlot = new Date('2026-03-15T11:00:00')
    const farSlot = new Date('2026-03-16T15:00:00')

    expect(calculateHarmonicScore(requestedTime, nearSlot)).toBeGreaterThan(
      calculateHarmonicScore(requestedTime, farSlot)
    )
  })
})
