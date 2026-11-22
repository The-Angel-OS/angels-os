/**
 * Retired Stripe Connect Onboarding Endpoint — POST /api/stripe/connect/onboard
 *
 * Replaced by Square OAuth: GET|POST /api/payment-ops/square/connect
 */
import type { PayloadHandler } from 'payload'

export const stripeConnectOnboardHandler: PayloadHandler = async () => {
  return Response.json(
    {
      error: 'Stripe Connect has been retired. Connect your Square account instead.',
      replacement: '/api/payment-ops/square/connect',
    },
    { status: 410 },
  )
}
