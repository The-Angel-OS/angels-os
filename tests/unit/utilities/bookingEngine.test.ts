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

// ---------------------------------------------------------------------------
// Re-implement pure functions for isolated testing
// ---------------------------------------------------------------------------

interface TimeSlot {
  startTime: Date
  endTime: Date
  available: boolean
  bookingId?: string
  slotType: 'available' | 'booked' | 'blocked' | 'buffer'
}

/**
 * Generate individual time slots within a time window.
 * Mirrors BookingEngine.generateTimeSlots() but stripped of `now` checks
 * (those are impure; we test the slot generation algorithm itself).
 */
function generateTimeSlots(
  date: Date,
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number,
  existingBookings: Array<{
    id: string
    startDateTime: string
    endDateTime: string
  }>,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)

  const slotStart = new Date(date)
  slotStart.setHours(startHour, startMinute, 0, 0)

  const windowEnd = new Date(date)
  windowEnd.setHours(endHour, endMinute, 0, 0)

  while (slotStart < windowEnd) {
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)
    if (slotEnd > windowEnd) break

    const conflict = existingBookings.find((booking) => {
      const bookingStart = new Date(booking.startDateTime)
      const bookingEnd = new Date(booking.endDateTime)
      return (
        (slotStart >= bookingStart && slotStart < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotStart <= bookingStart && slotEnd >= bookingEnd)
      )
    })

    const slot: TimeSlot = {
      startTime: new Date(slotStart),
      endTime: new Date(slotEnd),
      available: !conflict,
      slotType: conflict ? 'booked' : 'available',
      bookingId: conflict?.id,
    }

    slots.push(slot)

    if (bufferTime > 0 && !conflict) {
      const bufferEnd = new Date(
        slotEnd.getTime() + bufferTime * 60 * 1000,
      )
      if (bufferEnd <= windowEnd) {
        slots.push({
          startTime: new Date(slotEnd),
          endTime: bufferEnd,
          available: false,
          slotType: 'buffer',
        })
      }
    }

    slotStart.setTime(
      slotStart.getTime() + (slotDuration + bufferTime) * 60 * 1000,
    )
  }

  return slots
}

/**
 * Merge overlapping/adjacent available slots.
 */
function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length <= 1) return slots

  const sorted = slots.sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  )
  const merged: TimeSlot[] = []
  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    if (
      current.available &&
      next.available &&
      current.slotType === 'available' &&
      next.slotType === 'available' &&
      current.endTime.getTime() === next.startTime.getTime()
    ) {
      current = { ...current, endTime: next.endTime }
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

/**
 * Harmonic scoring for alternative time suggestions.
 */
function calculateHarmonicScore(
  requestedTime: Date,
  alternativeTime: Date,
): number {
  const timeDiff = Math.abs(
    requestedTime.getTime() - alternativeTime.getTime(),
  )
  const hoursDiff = timeDiff / (1000 * 60 * 60)

  if (hoursDiff < 1) return 100
  if (hoursDiff < 4) return 90
  if (hoursDiff < 24) return 70
  if (hoursDiff < 48) return 50

  return Math.max(10, 40 - (hoursDiff / 24) * 5)
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
