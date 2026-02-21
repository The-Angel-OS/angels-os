/**
 * Stripe Connect Dashboard Link — POST /api/stripe/connect/dashboard-link
 *
 * Creates a Stripe Express Dashboard login link for the tenant.
 * The link opens the connected account's Express Dashboard in a new tab.
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil' as any,
    })
  }
  return _stripe
}

export const stripeConnectDashboardHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId as number,
      depth: 0,
      overrideAccess: true,
    })) as any

    if (!tenant) {
      return Response.json({ error: 'Tenant not found.' }, { status: 404 })
    }

    const stripeAccountId = tenant.stripeConnect?.stripeAccountId
    if (!stripeAccountId) {
      return Response.json(
        { error: 'Stripe Connect is not set up for this tenant.' },
        { status: 400 },
      )
    }

    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId)

    return Response.json({ url: loginLink.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    payload.logger.error(err, 'Error creating Stripe Express dashboard link')
    return Response.json({ error: message }, { status: 500 })
  }
}
