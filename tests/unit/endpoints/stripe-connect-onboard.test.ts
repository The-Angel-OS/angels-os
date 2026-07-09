/**
 * Stripe Connect Onboard Endpoint — Unit Tests
 *
 * POST /api/stripe/connect/onboard
 * Auth + rate limited. Generates a Stripe Connect Express onboarding link.
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
const mockGetServerSideURL = vi.hoisted(() => vi.fn().mockReturnValue('https://spacesangels.com'))
const mockAccountsCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'acct_new123' }),
)
const mockAccountLinksCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/express/onboarding/acct_new123' }),
)

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/getURL', () => ({ getServerSideURL: mockGetServerSideURL }))
vi.mock('stripe', () => ({
  default: vi.fn().mockReturnValue({
    accounts: { create: mockAccountsCreate },
    accountLinks: { create: mockAccountLinksCreate },
  }),
}))

import { stripeConnectOnboardHandler } from '@/endpoints/stripe-connect-onboard'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_NO_STRIPE = { id: 1, slug: 'clearwater', stripeConnect: null }
const TENANT_INCOMPLETE = { id: 1, slug: 'clearwater', stripeConnect: { stripeAccountId: 'acct_existing', stripeOnboardingComplete: false } }
const TENANT_COMPLETE = { id: 1, slug: 'clearwater', stripeConnect: { stripeAccountId: 'acct_done', stripeOnboardingComplete: true } }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [{ id: 1, role: 'admin' }], totalDocs: 1 }),
    findByID: vi.fn().mockResolvedValue(TENANT_NO_STRIPE),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, roles: [] },
  body: Record<string, unknown> | null = { tenantId: 1 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/stripe/connect/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'INVALID{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stripeConnectOnboardHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockAccountsCreate.mockResolvedValue({ id: 'acct_new123' })
    mockAccountLinksCreate.mockResolvedValue({ url: 'https://connect.stripe.com/express/onboarding/acct_new123' })
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const req = makeReq({ id: 1, roles: [] })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1, roles: [] }, null)
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when tenantId is missing', async () => {
    const req = makeReq({ id: 1, roles: [] }, {})
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tenantId/i)
  })

  it('returns 403 when user has no tenant membership and is not super_admin', async () => {
    const req = makeReq({ id: 1, roles: [] }, { tenantId: 1 }, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/do not have access/i)
  })

  it('allows super_admin regardless of tenant membership', async () => {
    const req = makeReq({ id: 1, roles: ['super_admin'] }, { tenantId: 1 }, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 200 with alreadyConnected=true when onboarding is complete', async () => {
    const req = makeReq({ id: 1, roles: ['super_admin'] }, { tenantId: 1 }, {
      findByID: vi.fn().mockResolvedValue(TENANT_COMPLETE),
    })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.alreadyConnected).toBe(true)
    expect(body.stripeAccountId).toBe('acct_done')
  })

  it('returns 200 with onboardingUrl when creating new Stripe account', async () => {
    const req = makeReq({ id: 1, roles: ['super_admin'] })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.onboardingUrl).toContain('connect.stripe.com')
    expect(body.stripeAccountId).toBe('acct_new123')
    expect(mockAccountsCreate).toHaveBeenCalledOnce()
    expect(mockAccountLinksCreate).toHaveBeenCalledOnce()
  })

  it('uses existing account ID when tenant has account but onboarding incomplete', async () => {
    const req = makeReq({ id: 1, roles: ['super_admin'] }, { tenantId: 1 }, {
      findByID: vi.fn().mockResolvedValue(TENANT_INCOMPLETE),
    })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(200)
    // Should NOT create a new account — just create an account link for the existing one
    expect(mockAccountsCreate).not.toHaveBeenCalled()
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_existing', type: 'account_onboarding' }),
    )
  })

  it('returns 500 when Stripe API throws', async () => {
    mockAccountsCreate.mockRejectedValue(new Error('Invalid API key'))
    const req = makeReq({ id: 1, roles: ['super_admin'] })
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/invalid api key/i)
  })
})
