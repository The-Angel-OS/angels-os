/**
 * Stripe Webhooks Endpoint — Unit Tests
 *
 * POST /api/stripe/webhooks
 * No auth required. Validates Stripe signature, handles events idempotently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// logError lazy-imports @payload-config (boots Payload against a live DB) —
// unmocked, error-path tests hang to the 30s timeout instead of asserting.
vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
  logCaughtError: vi.fn(async () => {}),
}))

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockConstructEvent = vi.hoisted(() => vi.fn())
const mockCalculateSplit = vi.hoisted(() => vi.fn().mockReturnValue([
  { recipient: 'SELLER', amount: 7000 },
  { recipient: 'JUSTICE_FUND', amount: 500 },
  { recipient: 'PLATFORM', amount: 2000 },
]))
const mockSendOrderConfirmationEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('stripe', () => ({
  default: vi.fn().mockReturnValue({
    webhooks: { constructEvent: mockConstructEvent },
    paymentIntents: { retrieve: vi.fn().mockResolvedValue({ metadata: {} }) },
    charges: { list: vi.fn().mockResolvedValue({ data: [] }) },
  }),
}))
vi.mock('@/lib/ultimate-fair-split', () => ({
  calculateUltimateFairSplit: mockCalculateSplit,
  ULTIMATE_FAIR_SPLIT: { JUSTICE_FUND: 0.05 },
}))
vi.mock('@/utilities/sendOrderConfirmationEmail', () => ({
  sendOrderConfirmationEmail: mockSendOrderConfirmationEmail,
}))

import { stripeWebhooksHandler } from '@/endpoints/stripe-webhooks'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFakeEvent(type: string, data: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt_test_001',
    type,
    data: { object: { id: 'pi_test123', amount: 10000, currency: 'usd', metadata: {}, ...data } },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findByID: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  body: string = '{"test":true}',
  headers: Record<string, string> = {},
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/stripe/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stripeWebhooksHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOKS_SIGNING_SECRET = 'whsec_test_secret'
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    mockConstructEvent.mockReturnValue(makeFakeEvent('some.event'))
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = makeReq('{}', {}) // no stripe-signature
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing signature/i)
  })

  it('returns 400 when STRIPE_WEBHOOKS_SIGNING_SECRET is not set', async () => {
    delete process.env.STRIPE_WEBHOOKS_SIGNING_SECRET
    const req = makeReq('{}', { 'stripe-signature': 'sig_test' })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing signature/i)
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })
    const req = makeReq('{}', { 'stripe-signature': 'bad_sig' })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no signatures found/i)
  })

  it('returns 200 received:true for unrecognized event type', async () => {
    mockConstructEvent.mockReturnValue(makeFakeEvent('customer.created'))
    const req = makeReq('{}', { 'stripe-signature': 'sig_valid' })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('returns 200 received:true, duplicate:true for already-processed event', async () => {
    const req = makeReq('{}', { 'stripe-signature': 'sig_valid' }, {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 1, eventId: 'evt_test_001' }], totalDocs: 1 }),
    })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
    expect(body.duplicate).toBe(true)
  })

  it('processes payment_intent.succeeded and records Justice Fund allocation', async () => {
    mockConstructEvent.mockReturnValue(makeFakeEvent('payment_intent.succeeded', {
      amount: 10000,
      metadata: { orderId: undefined, angelOs_chargeModel: 'platform' },
    }))
    const createMock = vi.fn().mockResolvedValue({ id: 1 })
    const req = makeReq('{}', { 'stripe-signature': 'sig_valid' }, { create: createMock })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(200)
    expect(mockCalculateSplit).toHaveBeenCalledWith(10000)
    // justice-fund-transactions create was called
    const createCalls = createMock.mock.calls
    const jfCall = createCalls.find((c: any) => c[0].collection === 'justice-fund-transactions')
    expect(jfCall).toBeDefined()
  })

  it('processes account.updated and syncs tenant Stripe status', async () => {
    const fakeAccount = {
      id: 'acct_test123',
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
    }
    mockConstructEvent.mockReturnValue({
      id: 'evt_account_001',
      type: 'account.updated',
      data: { object: fakeAccount },
    })
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq('{}', { 'stripe-signature': 'sig_valid' }, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants') return Promise.resolve({ docs: [{ id: 5 }], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      update: updateMock,
    })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalled()
    const updateArgs = updateMock.mock.calls.find((c: any) => c[0].collection === 'tenants')?.[0]
    expect(updateArgs?.data.stripeConnect.stripeAccountId).toBe('acct_test123')
    expect(updateArgs?.data.stripeConnect.stripeOnboardingComplete).toBe(true)
  })

  it('returns 200 even when event handler throws (prevents Stripe retries)', async () => {
    mockConstructEvent.mockReturnValue(makeFakeEvent('payment_intent.succeeded'))
    mockCalculateSplit.mockImplementation(() => { throw new Error('Split calculation failed') })
    const req = makeReq('{}', { 'stripe-signature': 'sig_valid' })
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})
