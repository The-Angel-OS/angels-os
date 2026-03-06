/**
 * Stripe Connect Disconnect Endpoint — POST /api/stripe/connect/disconnect
 *
 * Clears the Stripe Connect account from a tenant, allowing the admin
 * to re-initiate onboarding with a different Stripe account.
 *
 * This does NOT delete the Stripe Express account itself — it only
 * removes the link from the Angel OS tenant record so onboarding
 * can start fresh.
 *
 * Auth: Requires super_admin or tenant admin role.
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const stripeConnectDisconnectHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // Rate limit: 5 disconnect requests/min per user
  const rateLimited = applyRateLimit(req, 'stripe_disconnect')
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
  const userRoles = (user as any).roles || [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const isSuperAdmin = Array.isArray(userRoles) && userRoles.includes('super_admin')

  if (!isSuperAdmin) {
    const tenantMemberships = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: user.id } },
          { tenant: { equals: tenantId } },
          { role: { in: ['admin', 'owner'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (tenantMemberships.docs.length === 0) {
      return Response.json(
        { error: 'Only tenant admins or super_admins can disconnect Stripe.' },
        { status: 403 },
      )
    }
  }

  try {
    // Get current tenant to log what we're disconnecting
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId as number,
      depth: 0,
      overrideAccess: true,
    }) as any // eslint-disable-line @typescript-eslint/no-explicit-any

    const previousAccountId = tenant?.stripeConnect?.stripeAccountId

    // Clear the Stripe Connect data from the tenant
    await (payload.update as any)({ // eslint-disable-line @typescript-eslint/no-explicit-any
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnect: {
          stripeAccountId: '',
          stripeOnboardingComplete: false,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          connectedAt: null,
        },
      },
      overrideAccess: true,
    })

    payload.logger.info(
      `[stripe-disconnect] Tenant ${tenantId} disconnected Stripe account ${previousAccountId || '(none)'} by user ${(user as any).email}`,
    )

    return Response.json({
      success: true,
      message: 'Stripe account disconnected. You can now reconnect with a different account.',
      previousAccountId: previousAccountId || null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect Stripe account'
    return Response.json({ error: message }, { status: 500 })
  }
}
