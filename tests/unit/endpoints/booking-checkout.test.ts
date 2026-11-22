/**
 * Booking Checkout Endpoint — Unit Tests (Dual-Rail Hosted Deposit)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
  logCaughtError: vi.fn(async () => {}),
}))

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockGetBillingMode = vi.hoisted(() => vi.fn(async () => 'connect' as const))
const mockResolveConnectedSquare = vi.hoisted(() => vi.fn())
const mockGetAvailableProviders = vi.hoisted(() => vi.fn())
const mockResolveProvider = vi.hoisted(() => vi.fn(async () => 'square' as const))
const mockStartHostedCheckout = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/billingMode', () => ({ getBillingMode: mockGetBillingMode }))
vi.mock('@/lib/payments/config', () => ({
  generateCheckoutRef: () => 'ref_booking_test_123',
}))
vi.mock('@/lib/payments/registry', () => ({
  resolveConnectedSquareForTenant: mockResolveConnectedSquare,
  getAvailableProviders: mockGetAvailableProviders,
  resolveProvider: mockResolveProvider,
  startHostedCheckout: mockStartHostedCheckout,
}))
vi.mock('@/utilities/resolveBookingProvider', () => ({
  resolveBookingProvider: vi.fn(async () => 42),
  providerWhere: vi.fn(() => ({ provider: { equals: 42 } })),
  matchesProvider: vi.fn(() => true),
}))
vi.mock('@/utilities/bookingSettings', () => ({
  getBookingPaymentMode: vi.fn(async () => 'deposit'),
}))
vi.mock('@/utilities/bookingEngine', () => ({
  BookingEngine: vi.fn().mockImplementation(() => ({
    checkBookingConflicts: vi.fn(async () => ({ hasConflict: false, conflicts: [] })),
  })),
}))
vi.mock('@/utilities/ensureTenantMembership', () => ({
  ensureTenantMembership: vi.fn(async () => {}),
}))

import { bookingCheckoutHandler } from '@/endpoints/booking-checkout'

const FAKE_TENANT = { id: 1, name: 'Clearwater', slug: 'clearwater-cruisin' }
const VALID_BODY = { date: '2025-06-15', time: '10:00', serviceId: 'pressure-washing-house' }

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants') return Promise.resolve({ docs: [FAKE_TENANT], totalDocs: 1 })
      if (collection === 'endeavors')
        return Promise.resolve({ docs: [{ id: 10, name: 'Clearwater Endeavor' }], totalDocs: 1 })
      if (collection === 'tenant-memberships')
        return Promise.resolve({
          docs: [{ id: 99, user: { id: 7 }, role: 'tenant_admin', status: 'active' }],
          totalDocs: 1,
        })
      return Promise.resolve({ docs: [], totalDocs: 0 })
    }),
    create: vi.fn().mockResolvedValue({ id: 50 }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, email: 'client@test.com' },
  body: Record<string, unknown> | null = VALID_BODY,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/bookings/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'clearwater-cruisin' },
    body: body !== null ? JSON.stringify(body) : 'INVALID{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

describe('bookingCheckoutHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockGetBillingMode.mockResolvedValue('connect')
    mockResolveConnectedSquare.mockResolvedValue({
      merchantId: 'SQ_M_1',
      locationId: 'SQ_L_1',
      environment: 'sandbox',
      accessToken: 'tok_sq_1',
      connectedAt: '2026-11-22T00:00:00Z',
    })
    mockGetAvailableProviders.mockResolvedValue({
      providers: [{ id: 'square' }],
      defaultProvider: 'square',
      hasConnectedSquare: true,
    })
    mockResolveProvider.mockResolvedValue('square')
    mockStartHostedCheckout.mockResolvedValue({
      provider: 'square',
      environment: 'sandbox',
      checkoutUrl: 'https://square.link/u/bk_50',
      externalId: 'SQ_ORD_50',
      ref: 'ref_booking_test_123',
    })
  })

  it('returns 401 when no user', async () => {
    const res = await bookingCheckoutHandler(makeReq(null))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const res = await bookingCheckoutHandler(makeReq())
    expect(res.status).toBe(429)
  })

  it('returns 400 for missing date, time, serviceId, or unknown service', async () => {
    expect((await bookingCheckoutHandler(makeReq({ id: 1 }, null))).status).toBe(400)
    expect((await bookingCheckoutHandler(makeReq({ id: 1 }, { time: '10:00', serviceId: 'x' }))).status).toBe(400)
    expect((await bookingCheckoutHandler(makeReq({ id: 1 }, { date: '2025-06-15', serviceId: 'x' }))).status).toBe(400)
    expect((await bookingCheckoutHandler(makeReq({ id: 1 }, { date: '2025-06-15', time: '10:00' }))).status).toBe(400)
    expect(
      (
        await bookingCheckoutHandler(
          makeReq({ id: 1 }, { date: '2025-06-15', time: '10:00', serviceId: 'nope' }),
        )
      ).status,
    ).toBe(400)
  })

  it('returns 404 when tenant not found', async () => {
    const res = await bookingCheckoutHandler(
      makeReq({ id: 1, email: 'user@test.com' }, VALID_BODY, {
        find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('takes booking as COD request when connect tenant has no connected Square or platform-direct rail', async () => {
    mockResolveConnectedSquare.mockResolvedValue(null)
    mockGetAvailableProviders.mockResolvedValue({
      providers: [],
      defaultProvider: null,
      hasConnectedSquare: false,
    })

    const res = await bookingCheckoutHandler(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requested).toBe(true)
    expect(body.depositCents).toBe(0)
    expect(body.checkoutUrl).toBeUndefined()
  })

  it('creates pending booking and starts hosted checkout for deposit (20% of $249 = $49.80)', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 77 })
    const res = await bookingCheckoutHandler(
      makeReq({ id: 1, email: 'client@test.com' }, VALID_BODY, { create: createMock }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      checkoutUrl: 'https://square.link/u/bk_50',
      provider: 'square',
      ref: 'ref_booking_test_123',
      bookingId: 77,
      depositCents: 4980,
      totalCents: 24900,
      balanceCents: 19920,
    })

    expect(createMock.mock.calls[0]![0]).toMatchObject({
      collection: 'bookings',
      data: expect.objectContaining({ status: 'pending' }),
    })
    expect(mockStartHostedCheckout).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'booking',
        amountCents: 4980,
        chargeModel: 'direct',
      }),
    )
  })
})
