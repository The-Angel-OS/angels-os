/**
 * Stripe Connect Dashboard Endpoint — Unit Tests
 *
 * POST /api/stripe/connect/dashboard-link
 * Auth required. Creates a Stripe Express Dashboard login link.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateLoginLink = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/express/login/acct_test123' }),
)

vi.mock('stripe', () => ({
  default: vi.fn().mockReturnValue({
    accounts: {
      createLoginLink: mockCreateLoginLink,
    },
  }),
}))

import { stripeConnectDashboardHandler } from '@/endpoints/stripe-connect-dashboard'

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_TENANT = { id: 1, name: 'Test Tenant', stripeConnect: { stripeAccountId: 'acct_test123' } }
const TENANT_NO_STRIPE = { id: 2, name: 'No Stripe', stripeConnect: null }

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(FAKE_TENANT),
    logger: { error: vi.fn() },
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1 },
  body: Record<string, unknown> | null = { tenantId: 1 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/stripe/connect/dashboard-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'INVALID{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stripeConnectDashboardHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateLoginLink.mockResolvedValue({ url: 'https://connect.stripe.com/express/login/acct_test123' })
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1 }, null)
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when tenantId is missing', async () => {
    const req = makeReq({ id: 1 }, {})
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tenantId/i)
  })

  it('returns 404 when tenant is not found', async () => {
    const req = makeReq({ id: 1 }, { tenantId: 99 }, {
      findByID: vi.fn().mockResolvedValue(null),
    })
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 400 when tenant has no Stripe Connect account', async () => {
    const req = makeReq({ id: 1 }, { tenantId: 2 }, {
      findByID: vi.fn().mockResolvedValue(TENANT_NO_STRIPE),
    })
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not set up/i)
  })

  it('returns 200 with dashboard URL on success', async () => {
    const req = makeReq()
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('connect.stripe.com')
    expect(mockCreateLoginLink).toHaveBeenCalledWith('acct_test123')
  })

  it('returns 500 when Stripe createLoginLink throws', async () => {
    mockCreateLoginLink.mockRejectedValue(new Error('Cannot create login link for unverified account'))
    const req = makeReq()
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/cannot create login link/i)
  })
})
