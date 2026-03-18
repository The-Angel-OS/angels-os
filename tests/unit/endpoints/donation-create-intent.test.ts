/**
 * Sprint 43 — Donation PaymentIntent endpoint tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Stripe
const mockCreate = vi.fn()
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: { create: mockCreate },
    })),
  }
})

// Dynamic import after mocks
const { donationCreateIntentHandler } = await import(
  '@/endpoints/donation-create-intent'
)

function makeReq(body: Record<string, unknown>) {
  const request = new Request('http://localhost:3000/api/donation-ops/create-intent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  // Preserve Request prototype (json(), text()) while adding payload property
  ;(request as any).payload = {}
  return request as any
}

describe('donation-create-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_abc',
      amount: 2500,
    })
  })

  it('creates PaymentIntent for valid donation', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 2500 }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.clientSecret).toBe('pi_test_123_secret_abc')
    expect(data.paymentIntentId).toBe('pi_test_123')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'usd',
        metadata: expect.objectContaining({ angelOs_type: 'donation' }),
      }),
    )
  })

  it('rejects non-integer amount', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 25.5 }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('integer')
  })

  it('rejects amount below minimum ($1.00)', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 50 }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Minimum')
  })

  it('rejects amount above maximum ($10,000)', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 1_500_000 }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Maximum')
  })

  it('rejects missing amount', async () => {
    const res = await donationCreateIntentHandler(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('rejects string amount', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: '2500' }))
    expect(res.status).toBe(400)
  })

  it('includes donor metadata when provided', async () => {
    await donationCreateIntentHandler(
      makeReq({
        amount: 5000,
        donorEmail: 'ken@test.com',
        donorName: 'Kenneth',
        message: 'For Ernesto',
      }),
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          donorEmail: 'ken@test.com',
          donorName: 'Kenneth',
          message: 'For Ernesto',
        }),
        receipt_email: 'ken@test.com',
      }),
    )
  })

  it('omits donor fields when not provided', async () => {
    await donationCreateIntentHandler(makeReq({ amount: 1000 }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.metadata.donorEmail).toBeUndefined()
    expect(call.metadata.donorName).toBeUndefined()
    expect(call.receipt_email).toBeUndefined()
  })

  it('truncates message to 500 chars', async () => {
    const longMessage = 'x'.repeat(600)
    await donationCreateIntentHandler(
      makeReq({ amount: 1000, message: longMessage }),
    )

    const call = mockCreate.mock.calls[0][0]
    expect(call.metadata.message.length).toBe(500)
  })

  it('returns 500 on Stripe failure', async () => {
    mockCreate.mockRejectedValue(new Error('Stripe down'))
    const res = await donationCreateIntentHandler(makeReq({ amount: 2500 }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('try again')
  })

  it('rejects invalid JSON body', async () => {
    const request = new Request('http://localhost:3000/api/donation-ops/create-intent', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })
    ;(request as any).payload = {}
    const res = await donationCreateIntentHandler(request as any)
    expect(res.status).toBe(400)
  })

  it('sets correct PaymentIntent description', async () => {
    await donationCreateIntentHandler(
      makeReq({ amount: 5000, donorName: 'Kenneth' }),
    )

    const call = mockCreate.mock.calls[0][0]
    expect(call.description).toBe('Angel OS Donation from Kenneth')
  })

  it('sets generic description without donor name', async () => {
    await donationCreateIntentHandler(makeReq({ amount: 5000 }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.description).toBe('Angel OS Donation')
  })

  it('enables automatic payment methods', async () => {
    await donationCreateIntentHandler(makeReq({ amount: 1000 }))

    const call = mockCreate.mock.calls[0][0]
    expect(call.automatic_payment_methods).toEqual({ enabled: true })
  })

  it('accepts minimum valid amount ($1.00 = 100 cents)', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 100 }))
    expect(res.status).toBe(200)
  })

  it('accepts maximum valid amount ($10,000 = 1,000,000 cents)', async () => {
    const res = await donationCreateIntentHandler(makeReq({ amount: 1_000_000 }))
    expect(res.status).toBe(200)
  })
})
