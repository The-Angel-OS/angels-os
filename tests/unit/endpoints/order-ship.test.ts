import { describe, it, expect, vi, beforeEach } from 'vitest'
import { membershipFindFor } from './_managerMemberships'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockValidateTransition = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/orderRoutingEngine', () => ({ validateFulfillmentTransition: mockValidateTransition }))

import { orderShipHandler } from '@/endpoints/order-ship'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_USER = { id: 10, tenants: [{ tenant: { id: 1 } }], roles: [] }

const DEFAULT_ORDER = {
  id: 42,
  fulfillment: [
    {
      orderItemIndex: 0,
      fulfillmentStatus: 'in_production',
      assignedHolon: { id: 99 },
    },
  ],
  items: [{ price: 100 }],
}

const DEFAULT_HOLON = { id: 99, tenant: { id: 1 } }

function makeReq(
  body: Record<string, unknown> | null,
  user: Record<string, unknown> | null = DEFAULT_USER,
  payloadOverrides: Record<string, unknown> = {},
) {
  const findByID = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
    if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON)
    return Promise.reject(new Error(`Unknown collection: ${collection}`))
  })

  const payload = {
    find: membershipFindFor(user),
    findByID,
    update: vi.fn().mockResolvedValue({}),
    ...payloadOverrides,
  }

  const nativeReq = new Request('http://localhost/api/orders/ship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })

  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('orderShipHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockValidateTransition.mockReturnValue(true)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0, trackingNumber: 'TRACK123' }, null)
    const res = await orderShipHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ itemIndex: 0, trackingNumber: 'TRACK123' })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/orderId is required/i)
  })

  it('returns 400 when itemIndex is missing', async () => {
    const req = makeReq({ orderId: 42, trackingNumber: 'TRACK123' })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/itemIndex is required/i)
  })

  it('returns 400 when trackingNumber is missing', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0 })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/trackingNumber is required/i)
  })

  it('returns 400 when trackingNumber is not a string (e.g. 42)', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0, trackingNumber: 42 })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/trackingNumber is required/i)
  })

  it('returns 404 when order not found', async () => {
    const req = makeReq(
      { orderId: 42, itemIndex: 0, trackingNumber: 'TRACK123' },
      DEFAULT_USER,
      {
        findByID: vi.fn().mockRejectedValue(new Error('Not found')),
        update: vi.fn().mockResolvedValue({}),
      },
    )
    const res = await orderShipHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/order not found/i)
  })

  it('returns 400 when no fulfillment entry matches itemIndex', async () => {
    const orderWithNoMatch = {
      ...DEFAULT_ORDER,
      fulfillment: [
        {
          orderItemIndex: 5,
          fulfillmentStatus: 'in_production',
          assignedHolon: { id: 99 },
        },
      ],
    }
    const req = makeReq(
      { orderId: 42, itemIndex: 0, trackingNumber: 'TRACK123' },
      DEFAULT_USER,
      {
        findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
          if (collection === 'orders') return Promise.resolve(orderWithNoMatch)
          if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON)
          return Promise.reject(new Error('Not found'))
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    )
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no fulfillment assignment found/i)
  })

  it('returns 400 when validateFulfillmentTransition returns false', async () => {
    mockValidateTransition.mockReturnValue(false)
    const req = makeReq({ orderId: 42, itemIndex: 0, trackingNumber: 'TRACK123' })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cannot ship from/i)
  })

  it("returns 403 when user tenant doesn't own the holon", async () => {
    const holonOtherTenant = { id: 99, tenant: { id: 999 } }
    const req = makeReq(
      { orderId: 42, itemIndex: 0, trackingNumber: 'TRACK123' },
      DEFAULT_USER,
      {
        findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
          if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
          if (collection === 'holon-capabilities') return Promise.resolve(holonOtherTenant)
          return Promise.reject(new Error('Not found'))
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    )
    const res = await orderShipHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/only the assigned vendor/i)
  })

  it('returns 200 on success with trackingNumber, shippedAt, and success:true', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0, trackingNumber: 'TRACK-XYZ-789' })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.trackingNumber).toBe('TRACK-XYZ-789')
    expect(body.shippedAt).toBeDefined()
    expect(new Date(body.shippedAt).getTime()).not.toBeNaN()
    expect(body.message).toMatch(/marked as shipped/i)
  })

  it('passes trackingUrl through to response when provided', async () => {
    const req = makeReq({
      orderId: 42,
      itemIndex: 0,
      trackingNumber: 'TRACK-XYZ-789',
      trackingUrl: 'https://shipping.example.com/track/TRACK-XYZ-789',
    })
    const res = await orderShipHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.trackingUrl).toBe('https://shipping.example.com/track/TRACK-XYZ-789')
  })
})
