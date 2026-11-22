/**
 * Retired Stripe Webhook Endpoint — Unit Test (410 Gone)
 */
import { describe, it, expect } from 'vitest'
import { stripeWebhooksHandler } from '@/endpoints/stripe-webhooks'

describe('stripeWebhooksHandler (retired)', () => {
  it('returns 410 Gone pointing to Square and PayPal webhooks', async () => {
    const req = new Request('http://localhost/api/stripe/webhooks', { method: 'POST' }) as any
    const res = await stripeWebhooksHandler(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.replacements).toEqual([
      '/api/payment-ops/webhooks/square',
      '/api/payment-ops/webhooks/paypal',
    ])
  })
})
