/**
 * Booking Available Slots Endpoint — Unit Tests
 *
 * Tests for bookingAvailableSlotsHandler (POST /api/bookings/available-slots).
 * Covers: auth, input validation, tenant resolution, slot filtering,
 * BookingEngine delegation, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/utilities/apiRateLimiter', () => ({
  applyRateLimit: vi.fn().mockReturnValue(null),
}))

const mockGetAvailableSlots = vi.fn()

vi.mock('@/utilities/bookingEngine', () => ({
  BookingEngine: vi.fn().mockImplementation(() => ({
    getAvailableSlots: mockGetAvailableSlots,
  })),
}))

// ─── Import handler after mocks ───────────────────────────────────────────────

const { bookingAvailableSlotsHandler } = await import('@/endpoints/booking-available-slots')

// ─── Default mock data ────────────────────────────────────────────────────────

const MOCK_SLOTS = [
  {
    startTime: new Date('2026-03-10T09:00:00Z'),
    endTime: new Date('2026-03-10T10:00:00Z'),
    available: true,
    slotType: 'work_hours',
    bookingId: null,
  },
  {
    startTime: new Date('2026-03-10T10:00:00Z'),
    endTime: new Date('2026-03-10T11:00:00Z'),
    available: false,
    slotType: 'booked',
    bookingId: 'bk-1',
  },
  {
    startTime: new Date('2026-03-10T11:00:00Z'),
    endTime: new Date('2026-03-10T12:00:00Z'),
    available: true,
    slotType: 'work_hours',
    bookingId: null,
  },
]

const DEFAULT_MEMBERSHIPS = {
  docs: [{ id: 'm1', tenant: { id: 99 } }],
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Build a native Request with payload and user attached via Object.assign.
 * @param body             - request body object
 * @param tenantMemberships - override for payload.find return value (defaults to DEFAULT_MEMBERSHIPS)
 */
function makeReq(
  body: Record<string, unknown>,
  tenantMemberships: { docs: unknown[] } = DEFAULT_MEMBERSHIPS,
) {
  const mockPayload = {
    find: vi.fn().mockResolvedValue(tenantMemberships),
  }

  const baseRequest = new Request('http://localhost:3000/api/bookings/available-slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return Object.assign(baseRequest, {
    payload: mockPayload,
    user: { id: 42 },
  })
}

// ─── Reset ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAvailableSlots.mockResolvedValue(MOCK_SLOTS)
})

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('bookingAvailableSlotsHandler', () => {
  // 1. Returns 401 when no user
  it('returns 401 when no user', async () => {
    const baseRequest = new Request('http://localhost:3000/api/bookings/available-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'p1', startDate: '2026-03-10' }),
    })
    const req = Object.assign(baseRequest, {
      payload: { find: vi.fn().mockResolvedValue(DEFAULT_MEMBERSHIPS) },
      user: null,
    })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/authentication/i)
  })

  // 2. Returns 400 when providerId is missing
  it('returns 400 when providerId is missing', async () => {
    const req = makeReq({ startDate: '2026-03-10', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/providerId/i)
  })

  // 3. Returns 400 for invalid startDate
  it('returns 400 for invalid startDate (e.g., "not-a-date")', async () => {
    const req = makeReq({ providerId: 'p1', startDate: 'not-a-date', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/startDate/i)
  })

  // 4. Returns 400 for invalid endDate
  it('returns 400 for invalid endDate', async () => {
    const req = makeReq({ providerId: 'p1', startDate: '2026-03-10', endDate: 'bad-date' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/endDate/i)
  })

  // 5. Returns 400 when no tenant membership found
  it('returns 400 when no tenant membership found (empty docs)', async () => {
    const req = makeReq(
      { providerId: 'p1', startDate: '2026-03-10' },
      { docs: [] }, // empty memberships, no tenantId in body
    )
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/tenant/i)
  })

  // 6. Returns 200 with slots array on success
  it('returns 200 with slots array on success', async () => {
    const req = makeReq({ providerId: 'p1', startDate: '2026-03-10', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.slots)).toBe(true)
  })

  // 7. Response includes correct 'available' count (2 of 3 slots in mock)
  it('response includes correct "available" count (2 of 3 slots in mock)', async () => {
    const req = makeReq({ providerId: 'p1', startDate: '2026-03-10', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.available).toBe(2)
  })

  // 8. Response includes correct 'total' count (3)
  it('response includes correct "total" count (3)', async () => {
    const req = makeReq({ providerId: 'p1', startDate: '2026-03-10', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(3)
  })

  // 9. Slot objects have startTime, endTime, available, slotType, bookingId
  it('slot objects have startTime, endTime, available, slotType, bookingId', async () => {
    const req = makeReq({ providerId: 'p1', startDate: '2026-03-10', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    const slot = data.slots[0]
    expect(slot).toHaveProperty('startTime')
    expect(slot).toHaveProperty('endTime')
    expect(slot).toHaveProperty('available')
    expect(slot).toHaveProperty('slotType')
    expect(slot).toHaveProperty('bookingId')
    // Times should be ISO strings
    expect(typeof slot.startTime).toBe('string')
    expect(typeof slot.endTime).toBe('string')
  })

  // 10. Uses provided tenantId from body when present (not from membership)
  it('uses provided tenantId from body when present (not from membership)', async () => {
    const req = makeReq(
      { providerId: 'p1', startDate: '2026-03-10', tenantId: '777' },
      { docs: [] }, // empty memberships — would fail without body tenantId
    )
    const res = await bookingAvailableSlotsHandler(req as any)
    // Should succeed because tenantId is supplied directly in body
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.query.tenantId).toBe('777')
  })

  // 11. Sets minimum duration of 15 (if duration=5 is passed, uses 15)
  it('sets minimum duration of 15 when duration=5 is passed', async () => {
    const req = makeReq({
      providerId: 'p1',
      startDate: '2026-03-10',
      endDate: '2026-03-13',
      duration: 5,
    })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    // The query.duration should reflect the enforced minimum of 15
    expect(data.query.duration).toBe(15)
    // BookingEngine should have been called with slotDuration: 15
    expect(mockGetAvailableSlots).toHaveBeenCalledWith(
      expect.objectContaining({ slotDuration: 15 }),
    )
  })

  // 12. Returns 500 when BookingEngine.getAvailableSlots throws
  it('returns 500 when BookingEngine.getAvailableSlots throws', async () => {
    mockGetAvailableSlots.mockRejectedValueOnce(new Error('Engine failure'))
    const req = makeReq({ providerId: 'p1', startDate: '2026-03-10', endDate: '2026-03-13' })
    const res = await bookingAvailableSlotsHandler(req as any)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toMatch(/engine failure/i)
  })
})
