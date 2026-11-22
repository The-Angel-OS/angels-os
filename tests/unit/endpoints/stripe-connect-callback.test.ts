/**
 * Retired Stripe Connect Callback Endpoint — Unit Test (410 Gone)
 */
import { describe, it, expect } from 'vitest'
import { stripeConnectCallbackHandler } from '@/endpoints/stripe-connect-callback'

describe('stripeConnectCallbackHandler (retired)', () => {
  it('returns 410 Gone pointing to Square OAuth connect', async () => {
    const req = new Request('http://localhost/api/stripe/connect/callback', { method: 'POST' }) as any
    const res = await stripeConnectCallbackHandler(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.replacement).toBe('/api/payment-ops/square/connect')
  })
})
