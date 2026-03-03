/**
 * Claimable Orders Endpoint — Unit Tests
 *
 * GET /api/orders/claimable
 * Auth required. Returns Angel Token orders matching the vendor's Holon capabilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockMatchCapabilities = vi.hoisted(() => vi.fn().mockReturnValue(true))
const mockMatchMaterials = vi.hoisted(() => vi.fn().mockReturnValue(true))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/orderRoutingEngine', () => ({
  matchCapabilities: mockMatchCapabilities,
  matchMaterials: mockMatchMaterials,
}))

import { ordersClaimableHandler } from '@/endpoints/orders-claimable'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_MEMBERSHIP = { id: 1, tenant: { id: 10 }, status: 'active' }

const DEFAULT_HOLON = {
  id: 99,
  tenant: { id: 10 },
  acceptingOrders: true,
  constitutionalCompliance: true,
  capabilities: [{ skill: 'screen-printing', equipment: 'press', materials: ['cotton'] }],
}

const DEFAULT_ORDER = {
  id: 42,
  items: [
    {
      price: 50,
      product: {
        title: 'Custom T-Shirt',
        requiredCapabilities: [{ skill: 'screen-printing', materials: ['cotton'] }],
      },
    },
  ],
  fulfillment: [
    {
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      tokenStatus: 'active',
      angelTokenId: 'tok-001',
      queuedAt: '2025-01-01T10:00:00Z',
      queueReason: 'No auto-match found',
    },
  ],
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(
  user: Record<string, unknown> | null = { id: 10 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const findMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'tenant-memberships')
      return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
    if (collection === 'holon-capabilities')
      return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
    if (collection === 'orders')
      return Promise.resolve({ docs: [DEFAULT_ORDER], totalDocs: 1 })
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })

  const payload = { find: findMock, ...payloadOverrides }
  const nativeReq = new Request('http://localhost/api/orders/claimable', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ordersClaimableHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockMatchCapabilities.mockReturnValue(true)
    mockMatchMaterials.mockReturnValue(true)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await ordersClaimableHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 200 with empty claimable + message when user has no tenant memberships', async () => {
    const req = makeReq({ id: 10 }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships') return Promise.resolve({ docs: [], totalDocs: 0 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersClaimableHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.claimable).toEqual([])
    expect(body.message).toMatch(/no tenant memberships/i)
  })

  it('returns 200 with empty claimable + message when user has no holons', async () => {
    const req = makeReq({ id: 10 }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships')
          return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
        if (collection === 'holon-capabilities')
          return Promise.resolve({ docs: [], totalDocs: 0 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersClaimableHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.claimable).toEqual([])
    expect(body.message).toMatch(/no active holons/i)
  })

  it('returns 200 with matching orders when capabilities match', async () => {
    const req = makeReq()
    const res = await ordersClaimableHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.claimable).toHaveLength(1)
    expect(body.totalAvailable).toBe(1)
  })

  it('includes correct fields in each claimable entry', async () => {
    const req = makeReq()
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    const entry = body.claimable[0]
    expect(entry.orderId).toBe(42)
    expect(entry.orderItemIndex).toBe(0)
    expect(entry.productTitle).toBe('Custom T-Shirt')
    expect(entry.angelTokenId).toBe('tok-001')
    expect(entry.price).toBe(50)
    expect(entry.requiredSkills).toContain('screen-printing')
  })

  it('calculates vendorShare as 60% of price', async () => {
    const req = makeReq()
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    // 60% of 50 = 30
    expect(body.claimable[0].vendorShare).toBe(30)
  })

  it('calculates totalVendorRevenue as sum of all vendorShares', async () => {
    const req = makeReq()
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    expect(body.totalVendorRevenue).toBe(30)
  })

  it('returns empty claimable when matchCapabilities returns false', async () => {
    mockMatchCapabilities.mockReturnValue(false)
    const req = makeReq()
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    expect(body.claimable).toEqual([])
    expect(body.totalAvailable).toBe(0)
  })

  it('skips fulfillment entries without queuedAt', async () => {
    const orderNoQueuedAt = {
      ...DEFAULT_ORDER,
      fulfillment: [
        {
          orderItemIndex: 0,
          fulfillmentStatus: 'pending_match',
          tokenStatus: 'active',
          angelTokenId: 'tok-002',
          // queuedAt intentionally absent
        },
      ],
    }
    const req = makeReq({ id: 10 }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships')
          return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
        if (collection === 'holon-capabilities')
          return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders')
          return Promise.resolve({ docs: [orderNoQueuedAt], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    expect(body.claimable).toEqual([])
  })

  it('builds configurationSummary from selectedConfiguration fields', async () => {
    const orderWithConfig = {
      ...DEFAULT_ORDER,
      fulfillment: [
        {
          ...DEFAULT_ORDER.fulfillment[0],
          selectedConfiguration: { color: 'Red', size: 'M', customText: 'Hello' },
        },
      ],
    }
    const req = makeReq({ id: 10 }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships')
          return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
        if (collection === 'holon-capabilities')
          return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders')
          return Promise.resolve({ docs: [orderWithConfig], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    expect(body.claimable[0].configurationSummary).toContain('Color: Red')
    expect(body.claimable[0].configurationSummary).toContain('Size: M')
    expect(body.claimable[0].configurationSummary).toContain('Custom text: Yes')
  })

  it('sorts results by queuedAt ascending (FIFO)', async () => {
    const orderEarly = {
      id: 41,
      items: DEFAULT_ORDER.items,
      fulfillment: [{ ...DEFAULT_ORDER.fulfillment[0], queuedAt: '2025-01-01T08:00:00Z', angelTokenId: 'tok-early' }],
    }
    const orderLate = {
      id: 42,
      items: DEFAULT_ORDER.items,
      fulfillment: [{ ...DEFAULT_ORDER.fulfillment[0], queuedAt: '2025-01-01T12:00:00Z', angelTokenId: 'tok-late' }],
    }
    const req = makeReq({ id: 10 }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships')
          return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
        if (collection === 'holon-capabilities')
          return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders')
          return Promise.resolve({ docs: [orderLate, orderEarly], totalDocs: 2 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersClaimableHandler(req)
    const body = await res.json()
    expect(body.claimable).toHaveLength(2)
    expect(body.claimable[0].angelTokenId).toBe('tok-early')
    expect(body.claimable[1].angelTokenId).toBe('tok-late')
  })

  it('returns 500 when payload.find throws', async () => {
    const req = makeReq({ id: 10 }, {
      find: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    })
    const res = await ordersClaimableHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to fetch claimable orders/i)
  })
})
