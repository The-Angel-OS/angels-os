import { describe, it, expect, vi } from 'vitest'
import { BookingEngine } from '@/utilities/bookingEngine'

/** A provider calendar holding `n` overlapping, still-live bookings. */
function engineWith(n: number, extra: Record<string, unknown>[] = []) {
  const docs = [
    ...Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      title: `Booking ${i + 1}`,
      status: 'confirmed',
      startDateTime: '2026-09-02T09:00:00.000Z',
      endDateTime: '2026-09-02T10:00:00.000Z',
    })),
    ...extra,
  ]
  const payload = { find: vi.fn().mockResolvedValue({ docs }) }
  return new BookingEngine(payload as never)
}

const request = (capacity?: number) => ({
  providerId: '1',
  clientId: '2',
  tenantId: '3',
  startDateTime: new Date('2026-09-02T09:00:00.000Z'),
  duration: 60,
  capacity,
  bookingType: 'service',
  title: 'Test',
  pricing: { amount: 10, currency: 'usd' },
})

describe('checkBookingConflicts — capacity, not presence, closes a slot', () => {
  it('a one-to-one appointment conflicts on the first booking', async () => {
    expect(await engineWith(1).checkBookingConflicts(request())).toHaveLength(1)
  })

  it('an empty slot never conflicts', async () => {
    expect(await engineWith(0).checkBookingConflicts(request(6))).toHaveLength(0)
  })

  it('a six-seat session stays open at five taken', async () => {
    expect(await engineWith(5).checkBookingConflicts(request(6))).toHaveLength(0)
  })

  it('a six-seat session is full at six', async () => {
    expect(await engineWith(6).checkBookingConflicts(request(6))).toHaveLength(6)
  })

  it('capacity 0 or missing is treated as one-to-one, never unlimited', async () => {
    expect(await engineWith(1).checkBookingConflicts(request(0))).toHaveLength(1)
    expect(await engineWith(1).checkBookingConflicts(request(undefined))).toHaveLength(1)
  })

  it('an expired deposit-hold does not consume a seat', async () => {
    const expired = {
      id: 99,
      title: 'Abandoned',
      status: 'pending',
      holdExpiresAt: '2020-01-01T00:00:00.000Z',
      startDateTime: '2026-09-02T09:00:00.000Z',
      endDateTime: '2026-09-02T10:00:00.000Z',
    }
    // Two seats: one real booking + one abandoned hold — still room for one more.
    expect(await engineWith(1, [expired]).checkBookingConflicts(request(2))).toHaveLength(0)
  })
})
