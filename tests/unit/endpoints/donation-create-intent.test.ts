/**
 * Donation Checkout Endpoint Tests — POST /api/donation-ops/create-intent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockStartHostedCheckout = vi.hoisted(() => vi.fn())
const mockResolveDonationRecipient = vi.hoisted(() =>
  vi.fn(async () => ({
    recipientName: 'the Justice Fund',
    chargeModel: 'platform' as const,
  })),
)

vi.mock('@/lib/payments/config', () => ({
  generateCheckoutRef: () => 'ref_donation_test_123',
}))

vi.mock('@/lib/payments/registry', () => ({
  startHostedCheckout: mockStartHostedCheckout,
}))

vi.mock('@/utilities/donationRouting', () => ({
  DONATION_JUSTICE_FUND_PERCENT: 5,
  resolveDonationRecipient: mockResolveDonationRecipient,
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
  logCaughtError: vi.fn(async () => {}),
}))

const { donationCreateIntentHandler } = await import('@/endpoints/donation-create-intent')

function makeReq(body: Record<string, unknown>, ip = '10.0.0.1') {
  const request = new Request('http://localhost:3000/api/donation-ops/create-intent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  })
  ;(request as any).payload = {}
  return request as any
}

describe('donation-create-intent (dual-rail hosted checkout)', () => {
  let reqIdx = 1

  beforeEach(() => {
    vi.clearAllMocks()
    mockStartHostedCheckout.mockResolvedValue({
      provider: 'square',
      environment: 'sandbox',
      checkoutUrl: 'https://square.link/u/don_123',
      externalId: 'ORD_DON_1',
      ref: 'ref_donation_test_123',
    })
  })

  it('starts hosted Square checkout for valid donation', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 2500 }, `10.0.0.${reqIdx++}`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      ok: true,
      checkoutUrl: 'https://square.link/u/don_123',
      provider: 'square',
      externalId: 'ORD_DON_1',
      ref: 'ref_donation_test_123',
    })
    expect(mockStartHostedCheckout).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'donation',
        amountCents: 2500,
        currency: 'USD',
      }),
    )
  })

  it('rejects non-integer amount', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 25.5 }, `10.0.0.${reqIdx++}`))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('integer')
  })

  it('rejects amount below minimum ($5.00 = 500 cents)', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 400 }, `10.0.0.${reqIdx++}`))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Minimum')
  })

  it('rejects amount above maximum ($10,000)', async () => {
    const res = await donationCreateIntentHandler(
      makeReq({ amount: 1_500_000 }, `10.0.0.${reqIdx++}`),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Maximum')
  })

  it('forwards donor metadata and truncates message to 500 chars', async () => {
    const longMessage = 'x'.repeat(600)
    await donationCreateIntentHandler(
      makeReq(
        {
          amount: 5000,
          donorEmail: 'ken@test.com',
          donorName: 'Kenneth',
          message: longMessage,
          provider: 'paypal',
        },
        `10.0.0.${reqIdx++}`,
      ),
    )

    const call = mockStartHostedCheckout.mock.calls[0]![1]
    expect(call.provider).toBe('paypal')
    expect(call.description).toBe('Gift to the Justice Fund from Kenneth')
    expect(call.customerEmail).toBe('ken@test.com')
    expect(call.intentData.message.length).toBe(500)
  })

  it('returns 503 when payment rails are not configured', async () => {
    mockStartHostedCheckout.mockRejectedValue(
      new Error('Online payments are not configured yet on this node.'),
    )
    const res = await donationCreateIntentHandler(makeReq({ amount: 2500 }, `10.0.0.${reqIdx++}`))
    expect(res.status).toBe(503)
  })

  it('rejects invalid JSON body', async () => {
    const request = new Request('http://localhost:3000/api/donation-ops/create-intent', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain', 'x-forwarded-for': `10.0.0.${reqIdx++}` },
    })
    ;(request as any).payload = {}
    const res = await donationCreateIntentHandler(request as any)
    expect(res.status).toBe(400)
  })

  it('accepts minimum valid amount ($5.00 = 500 cents) and max ($10,000)', async () => {
    const resMin = await donationCreateIntentHandler(makeReq({ amount: 500 }, `10.0.0.${reqIdx++}`))
    expect(resMin.status).toBe(200)
    const resMax = await donationCreateIntentHandler(
      makeReq({ amount: 1_000_000 }, `10.0.0.${reqIdx++}`),
    )
    expect(resMax.status).toBe(200)
  })
})
