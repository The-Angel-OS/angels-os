/**
 * Retired Stripe Connect Onboard Endpoint — Unit Test (410 Gone)
 */
import { describe, it, expect } from 'vitest'
import { stripeConnectOnboardHandler } from '@/endpoints/stripe-connect-onboard'

describe('stripeConnectOnboardHandler (retired)', () => {
  it('returns 410 Gone pointing to Square OAuth connect', async () => {
    const req = new Request('http://localhost/api/stripe/connect/onboard', { method: 'POST' }) as any
    const res = await stripeConnectOnboardHandler(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.replacement).toBe('/api/payment-ops/square/connect')
  })
})
