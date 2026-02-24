/**
 * Stripe Connect Onboarding Endpoint — POST /api/stripe/connect/onboard
 *
 * Generates a Stripe Connect Express onboarding link for a tenant.
 * The tenant admin initiates this to connect their bank account.
 *
 * @see src/lib/stripe-connect-config.ts — fee configuration
 * @see src/lib/ultimate-fair-split.ts — 70/20/4/1/5 split (Toward-53)
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
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

export const stripeConnectOnboardHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // Rate limit: 10 Stripe requests/min per user
  const rateLimited = applyRateLimit(req, 'stripe')
  if (rateLimited) return rateLimited

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

  // Verify user has admin access to this tenant
  const tenantMemberships = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: user.id } },
        { tenant: { equals: tenantId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRoles = (user as any).roles || []
  const isSuperAdmin = Array.isArray(userRoles) && userRoles.includes('super_admin')
  const hasTenantAccess = tenantMemberships.docs.length > 0

  if (!isSuperAdmin && !hasTenantAccess) {
    return Response.json({ error: 'You do not have access to this tenant.' }, { status: 403 })
  }

  // Check if tenant already has a Stripe account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantId as number, depth: 0 }) as any

  if (tenant?.stripeConnect?.stripeAccountId && tenant?.stripeConnect?.stripeOnboardingComplete) {
    return Response.json({
      success: true,
      alreadyConnected: true,
      stripeAccountId: tenant.stripeConnect.stripeAccountId,
    })
  }

  try {
    // Create or retrieve Stripe Express account
    let accountId = tenant?.stripeConnect?.stripeAccountId

    if (!accountId) {
      const account = await getStripe().accounts.create({
        type: 'express',
        metadata: {
          tenantId: String(tenantId),
          tenantSlug: tenant.slug,
          platform: 'angel-os',
        },
      })
      accountId = account.id

      // Save the account ID to the tenant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'tenants',
        id: tenantId,
        data: {
          stripeConnect: {
            stripeAccountId: accountId,
            stripeOnboardingComplete: false,
            stripePayoutsEnabled: false,
            stripeChargesEnabled: false,
          },
        },
        overrideAccess: true,
      })
    }

    // Generate the onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    const accountLink = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard/admin/payments?refresh=true`,
      return_url: `${baseUrl}/dashboard/admin/payments?onboarding=complete`,
      type: 'account_onboarding',
    })

    return Response.json({
      success: true,
      onboardingUrl: accountLink.url,
      stripeAccountId: accountId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Stripe onboarding link'
    return Response.json({ error: message }, { status: 500 })
  }
}
