/**
 * Retired Stripe Connect Callback Endpoint — POST /api/stripe/connect/callback
 *
 * Replaced by Square OAuth callback: GET /api/payment-ops/square/callback
 */
import type { PayloadHandler } from 'payload'

export const stripeConnectCallbackHandler: PayloadHandler = async () => {
  return Response.json(
    {
      error: 'Stripe Connect has been retired. Use the Square OAuth flow instead.',
      replacement: '/api/payment-ops/square/connect',
    },
    { status: 410 },
  )
}
