/**
 * Maker Opportunities Endpoint — Unit Tests
 *
 * GET /api/maker-opportunities
 * Public endpoint. Returns Angel Token queue data aggregated by capability.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetActiveTokensByCapability = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/angelTokens', () => ({
  getActiveTokensByCapability: mockGetActiveTokensByCapability,
}))

import { makerOpportunitiesHandler } from '@/endpoints/maker-opportunities'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_OPPORTUNITY = {
  skill: 'screen-printing',
  queuedOrders: 3,
  estimatedVendorRevenue: 150,
  region: 'clearwater',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(payloadOverrides: Record<string, unknown> = {}) {
  const payload = { ...payloadOverrides }
  const nativeReq = new Request('http://localhost/api/maker-opportunities', { method: 'GET' })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('makerOpportunitiesHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveTokensByCapability.mockResolvedValue([DEFAULT_OPPORTUNITY])
  })

  it('returns 200 with opportunities array', async () => {
    const req = makeReq()
    const res = await makerOpportunitiesHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.opportunities).toHaveLength(1)
    expect(body.opportunities[0].skill).toBe('screen-printing')
  })

  it('includes totalQueuedOrders as sum of queuedOrders', async () => {
    mockGetActiveTokensByCapability.mockResolvedValue([
      { skill: 'screen-printing', queuedOrders: 3, estimatedVendorRevenue: 150 },
      { skill: 'embroidery', queuedOrders: 2, estimatedVendorRevenue: 80 },
    ])
    const req = makeReq()
    const res = await makerOpportunitiesHandler(req)
    const body = await res.json()
    expect(body.totalQueuedOrders).toBe(5)
  })

  it('includes totalVendorRevenue as sum rounded to 2 decimal places', async () => {
    mockGetActiveTokensByCapability.mockResolvedValue([
      { skill: 'screen-printing', queuedOrders: 3, estimatedVendorRevenue: 100.555 },
      { skill: 'embroidery', queuedOrders: 1, estimatedVendorRevenue: 50.005 },
    ])
    const req = makeReq()
    const res = await makerOpportunitiesHandler(req)
    const body = await res.json()
    expect(body.totalVendorRevenue).toBe(150.56)
  })

  it('returns message with count when opportunities exist', async () => {
    const req = makeReq()
    const res = await makerOpportunitiesHandler(req)
    const body = await res.json()
    expect(body.message).toMatch(/1 capability area/i)
    expect(body.message).toMatch(/register your workshop/i)
  })

  it('returns "No orders" message when opportunities array is empty', async () => {
    mockGetActiveTokensByCapability.mockResolvedValue([])
    const req = makeReq()
    const res = await makerOpportunitiesHandler(req)
    const body = await res.json()
    expect(body.opportunities).toEqual([])
    expect(body.totalQueuedOrders).toBe(0)
    expect(body.message).toMatch(/no orders in the queue/i)
  })

  it('returns 500 when getActiveTokensByCapability throws', async () => {
    mockGetActiveTokensByCapability.mockRejectedValue(new Error('DB failure'))
    const req = makeReq()
    const res = await makerOpportunitiesHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to fetch opportunities/i)
  })
})
