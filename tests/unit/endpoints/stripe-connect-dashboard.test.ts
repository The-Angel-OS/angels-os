/**
 * Retired Stripe Connect Dashboard Link Endpoint — Unit Test (410 Gone)
 */
import { describe, it, expect } from 'vitest'
import { stripeConnectDashboardHandler } from '@/endpoints/stripe-connect-dashboard'

describe('stripeConnectDashboardHandler (retired)', () => {
  it('returns 410 Gone pointing to Square OAuth connect', async () => {
    const req = new Request('http://localhost/api/stripe/connect/dashboard-link', { method: 'POST' }) as any
    const res = await stripeConnectDashboardHandler(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.replacement).toBe('/api/payment-ops/square/connect')
  })
})
