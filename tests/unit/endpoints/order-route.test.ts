/**
 * Order Route Endpoint — Unit Tests
 *
 * POST /api/orders/route
 * Auth required. Routes order items to best-matched vendor, or queues as
 * Angel Tokens when no matching Holon exists.
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
const mockFindMatchingHolons = vi.hoisted(() => vi.fn())
const mockCreateAngelTokenEntry = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    orderItemIndex: 0,
    fulfillmentStatus: 'pending_match',
    tokenStatus: 'active',
    angelTokenId: 'tok-generated',
    queuedAt: '2025-01-01T00:00:00Z',
    queueReason: 'Waiting for maker',
  }),
)

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/orderRoutingEngine', () => ({
  findMatchingHolons: mockFindMatchingHolons,
}))
vi.mock('@/utilities/angelTokens', () => ({
  createAngelTokenEntry: mockCreateAngelTokenEntry,
}))

import { orderRouteHandler } from '@/endpoints/order-route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_ORDER = {
  id: 42,
  orderedBy: { id: 10 },
  items: [
    {
      product: {
        title: 'Custom T-Shirt',
        requiredCapabilities: [{ skill: 'screen-printing', equipment: 'press', materials: ['cotton'] }],
      },
    },
  ],
  fulfillment: [],
}

const DEFAULT_HOLON_DOC = {
  id: 5,
  tenant: { id: 1 },
  businessName: 'Print Shop Co.',
  acceptingOrders: true,
  constitutionalCompliance: true,
  capabilities: [{ skill: 'screen-printing', equipment: 'press', materials: ['cotton'] }],
  rating: 90,
  activeOrderCount: 1,
}

const DEFAULT_MATCH = {
  holon: { id: 5, tenantId: 1, businessName: 'Print Shop Co.' },
  totalScore: 85.5,
  distance: 12.3,
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  const findByIDMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
    if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON_DOC)
    return Promise.resolve(null)
  })

  return {
    findByID: findByIDMock,
    find: vi.fn().mockResolvedValue({ docs: [DEFAULT_HOLON_DOC], totalDocs: 1 }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 10 },
  body: Record<string, unknown> | null = { orderId: 42 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/orders/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('orderRouteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockFindMatchingHolons.mockReturnValue([DEFAULT_MATCH])
    mockCreateAngelTokenEntry.mockReturnValue({
      orderItemIndex: 0,
      fulfillmentStatus: 'pending_match',
      tokenStatus: 'active',
      angelTokenId: 'tok-generated',
      queuedAt: '2025-01-01T00:00:00Z',
      queueReason: 'Waiting for maker',
    })
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 10 }, null)
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ id: 10 }, {})
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/orderId is required/i)
  })

  it('returns 404 when order not found (findByID throws)', async () => {
    const req = makeReq({ id: 10 }, { orderId: 99 }, {
      findByID: vi.fn().mockRejectedValue(new Error('Not Found')),
    })
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/order not found/i)
  })

  it('returns 403 when user is not the order owner', async () => {
    const req = makeReq({ id: 999 }, { orderId: 42 }) // id 999 ≠ orderedBy.id 10
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/do not have permission/i)
  })

  it('allows admin to route any order', async () => {
    const req = makeReq({ id: 999, roles: ['admin'] }, { orderId: 42 })
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 when order has no items to route', async () => {
    const req = makeReq({ id: 10 }, { orderId: 42 }, {
      findByID: vi.fn().mockResolvedValue({ ...DEFAULT_ORDER, items: [] }),
    })
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no items to route/i)
  })

  it('directly assigns preferredHolonId when provided', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq({ id: 10 }, { orderId: 42, preferredHolonId: 5 }, {
      findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
        if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON_DOC)
        return Promise.resolve(null)
      }),
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      update: updateMock,
    })
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.assignedHolon).toBe(5)
    expect(body.matchScore).toBe(100)
    expect(updateMock).toHaveBeenCalledOnce()
  })

  it('issues Angel Token when no matching holons found', async () => {
    mockFindMatchingHolons.mockReturnValue([]) // no matches
    const req = makeReq()
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queued).toBe(true)
    expect(body.angelTokenIds).toContain('tok-generated')
    expect(body.message).toMatch(/queued as angel token/i)
  })

  it('assigns best matching holon when matches found', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq({ id: 10 }, { orderId: 42 }, { update: updateMock })
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.assignedHolon).toBe(5)
    expect(body.matchScore).toBe(86) // Math.round(85.5)
    expect(body.message).toMatch(/print shop co/i)
  })

  it('includes alternatives list in auto-route response', async () => {
    const alt = { holon: { id: 6, businessName: 'Alt Shop' }, totalScore: 70, distance: 25 }
    mockFindMatchingHolons.mockReturnValue([DEFAULT_MATCH, alt])
    const req = makeReq()
    const res = await orderRouteHandler(req)
    const body = await res.json()
    expect(body.alternatives).toHaveLength(1)
    expect(body.alternatives[0].holonId).toBe(6)
  })

  it('returns 500 when auto-route throws', async () => {
    const req = makeReq({ id: 10 }, { orderId: 42 }, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await orderRouteHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to route order/i)
  })
})
