/**
 * Order Claim Endpoint — Unit Tests
 *
 * POST /api/orders/claim
 * Auth required. Vendor claims a queued Angel Token order for their Holon.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockMatchCapabilities = vi.hoisted(() => vi.fn().mockReturnValue(true))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/orderRoutingEngine', () => ({
  matchCapabilities: mockMatchCapabilities,
  matchMaterials: vi.fn().mockReturnValue(true),
}))

import { orderClaimHandler } from '@/endpoints/order-claim'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_USER = { id: 10 }

const DEFAULT_HOLON = {
  id: 99,
  tenant: { id: 1 },
  capabilities: [{ skill: 'screen-printing', equipment: 'press', materials: ['cotton'] }],
  activeOrderCount: 3,
  businessName: 'Acme Prints',
}

const DEFAULT_ORDER = {
  id: 42,
  items: [
    {
      price: 50,
      product: {
        title: 'Custom T-Shirt',
        requiredCapabilities: [{ skill: 'screen-printing' }],
      },
    },
  ],
  fulfillment: [
    {
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      tokenStatus: 'active',
      angelTokenId: 'tok-001',
    },
  ],
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON)
      if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
      return Promise.resolve(null)
    }),
    find: vi.fn().mockResolvedValue({
      docs: [{ id: 1, user: { id: 10 }, tenant: { id: 1 }, status: 'active', role: 'member' }],
      totalDocs: 1,
    }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  body: Record<string, unknown> | null = { orderId: 42, orderItemIndex: 0, holonId: 99 },
  user: Record<string, unknown> | null = DEFAULT_USER,
  payloadOverrides: Record<string, unknown> = {},
) {
  const nativeReq = new Request('http://localhost/api/orders/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload: makePayload(payloadOverrides) }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('orderClaimHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockMatchCapabilities.mockReturnValue(true)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 }, null)
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ orderItemIndex: 0, holonId: 99 })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 400 when orderItemIndex is missing', async () => {
    const req = makeReq({ orderId: 42, holonId: 99 })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 400 when holonId is missing', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 0 })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 404 when holon not found', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 999 }, DEFAULT_USER, {
      findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.reject(new Error('Not found'))
        return Promise.resolve(DEFAULT_ORDER)
      }),
    })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(500) // catch block — findByID throws, not returns null
  })

  it('returns 403 when user is not a member of the holon tenant', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 }, DEFAULT_USER, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/not a member/i)
  })

  it('returns 404 when no fulfillment entry matches orderItemIndex', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 5, holonId: 99 })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/no fulfillment entry/i)
  })

  it('returns 409 when fulfillment item is no longer available (already claimed)', async () => {
    const claimedOrder = {
      ...DEFAULT_ORDER,
      fulfillment: [{ ...DEFAULT_ORDER.fulfillment[0], fulfillmentStatus: 'matched', tokenStatus: 'active' }],
    }
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 }, DEFAULT_USER, {
      findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON)
        if (collection === 'orders') return Promise.resolve(claimedOrder)
        return Promise.resolve(null)
      }),
    })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/no longer available/i)
  })

  it('returns 400 when holon capabilities do not match required skills', async () => {
    mockMatchCapabilities.mockReturnValue(false)
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required capabilities/i)
  })

  it('returns 200 on success with angelTokenId and productTitle', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.angelTokenId).toBe('tok-001')
    expect(body.productTitle).toBe('Custom T-Shirt')
  })

  it('success message includes orderId and holon businessName', async () => {
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 })
    const res = await orderClaimHandler(req)
    const body = await res.json()
    expect(body.message).toContain('42')
    expect(body.message).toContain('Acme Prints')
  })

  it('calls payload.update twice: once for order and once for holon activeOrderCount', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({})
    const req = makeReq({ orderId: 42, orderItemIndex: 0, holonId: 99 }, DEFAULT_USER, {
      update: mockUpdate,
    })
    const res = await orderClaimHandler(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    // First call: update order fulfillment
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({
      collection: 'orders',
      id: 42,
    })
    // Second call: increment holon activeOrderCount (3 + 1 = 4)
    expect(mockUpdate.mock.calls[1][0]).toMatchObject({
      collection: 'holon-capabilities',
      id: 99,
      data: { activeOrderCount: 4 },
    })
  })
})
