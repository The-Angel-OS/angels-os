import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockRefundsCreate = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    refunds: { create: mockRefundsCreate },
  })),
}))

import { orderCancelHandler } from '@/endpoints/order-cancel'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_USER = { id: 20 }

const DEFAULT_ORDER = {
  id: 1,
  orderedBy: { id: 20 },
  stripePaymentIntentID: 'pi_abc123',
  items: [{ price: 50 }],
  fulfillment: [
    {
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      angelTokenId: 'AT-1',
    },
  ],
}

function makeReq(
  body: Record<string, unknown> | null,
  user: Record<string, unknown> | null = DEFAULT_USER,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = {
    findByID: vi.fn().mockResolvedValue(DEFAULT_ORDER),
    update: vi.fn().mockResolvedValue({}),
    ...payloadOverrides,
  }

  const nativeReq = new Request('http://localhost/api/orders/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })

  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('orderCancelHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockApplyRateLimit.mockReturnValue(null)
    mockRefundsCreate.mockResolvedValue({ id: 're_test123' })
  })

  it('returns 401 when no user', async () => {
    const req = makeReq({ orderId: 1, orderItemIndex: 0 }, null)
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ orderItemIndex: 0 })
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/orderId and orderItemIndex are required/i)
  })

  it('returns 400 when orderItemIndex is missing', async () => {
    const req = makeReq({ orderId: 1 })
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/orderId and orderItemIndex are required/i)
  })

  it('returns 403 when requester is not the order owner', async () => {
    const otherUser = { id: 99 }
    const req = makeReq({ orderId: 1, orderItemIndex: 0 }, otherUser)
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/cancel your own orders/i)
  })

  it('returns 404 when no fulfillment entry matches orderItemIndex', async () => {
    const orderWithNoMatch = {
      ...DEFAULT_ORDER,
      fulfillment: [
        {
          orderItemIndex: 5,
          fulfillmentStatus: 'pending_match',
          angelTokenId: 'AT-1',
        },
      ],
    }
    const req = makeReq(
      { orderId: 1, orderItemIndex: 0 },
      DEFAULT_USER,
      { findByID: vi.fn().mockResolvedValue(orderWithNoMatch), update: vi.fn().mockResolvedValue({}) },
    )
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/no fulfillment entry found/i)
  })

  it('returns 409 when fulfillment status is not pending_match', async () => {
    const matchedOrder = {
      ...DEFAULT_ORDER,
      fulfillment: [
        {
          orderItemIndex: 0,
          fulfillmentStatus: 'matched',
          angelTokenId: 'AT-1',
        },
      ],
    }
    const req = makeReq(
      { orderId: 1, orderItemIndex: 0 },
      DEFAULT_USER,
      { findByID: vi.fn().mockResolvedValue(matchedOrder), update: vi.fn().mockResolvedValue({}) },
    )
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/cannot cancel/i)
  })

  it('returns 200 on success when STRIPE_SECRET_KEY is not set (no refund, stripeRefundId: null)', async () => {
    // Explicitly clear STRIPE_SECRET_KEY — the real .env may have it set
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const req = makeReq({ orderId: 1, orderItemIndex: 0 })
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.stripeRefundId).toBeNull()
    expect(mockRefundsCreate).not.toHaveBeenCalled()
  })

  it('returns 200 on success with Stripe refund when STRIPE_SECRET_KEY is set (stripeRefundId not null)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_key')
    const req = makeReq({ orderId: 1, orderItemIndex: 0 })
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.stripeRefundId).toBe('re_test123')
  })

  it('calls stripe.refunds.create with the correct payment intent and amount in cents', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_key')
    const req = makeReq({ orderId: 1, orderItemIndex: 0 })
    await orderCancelHandler(req)
    expect(mockRefundsCreate).toHaveBeenCalledOnce()
    const [args] = mockRefundsCreate.mock.calls
    expect(args[0].payment_intent).toBe('pi_abc123')
    // item price is 50, so refund amount = 50 * 100 = 5000 cents
    expect(args[0].amount).toBe(5000)
    expect(args[0].reason).toBe('requested_by_customer')
  })

  it('still returns 200 even when Stripe refund throws (graceful degradation)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_key')
    mockRefundsCreate.mockRejectedValue(new Error('Stripe network error'))
    const req = makeReq({ orderId: 1, orderItemIndex: 0 })
    const res = await orderCancelHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    // Stripe failed so refund ID should be null
    expect(body.stripeRefundId).toBeNull()
  })
})
