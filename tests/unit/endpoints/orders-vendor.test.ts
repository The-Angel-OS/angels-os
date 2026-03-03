/**
 * Vendor Orders Endpoint — Unit Tests
 *
 * GET /api/orders/vendor
 * Auth required. Returns the vendor's order inbox grouped by status + revenue summary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))

import { ordersVendorHandler } from '@/endpoints/orders-vendor'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_USER = { id: 10, tenants: [{ tenant: { id: 1 } }] }

const DEFAULT_HOLON = { id: 99, tenant: { id: 1 } }

const DEFAULT_ITEMS = [
  { price: 50, product: { id: 5, title: 'Custom T-Shirt' }, quantity: 2 },
]

function makeOrder(fulfillmentStatus: string, holonId: number | object = 99) {
  return {
    id: 42,
    items: DEFAULT_ITEMS,
    fulfillment: [
      {
        orderItemIndex: 0,
        fulfillmentStatus,
        assignedHolon: holonId,
        matchScore: 95,
        matchedAt: '2025-01-01T10:00:00Z',
        acceptedAt: fulfillmentStatus !== 'matched' ? '2025-01-01T11:00:00Z' : undefined,
        shippedAt: ['shipped', 'delivered'].includes(fulfillmentStatus)
          ? '2025-01-02T10:00:00Z'
          : undefined,
        trackingNumber: ['shipped', 'delivered'].includes(fulfillmentStatus) ? 'TRACK123' : undefined,
        designAssets: [],
      },
    ],
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(
  user: Record<string, unknown> | null = DEFAULT_USER,
  payloadOverrides: Record<string, unknown> = {},
) {
  const findMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'holon-capabilities')
      return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
    if (collection === 'orders')
      return Promise.resolve({ docs: [makeOrder('matched')], totalDocs: 1 })
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })

  const payload = { find: findMock, ...payloadOverrides }
  const nativeReq = new Request('http://localhost/api/orders/vendor', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ordersVendorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await ordersVendorHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 when user has no tenants', async () => {
    const req = makeReq({ id: 10, tenants: [] })
    const res = await ordersVendorHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no tenant/i)
  })

  it('returns empty arrays when user has no holons', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [], totalDocs: 0 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.incoming).toEqual([])
    expect(body.active).toEqual([])
    expect(body.completed).toEqual([])
    expect(body.revenue).toEqual({ total: 0, vendorShare: 0, orderCount: 0 })
  })

  it('places matched fulfillment in incoming array', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('matched')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    expect(body.incoming).toHaveLength(1)
    expect(body.active).toHaveLength(0)
    expect(body.completed).toHaveLength(0)
  })

  it('places accepted fulfillment in active array', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('accepted')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    expect(body.incoming).toHaveLength(0)
    expect(body.active).toHaveLength(1)
    expect(body.completed).toHaveLength(0)
  })

  it('places in_production fulfillment in active array', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('in_production')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    expect(body.active).toHaveLength(1)
  })

  it('places shipped fulfillment in completed array', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('shipped')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    expect(body.completed).toHaveLength(1)
    expect(body.incoming).toHaveLength(0)
  })

  it('places delivered fulfillment in completed array', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('delivered')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    expect(body.completed).toHaveLength(1)
  })

  it('accumulates revenue only for completed (shipped/delivered) items', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('shipped')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    // price=50, vendorShare=50*0.6=30
    expect(body.revenue.total).toBe(50)
    expect(body.revenue.vendorShare).toBe(30)
    expect(body.revenue.orderCount).toBe(1)
  })

  it('does not count revenue for non-completed statuses', async () => {
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [makeOrder('matched')], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    expect(body.revenue.total).toBe(0)
    expect(body.revenue.orderCount).toBe(0)
  })

  it('excludes fulfillment entries assigned to other holons', async () => {
    // Order has two fulfillment entries: one for our holon (99), one for another (200)
    const orderWithTwoEntries = {
      id: 42,
      items: [
        { price: 50, product: { title: 'T-Shirt' }, quantity: 1 },
        { price: 80, product: { title: 'Hoodie' }, quantity: 1 },
      ],
      fulfillment: [
        { orderItemIndex: 0, fulfillmentStatus: 'matched', assignedHolon: 99, designAssets: [] },
        { orderItemIndex: 1, fulfillmentStatus: 'matched', assignedHolon: 200, designAssets: [] },
      ],
    }
    const req = makeReq(DEFAULT_USER, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'holon-capabilities') return Promise.resolve({ docs: [DEFAULT_HOLON], totalDocs: 1 })
        if (collection === 'orders') return Promise.resolve({ docs: [orderWithTwoEntries], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    // Only the entry for holon 99 should be included
    expect(body.incoming).toHaveLength(1)
    expect(body.incoming[0].orderItemIndex).toBe(0)
  })

  it('includes correct summary fields in each entry', async () => {
    const req = makeReq()
    const res = await ordersVendorHandler(req)
    const body = await res.json()
    const entry = body.incoming[0]
    expect(entry.orderId).toBe(42)
    expect(entry.orderItemIndex).toBe(0)
    expect(entry.price).toBe(50)
    expect(entry.vendorShare).toBe(30) // 60% of 50
    expect(entry.fulfillmentStatus).toBe('matched')
  })
})
