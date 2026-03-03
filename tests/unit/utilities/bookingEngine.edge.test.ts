/**
 * Booking Engine — Edge-Case Tests (Sprint 36 D2)
 *
 * Boundary tests for slot generation, overlapping bookings, buffer handling,
 * merge behavior, harmonic scoring, and DST/midnight edge cases.
 *
 * Tests only the pure functions (generateTimeSlots, mergeOverlappingSlots,
 * calculateHarmonicScore) — Payload-dependent methods are in integration tests.
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
// Wrapper to skip min/max advance booking guards (same pattern as main tests)
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

// Far-future test date to avoid advance booking constraints
const testDate = new Date('2026-03-15T00:00:00')

// ---------------------------------------------------------------------------
// Edge-Case Tests
// ---------------------------------------------------------------------------

describe('Booking Engine — Edge Cases', () => {
  // =========================================================================
  // 1. Booking Overlap at Exact Boundaries (Inclusive/Exclusive)
  // =========================================================================
  describe('booking overlap at exact time boundaries', () => {
    it('slot ending exactly when booking starts is available', () => {
      // Booking [10:00-11:00). Slot [09:00-10:00) should NOT overlap.
      const bookings = [{
        id: 'b1',
        startDateTime: new Date('2026-03-15T10:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T11:00:00').toISOString(),
      }]
      const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 0, bookings)
      const nineToTen = slots.find((s) => s.startTime.getHours() === 9 && s.slotType !== 'buffer')
      expect(nineToTen?.available).toBe(true)
    })

    it('slot starting exactly when booking ends is available', () => {
      // Booking [10:00-11:00). Slot [11:00-12:00) should NOT overlap.
      const bookings = [{
        id: 'b1',
        startDateTime: new Date('2026-03-15T10:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T11:00:00').toISOString(),
      }]
      const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 0, bookings)
      const elevenToTwelve = slots.find((s) => s.startTime.getHours() === 11 && s.slotType !== 'buffer')
      expect(elevenToTwelve?.available).toBe(true)
    })

    it('slot exactly matching booking is marked booked', () => {
      const bookings = [{
        id: 'b1',
        startDateTime: new Date('2026-03-15T10:00:00').toISOString(),
        endDateTime: new Date('2026-03-15T11:00:00').toISOString(),
      }]
      const slots = generateTimeSlots(testDate, '10:00', '11:00', 60, 0, bookings)
      expect(slots.length).toBeGreaterThanOrEqual(1)
      const bookedSlot = slots.find((s) => s.slotType !== 'buffer')
      expect(bookedSlot?.available).toBe(false)
      expect(bookedSlot?.bookingId).toBe('b1')
    })
  })

  // =========================================================================
  // 2. Buffer Slot Overshooting Window End
  // =========================================================================
  describe('buffer handling at window end', () => {
    it('does not add buffer that would exceed window end', () => {
      // Window 09:00-10:15, slot=60min, buffer=30min
      // Slot [09:00-10:00), buffer would be [10:00-10:30) but window ends at 10:15
      const slots = generateTimeSlots(testDate, '09:00', '10:15', 60, 30, [])
      const bufferSlots = slots.filter((s) => s.slotType === 'buffer')
      for (const buf of bufferSlots) {
        const windowEnd = new Date('2026-03-15T10:15:00')
        expect(buf.endTime.getTime()).toBeLessThanOrEqual(windowEnd.getTime())
      }
    })

    it('adds buffer when it fits within window end', () => {
      // Window 09:00-11:00, slot=60min, buffer=15min
      // Slot [09:00-10:00), buffer [10:00-10:15) fits
      const slots = generateTimeSlots(testDate, '09:00', '11:00', 60, 15, [])
      const bufferSlots = slots.filter((s) => s.slotType === 'buffer')
      expect(bufferSlots.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // 3. Multiple Overlapping Bookings at Same Time
  // =========================================================================
  describe('multiple overlapping bookings', () => {
    it('marks slot as booked even with 3 overlapping bookings', () => {
      const bookings = [
        { id: 'b1', startDateTime: new Date('2026-03-15T10:00:00').toISOString(), endDateTime: new Date('2026-03-15T11:00:00').toISOString() },
        { id: 'b2', startDateTime: new Date('2026-03-15T10:15:00').toISOString(), endDateTime: new Date('2026-03-15T10:45:00').toISOString() },
        { id: 'b3', startDateTime: new Date('2026-03-15T09:45:00').toISOString(), endDateTime: new Date('2026-03-15T10:30:00').toISOString() },
      ]
      const slots = generateTimeSlots(testDate, '09:00', '12:00', 60, 0, bookings)
      const tenSlot = slots.find((s) => s.startTime.getHours() === 10 && s.slotType !== 'buffer')
      expect(tenSlot?.available).toBe(false)
    })
  })

  // =========================================================================
  // 4. Merge with Unsorted/Reverse Input
  // =========================================================================
  describe('merge with unsorted input', () => {
    it('merges reverse-ordered available slots correctly', () => {
      const base = new Date('2026-03-15T09:00:00')
      const slots: TimeSlot[] = [
        { startTime: new Date(base.getTime() + 120 * 60000), endTime: new Date(base.getTime() + 180 * 60000), available: true, slotType: 'available' },
        { startTime: new Date(base.getTime() + 60 * 60000), endTime: new Date(base.getTime() + 120 * 60000), available: true, slotType: 'available' },
        { startTime: base, endTime: new Date(base.getTime() + 60 * 60000), available: true, slotType: 'available' },
      ]
      const merged = mergeOverlappingSlots(slots)
      // After sorting + merging, should be one 3-hour slot
      expect(merged).toHaveLength(1)
      expect(merged[0].startTime.getTime()).toBe(base.getTime())
      expect(merged[0].endTime.getTime()).toBe(base.getTime() + 180 * 60000)
    })

    it('preserves booked slots without merging', () => {
      const base = new Date('2026-03-15T09:00:00')
      const slots: TimeSlot[] = [
        { startTime: base, endTime: new Date(base.getTime() + 60 * 60000), available: true, slotType: 'available' },
        { startTime: new Date(base.getTime() + 60 * 60000), endTime: new Date(base.getTime() + 120 * 60000), available: false, slotType: 'booked', bookingId: 'b1' },
        { startTime: new Date(base.getTime() + 120 * 60000), endTime: new Date(base.getTime() + 180 * 60000), available: true, slotType: 'available' },
      ]
      const merged = mergeOverlappingSlots(slots)
      // Booked slot breaks the merge chain
      expect(merged).toHaveLength(3)
    })
  })

  // =========================================================================
  // 5. Harmonic Score — Symmetry and Negative Time Offset
  // =========================================================================
  describe('harmonic score symmetry', () => {
    it('returns same score regardless of time direction', () => {
      const requested = new Date('2026-03-15T10:00:00')
      const later = new Date('2026-03-17T14:00:00')
      const scoreLater = calculateHarmonicScore(requested, later)
      const scoreEarlier = calculateHarmonicScore(later, requested)
      // Math.abs makes it symmetric
      expect(scoreLater).toBe(scoreEarlier)
    })

    it('returns 100 for times less than 1 hour apart', () => {
      const a = new Date('2026-03-15T10:00:00')
      const b = new Date('2026-03-15T10:30:00')
      expect(calculateHarmonicScore(a, b)).toBe(100)
    })

    it('returns 100 for identical times', () => {
      const a = new Date('2026-03-15T10:00:00')
      expect(calculateHarmonicScore(a, a)).toBe(100)
    })

    it('never returns below 10 even for very far apart times', () => {
      const a = new Date('2026-03-15T10:00:00')
      const b = new Date('2027-03-15T10:00:00') // 1 year later
      const score = calculateHarmonicScore(a, b)
      expect(score).toBeGreaterThanOrEqual(10)
    })
  })

  // =========================================================================
  // 6. Slot Duration Longer Than Remaining Window
  // =========================================================================
  describe('slot duration exceeds window', () => {
    it('generates no slots when duration > window size', () => {
      // 120-min slot in a 90-min window
      const slots = generateTimeSlots(testDate, '09:00', '10:30', 120, 0, [])
      expect(slots).toHaveLength(0)
    })

    it('generates exactly 1 slot when duration equals window size', () => {
      const slots = generateTimeSlots(testDate, '09:00', '10:00', 60, 0, [])
      const available = slots.filter((s) => s.slotType === 'available')
      expect(available).toHaveLength(1)
    })

    it('generates slots only while they fit within window', () => {
      // 90-min window, 60-min slots → 1 slot fits, second doesn't
      const slots = generateTimeSlots(testDate, '09:00', '10:30', 60, 0, [])
      const available = slots.filter((s) => s.slotType === 'available')
      expect(available).toHaveLength(1)
    })
  })

  // =========================================================================
  // 7. 15-Minute Slots with High Buffer
  // =========================================================================
  describe('short slots with large buffer', () => {
    it('generates correct pattern with 15-min slots and 15-min buffers', () => {
      // Window: 2 hours, slot=15min, buffer=15min → effective=30min → 4 slots
      const slots = generateTimeSlots(testDate, '09:00', '11:00', 15, 15, [])
      const available = slots.filter((s) => s.slotType === 'available')
      expect(available).toHaveLength(4) // 09:00, 09:30, 10:00, 10:30
    })

    it('each available slot has correct 15-minute duration', () => {
      const slots = generateTimeSlots(testDate, '09:00', '10:00', 15, 0, [])
      const available = slots.filter((s) => s.slotType === 'available')
      for (const slot of available) {
        const durationMin = (slot.endTime.getTime() - slot.startTime.getTime()) / 60000
        expect(durationMin).toBe(15)
      }
    })
  })

  // =========================================================================
  // 8. Harmonic Score — Decay Curve
  // =========================================================================
  describe('harmonic score decay curve', () => {
    it('returns 90 for 2-hour difference (within 1-4 hour band)', () => {
      const a = new Date('2026-03-15T10:00:00')
      const b = new Date('2026-03-15T12:00:00')
      expect(calculateHarmonicScore(a, b)).toBe(90)
    })

    it('returns 70 for 12-hour difference (within same-day band)', () => {
      const a = new Date('2026-03-15T06:00:00')
      const b = new Date('2026-03-15T18:00:00')
      expect(calculateHarmonicScore(a, b)).toBe(70)
    })

    it('returns 50 for 36-hour difference (next-day band)', () => {
      const a = new Date('2026-03-15T10:00:00')
      const b = new Date('2026-03-16T22:00:00')
      expect(calculateHarmonicScore(a, b)).toBe(50)
    })

    it('score decreases monotonically as time difference increases', () => {
      const base = new Date('2026-03-15T10:00:00')
      const diffs = [0.5, 2, 12, 36, 72, 168] // hours
      const scores = diffs.map((h) =>
        calculateHarmonicScore(base, new Date(base.getTime() + h * 3600000)),
      )
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
      }
    })
  })
})
