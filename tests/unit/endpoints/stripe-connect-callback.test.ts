/**
 * Stripe Connect Callback Endpoint — Unit Tests
 *
 * GET/POST /api/stripe/connect/callback
 * Auth required. Checks Stripe account status after onboarding and updates tenant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAccountsRetrieve = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 'acct_test123',
    details_submitted: true,
    charges_enabled: true,
    payouts_enabled: true,
  }),
)

vi.mock('stripe', () => ({
  default: vi.fn().mockReturnValue({
    accounts: {
      retrieve: mockAccountsRetrieve,
    },
  }),
}))

import { stripeConnectCallbackHandler } from '@/endpoints/stripe-connect-callback'

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_TENANT_WITH_STRIPE = {
  id: 1,
  name: 'Test Tenant',
  stripeConnect: { stripeAccountId: 'acct_test123' },
}
const FAKE_TENANT_NO_STRIPE = { id: 2, name: 'No Stripe Tenant', stripeConnect: null }

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(FAKE_TENANT_WITH_STRIPE),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1 },
  body: Record<string, unknown> | null = { tenantId: 1 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/stripe/connect/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'INVALID{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stripeConnectCallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccountsRetrieve.mockResolvedValue({
      id: 'acct_test123',
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
    })
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1 }, null)
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when tenantId is missing', async () => {
    const req = makeReq({ id: 1 }, {})
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tenantId/i)
  })

  it('returns 400 when tenant has no Stripe account', async () => {
    const req = makeReq({ id: 1 }, { tenantId: 2 }, {
      findByID: vi.fn().mockResolvedValue(FAKE_TENANT_NO_STRIPE),
    })
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no stripe account/i)
  })

  it('returns 200 with onboarding complete when Stripe reports details_submitted', async () => {
    const req = makeReq()
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.onboardingComplete).toBe(true)
    expect(body.chargesEnabled).toBe(true)
    expect(body.payoutsEnabled).toBe(true)
    expect(body.stripeAccountId).toBe('acct_test123')
  })

  it('returns 200 with onboardingComplete=false when details_submitted=false', async () => {
    mockAccountsRetrieve.mockResolvedValue({
      id: 'acct_test123',
      details_submitted: false,
      charges_enabled: false,
      payouts_enabled: false,
    })
    const req = makeReq()
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.onboardingComplete).toBe(false)
    expect(body.chargesEnabled).toBe(false)
  })

  it('calls payload.update to sync Stripe status to tenant', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq({ id: 1 }, { tenantId: 1 }, { update: updateMock })
    await stripeConnectCallbackHandler(req)
    expect(updateMock).toHaveBeenCalledOnce()
    const updateArgs = updateMock.mock.calls[0][0]
    expect(updateArgs.collection).toBe('tenants')
    expect(updateArgs.data.stripeConnect.stripeAccountId).toBe('acct_test123')
  })

  it('returns 500 when Stripe API throws', async () => {
    mockAccountsRetrieve.mockRejectedValue(new Error('Stripe connection failed'))
    const req = makeReq()
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/stripe connection failed/i)
  })
})
