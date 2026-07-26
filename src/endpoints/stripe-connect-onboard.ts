/**
 * Stripe Connect Onboarding Endpoint — POST /api/stripe/connect/onboard
 *
 * Generates a Stripe Connect Express onboarding link for a tenant.
 * The tenant admin initiates this to connect their bank account.
 *
 * @see src/lib/stripe-connect-config.ts — fee configuration
 * @see src/utilities/platformFee.ts — the configured platform rate (95/5 default)
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { createConnectOnboardingLink } from '@/utilities/stripeConnectOnboarding'
import { logError } from '@/utilities/logError'

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

  try {
    const result = await createConnectOnboardingLink(payload, tenantId as number)
    if (result.alreadyComplete) {
      return Response.json({ success: true, alreadyConnected: true, stripeAccountId: result.stripeAccountId })
    }
    return Response.json({ success: true, onboardingUrl: result.onboardingUrl, stripeAccountId: result.stripeAccountId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Stripe onboarding link'

    // Stripe requires the platform profile to be accepted before creating Connect accounts.
    // Surface a user-friendly message instead of the raw Stripe API error.
    if (message.includes('platform-profile') || message.includes('managing losses')) {
      return Response.json(
        {
          error:
            'Stripe requires the platform owner to complete the Connect platform profile first. ' +
            'Please visit https://dashboard.stripe.com/settings/connect/platform-profile to review and accept.',
        },
        { status: 503 },
      )
    }

    await logError({
      source: 'stripe-connect-onboard',
      message: `Stripe Connect onboarding failed: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId: typeof tenantId === 'number' || typeof tenantId === 'string' ? tenantId : undefined,
      userId: user.id,
    })
    return Response.json({ error: message }, { status: 500 })
  }
}
