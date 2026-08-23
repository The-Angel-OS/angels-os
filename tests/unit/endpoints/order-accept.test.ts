import { describe, it, expect, vi, beforeEach } from 'vitest'
import { membershipFindFor } from './_managerMemberships'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockValidateTransition = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/orderRoutingEngine', () => ({ validateFulfillmentTransition: mockValidateTransition }))

import { orderAcceptHandler } from '@/endpoints/order-accept'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_USER = { id: 10, tenants: [{ tenant: { id: 1 } }], roles: [] }

const DEFAULT_ORDER = {
  id: 42,
  fulfillment: [
    {
      orderItemIndex: 0,
      fulfillmentStatus: 'matched',
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

  const nativeReq = new Request('http://localhost/api/orders/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })

  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('orderAcceptHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockValidateTransition.mockReturnValue(true)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0 }, null)
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ itemIndex: 0 })
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/orderId is required/i)
  })

  it('returns 400 when itemIndex is missing', async () => {
    const req = makeReq({ orderId: 42 })
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/itemIndex is required/i)
  })

  it('returns 400 when estimatedCompletionDate is invalid', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0, estimatedCompletionDate: 'not-a-date' })
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/estimatedCompletionDate must be a valid ISO 8601 date/i)
  })

  it('returns 404 when order not found (findByID throws)', async () => {
    const req = makeReq(
      { orderId: 42, itemIndex: 0 },
      DEFAULT_USER,
      {
        findByID: vi.fn().mockRejectedValue(new Error('Not found')),
        update: vi.fn().mockResolvedValue({}),
      },
    )
    const res = await orderAcceptHandler(req)
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
          fulfillmentStatus: 'matched',
          assignedHolon: { id: 99 },
        },
      ],
    }
    const req = makeReq(
      { orderId: 42, itemIndex: 0 },
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
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no fulfillment assignment found/i)
  })

  it("returns 403 when user's tenant doesn't own the holon (and user is not admin)", async () => {
    const holonOtherTenant = { id: 99, tenant: { id: 999 } }
    const req = makeReq(
      { orderId: 42, itemIndex: 0 },
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
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/you do not have permission/i)
  })

  it('returns 400 when validateFulfillmentTransition returns false (wrong status)', async () => {
    mockValidateTransition.mockReturnValue(false)
    const req = makeReq({ orderId: 42, itemIndex: 0 })
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cannot accept/i)
  })

  it('returns 200 on success with vendorShare = 60% of item price', async () => {
    const req = makeReq({ orderId: 42, itemIndex: 0 })
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.fulfillmentStatus).toBe('accepted')
    // 60% of 100 = 60.00
    expect(body.vendorShare).toBe(60)
    expect(body.message).toMatch(/\$60\.00/)
  })

  it('calls payload.update with the fulfillment update', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(
      { orderId: 42, itemIndex: 0 },
      DEFAULT_USER,
      {
        findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
          if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
          if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON)
          return Promise.reject(new Error('Not found'))
        }),
        update: updateMock,
      },
    )
    await orderAcceptHandler(req)
    expect(updateMock).toHaveBeenCalledOnce()
    const [updateArgs] = updateMock.mock.calls
    expect(updateArgs[0].collection).toBe('orders')
    expect(updateArgs[0].id).toBe(42)
    const updatedFulfillment = updateArgs[0].data.fulfillment as any[]
    expect(updatedFulfillment[0].fulfillmentStatus).toBe('accepted')
    expect(updatedFulfillment[0].acceptedAt).toBeDefined()
  })

  it('admin user (roles: ["admin"]) bypasses tenant check', async () => {
    const adminUser = { id: 77, tenants: [], roles: ['admin'] }
    const holonOtherTenant = { id: 99, tenant: { id: 999 } }
    const req = makeReq(
      { orderId: 42, itemIndex: 0 },
      adminUser,
      {
        findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
          if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
          if (collection === 'holon-capabilities') return Promise.resolve(holonOtherTenant)
          return Promise.reject(new Error('Not found'))
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    )
    const res = await orderAcceptHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
