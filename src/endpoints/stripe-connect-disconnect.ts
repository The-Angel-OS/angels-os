/**
 * Retired Stripe Connect Disconnect Endpoint — POST /api/stripe/connect/disconnect
 *
 * Replaced by Square OAuth disconnect: POST /api/payment-ops/square/disconnect
 */
import type { PayloadHandler } from 'payload'

export const stripeConnectDisconnectHandler: PayloadHandler = async () => {
  return Response.json(
    {
      error: 'Stripe Connect has been retired. Use /api/payment-ops/square/disconnect instead.',
      replacement: '/api/payment-ops/square/disconnect',
    },
    { status: 410 },
  )
}
