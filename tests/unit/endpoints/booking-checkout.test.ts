/**
 * Booking Checkout Endpoint — Unit Tests
 *
 * POST /api/bookings/checkout
 * Auth required. Rate limited. Creates a Stripe PaymentIntent for a booking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// logError lazy-imports @payload-config (boots Payload against a live DB) —
// unmocked, error-path tests hang to the 30s timeout instead of asserting.
vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
  logCaughtError: vi.fn(async () => {}),
}))

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockGetApplicationFee = vi.hoisted(() => vi.fn().mockReturnValue(2000))

const mockCustomersList = vi.hoisted(() => vi.fn().mockResolvedValue({ data: [] }))
const mockCustomersCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'cus_test123' }),
)
const mockPaymentIntentsCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 'pi_test123',
    client_secret: 'pi_test123_secret_abc',
  }),
)

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/lib/stripe-connect-config', () => ({
  getStripeApplicationFeeCents: mockGetApplicationFee,
}))
// The endpoint grew a booking-provider spine + payment-mode setting + conflict
// guard after these tests were written — stub them so the checkout flow under
// test is reachable (provider 42, deposit mode, no slot conflicts).
vi.mock('@/utilities/resolveBookingProvider', () => ({
  resolveBookingProvider: vi.fn(async () => 42),
}))
vi.mock('@/utilities/bookingSettings', () => ({
  getBookingPaymentMode: vi.fn(async () => 'deposit'),
}))
vi.mock('@/utilities/bookingEngine', () => ({
  BookingEngine: vi.fn().mockImplementation(() => ({
    checkBookingConflicts: vi.fn(async () => ({ hasConflict: false, conflicts: [] })),
  })),
}))
vi.mock('stripe', () => ({
  default: vi.fn().mockReturnValue({
    customers: { list: mockCustomersList, create: mockCustomersCreate },
    paymentIntents: { create: mockPaymentIntentsCreate },
  }),
}))

import { bookingCheckoutHandler } from '@/endpoints/booking-checkout'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_TENANT = {
  // slug must match a tenant in the bookable-service catalog (src/config/bookableServices.ts)
  id: 1, name: 'Clearwater', slug: 'clearwater-cruisin',
  stripeConnect: { stripeAccountId: 'acct_test123', stripeChargesEnabled: true },
}
// serviceId is required and must exist in the catalog; pressure-washing-house = $249, 20% deposit
const VALID_BODY = { date: '2025-06-15', time: '10:00', serviceId: 'pressure-washing-house' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants') return Promise.resolve({ docs: [FAKE_TENANT], totalDocs: 1 })
      if (collection === 'endeavors') return Promise.resolve({ docs: [{ id: 10, name: 'Clearwater Endeavor' }], totalDocs: 1 })
      // resolveBookingProvider → first active tenant_admin membership
      if (collection === 'tenant-memberships')
        return Promise.resolve({ docs: [{ id: 99, user: { id: 7 }, role: 'tenant_admin', status: 'active' }], totalDocs: 1 })
      // BookingEngine.checkBookingConflicts → no existing bookings = no conflict
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
  headerOverrides: Record<string, string> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': 'clearwater-cruisin',
    ...headerOverrides,
  }
  const nativeReq = new Request('http://localhost/api/bookings/checkout', {
    method: 'POST',
    headers,
    body: body !== null ? JSON.stringify(body) : 'INVALID{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('bookingCheckoutHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockCustomersList.mockResolvedValue({ data: [] })
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test123' })
    mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_test123', client_secret: 'pi_test123_secret_abc' })
    mockGetApplicationFee.mockReturnValue(2000)
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const req = makeReq()
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, null)
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when date is missing', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, { time: '10:00' })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/date is required/i)
  })

  it('returns 400 when time is missing', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, { date: '2025-06-15' })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/time is required/i)
  })

  it('returns 404 when tenant not found', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, VALID_BODY, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/tenant not found/i)
  })

  it('returns 400 when tenant has no Stripe Connect setup', async () => {
    const tenantNoStripe = { ...FAKE_TENANT, stripeConnect: null }
    const req = makeReq({ id: 1, email: 'user@test.com' }, VALID_BODY, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants') return Promise.resolve({ docs: [tenantNoStripe], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not set up payments/i)
  })

  it('returns 400 when Stripe charges are not enabled', async () => {
    const tenantChargesDisabled = { ...FAKE_TENANT, stripeConnect: { stripeAccountId: 'acct_test', stripeChargesEnabled: false } }
    const req = makeReq({ id: 1, email: 'user@test.com' }, VALID_BODY, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants') return Promise.resolve({ docs: [tenantChargesDisabled], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when serviceId is missing', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, { date: '2025-06-15', time: '10:00' })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/serviceId is required/i)
  })

  it('returns 400 for an unknown serviceId', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, { date: '2025-06-15', time: '10:00', serviceId: 'nope' })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown service/i)
  })

  it('returns 400 when date/time combination is invalid', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, { date: '2025-99-99', time: '10:00', serviceId: 'pressure-washing-house' })
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid date/i)
  })

  it('charges only the deposit (20% of $249 = $49.80) and returns deposit/total', async () => {
    const req = makeReq()
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.depositCents).toBe(4980)
    expect(body.totalCents).toBe(24900)
    expect(body.balanceCents).toBe(19920)
    // PaymentIntent amount must be the deposit, not the full price
    expect(mockPaymentIntentsCreate.mock.calls[0][0].amount).toBe(4980)
  })

  it('returns 200 with clientSecret on success', async () => {
    const req = makeReq()
    const res = await bookingCheckoutHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_test123_secret_abc')
    expect(body.bookingId).toBe(50)
    expect(body.stripeAccountId).toBe('acct_test123')
    expect(body.currency).toBe('usd')
  })

  it('creates a new Stripe customer when none exists', async () => {
    const req = makeReq()
    await bookingCheckoutHandler(req)
    expect(mockCustomersCreate).toHaveBeenCalledOnce()
    expect(mockCustomersCreate.mock.calls[0][0].email).toBe('client@test.com')
  })

  it('reuses existing Stripe customer when found', async () => {
    mockCustomersList.mockResolvedValue({ data: [{ id: 'cus_existing' }] })
    const req = makeReq()
    await bookingCheckoutHandler(req)
    expect(mockCustomersCreate).not.toHaveBeenCalled()
    expect(mockPaymentIntentsCreate.mock.calls[0][0].customer).toBe('cus_existing')
  })

  it('creates booking record before PaymentIntent', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 77 })
    const req = makeReq({ id: 1, email: 'user@test.com' }, VALID_BODY, { create: createMock })
    await bookingCheckoutHandler(req)
    // First create call is always the booking; additional calls may come from
    // Sprint 42 user propagation (ensureTenantMembership) — that's expected.
    expect(createMock).toHaveBeenCalled()
    const createArgs = createMock.mock.calls[0][0]
    expect(createArgs.collection).toBe('bookings')
    expect(createArgs.data.status).toBe('pending')
  })
})
