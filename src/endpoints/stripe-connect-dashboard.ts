/**
 * Retired Stripe Connect Dashboard Link — POST /api/stripe/connect/dashboard-link
 *
 * Replaced by Square Seller Dashboard and /api/payment-ops/square/connect
 */
import type { PayloadHandler } from 'payload'

export const stripeConnectDashboardHandler: PayloadHandler = async () => {
  return Response.json(
    {
      error: 'Stripe Connect has been retired. Manage payouts from your Square Dashboard.',
      replacement: '/api/payment-ops/square/connect',
    },
    { status: 410 },
  )
}
