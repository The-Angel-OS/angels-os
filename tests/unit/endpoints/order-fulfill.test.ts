/**
 * Order Fulfill Endpoint — Unit Tests
 *
 * POST /api/orders/fulfill
 * Auth required. Updates fulfillment status for an assigned order item.
 * Validates state machine transitions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { membershipFindFor } from './_managerMemberships'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockValidateFulfillmentTransition = vi.hoisted(() => vi.fn().mockReturnValue(true))
const mockValidateFulfillmentUpdate = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/orderRoutingEngine', () => ({
  validateFulfillmentTransition: mockValidateFulfillmentTransition,
  validateFulfillmentUpdate: mockValidateFulfillmentUpdate,
}))

import { orderFulfillHandler } from '@/endpoints/order-fulfill'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_HOLON = {
  id: 5,
  tenant: { id: 10 },
  activeOrderCount: 3,
  businessName: 'Print Shop Co.',
}

const DEFAULT_FULFILLMENT_ENTRY = {
  orderItemIndex: 0,
  assignedHolon: { id: 5 },
  fulfillmentStatus: 'matched',
  tokenStatus: 'active',
}

const DEFAULT_ORDER = {
  id: 42,
  items: [{ product: { title: 'T-Shirt' } }],
  fulfillment: [DEFAULT_FULFILLMENT_ENTRY],
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}, user: unknown = null) {
  const findByIDMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'orders') return Promise.resolve(DEFAULT_ORDER)
    if (collection === 'holon-capabilities') return Promise.resolve(DEFAULT_HOLON)
    return Promise.resolve(null)
  })

  return {
    find: membershipFindFor(user),
    findByID: findByIDMock,
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, tenants: [{ tenant: { id: 10 } }] },
  body: Record<string, unknown> | null = { orderId: 42, itemIndex: 0, status: 'accepted' },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides, user)
  const nativeReq = new Request('http://localhost/api/orders/fulfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('orderFulfillHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockValidateFulfillmentTransition.mockReturnValue(true)
    mockValidateFulfillmentUpdate.mockReturnValue(null)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1 }, null)
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when orderId is missing', async () => {
    const req = makeReq({ id: 1 }, { itemIndex: 0, status: 'accepted' })
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/orderId is required/i)
  })

  it('returns 400 when itemIndex is missing', async () => {
    const req = makeReq({ id: 1 }, { orderId: 42, status: 'accepted' })
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/itemIndex is required/i)
  })

  it('returns 400 when status is missing', async () => {
    const req = makeReq({ id: 1 }, { orderId: 42, itemIndex: 0 })
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/status is required/i)
  })

  it('returns 400 when validateFulfillmentUpdate returns an error', async () => {
    mockValidateFulfillmentUpdate.mockReturnValue('Error: Tracking number is required when shipping.')
    const req = makeReq({ id: 1 }, { orderId: 42, itemIndex: 0, status: 'shipped' })
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tracking number is required/i)
  })

  it('returns 404 when order not found (findByID throws)', async () => {
    const req = makeReq(
      { id: 1, tenants: [{ tenant: { id: 10 } }] },
      { orderId: 99, itemIndex: 0, status: 'accepted' },
      {
        findByID: vi.fn().mockRejectedValue(new Error('Not Found')),
      },
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/order not found/i)
  })

  it('returns 400 when no fulfillment entry matches itemIndex', async () => {
    const req = makeReq(
      { id: 1, tenants: [{ tenant: { id: 10 } }] },
      { orderId: 42, itemIndex: 99, status: 'accepted' }, // itemIndex 99 doesn't exist
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no fulfillment assignment found/i)
  })

  it('returns 403 when user is not the assigned vendor', async () => {
    const req = makeReq(
      { id: 1, tenants: [{ tenant: { id: 999 } }] }, // different tenant
      { orderId: 42, itemIndex: 0, status: 'accepted' },
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/only the assigned vendor/i)
  })

  it('allows admin to update regardless of tenant', async () => {
    const req = makeReq(
      { id: 1, roles: ['admin'], tenants: [] },
      { orderId: 42, itemIndex: 0, status: 'accepted' },
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 when state transition is invalid', async () => {
    mockValidateFulfillmentTransition.mockReturnValue(false)
    const req = makeReq(
      { id: 1, tenants: [{ tenant: { id: 10 } }] },
      { orderId: 42, itemIndex: 0, status: 'delivered' },
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid transition/i)
  })

  it('returns 200 with success message on valid update', async () => {
    const req = makeReq()
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.fulfillmentStatus).toBe('accepted')
  })

  it('includes trackingNumber in response when status is shipped', async () => {
    const req = makeReq(
      { id: 1, tenants: [{ tenant: { id: 10 } }] },
      { orderId: 42, itemIndex: 0, status: 'shipped', trackingNumber: 'TRK-9876' },
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.trackingNumber).toBe('TRK-9876')
  })

  it('decrements holon activeOrderCount when status is rejected', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(
      { id: 1, tenants: [{ tenant: { id: 10 } }] },
      { orderId: 42, itemIndex: 0, status: 'rejected', rejectionReason: 'Cannot fulfill' },
      { update: updateMock },
    )
    const res = await orderFulfillHandler(req)
    expect(res.status).toBe(200)
    // Should call update twice: once for order, once for holon (decrement activeOrderCount)
    expect(updateMock).toHaveBeenCalledTimes(2)
    const holonUpdateCall = updateMock.mock.calls.find(
      (call: any[]) => call[0].collection === 'holon-capabilities',
    )
    expect(holonUpdateCall).toBeDefined()
    expect(holonUpdateCall![0].data.activeOrderCount).toBe(2) // 3 - 1
  })
})
