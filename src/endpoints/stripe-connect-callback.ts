/**
 * Stripe Connect Callback Endpoint — GET /api/stripe/connect/callback
 *
 * Called after Stripe Connect onboarding completes.
 * Checks the account status and updates tenant record.
 *
 * @see src/endpoints/stripe-connect-onboard.ts — initiates onboarding
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
    })
  }
  return _stripe
}

export const stripeConnectCallbackHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenantId } = body

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantId as number, depth: 0 }) as any
  const accountId = tenant?.stripeConnect?.stripeAccountId

  if (!accountId) {
    return Response.json({ error: 'No Stripe account found for this tenant.' }, { status: 400 })
  }

  try {
    // Retrieve the account to check onboarding status
    const account = await getStripe().accounts.retrieve(accountId)

    const isOnboardingComplete = Boolean(account.details_submitted)
    const chargesEnabled = Boolean(account.charges_enabled)
    const payoutsEnabled = Boolean(account.payouts_enabled)

    // Update tenant with current Stripe status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnect: {
          stripeAccountId: accountId,
          stripeOnboardingComplete: isOnboardingComplete,
          stripeChargesEnabled: chargesEnabled,
          stripePayoutsEnabled: payoutsEnabled,
          ...(isOnboardingComplete && !tenant.stripeConnect?.connectedAt
            ? { connectedAt: new Date().toISOString() }
            : {}),
        },
      },
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      stripeAccountId: accountId,
      onboardingComplete: isOnboardingComplete,
      chargesEnabled,
      payoutsEnabled,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to check Stripe account status'
    return Response.json({ error: message }, { status: 500 })
  }
}
