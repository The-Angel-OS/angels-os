/**
 * Guardian Angel Checkout — POST /api/provision-ops/guardian-angel-checkout
 *
 * Starts the paid Guardian Angel subscription: the signed-in user subscribes to
 * their own tier, paying THE PLATFORM directly (spacesangels.com is the merchant
 * — no Stripe Connect, no destination transfer, unlike membership dues). The
 * subscription lifecycle syncs to the `memberships` collection via the platform
 * webhook (angelOs_type: 'guardian_angel'), which `hasGuardianAngelEntitlement`
 * then reads.
 *
 * Provisioning stays FREE — this is the OVERAGE upsell, offered when a user
 * crosses their free-tier allowance (see guardianUsage), never a gate to entry.
 *
 * Inert until STRIPE_SECRET_KEY is set; returns a friendly 503 otherwise so the
 * funnel shape exists before keys are wired.
 *
 * Response: { url }  (Stripe-hosted checkout)
 *
 * @see src/utilities/guardianEntitlement.ts
 * @see src/endpoints/stripe-webhooks.ts — upsertMembershipFromSubscription
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import {
  GUARDIAN_ANGEL_PLAN_ID,
  GUARDIAN_ANGEL_PLAN_NAME,
  guardianAngelPriceCents,
  resolveGuardianTenant,
} from '@/utilities/guardianEntitlement'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    })
  }
  return _stripe
}

export const guardianAngelCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json(
      { error: 'The Guardian Angel subscription is not available on this node yet.' },
      { status: 503 },
    )
  }

  const u = user as { id: number | string; email?: string; name?: string }

  try {
    // Resolve the caller's PERSONAL guardian tenant (marked isGuardianAngel), not
    // a business they happen to admin.
    const guardianTenant = await resolveGuardianTenant(payload, u.id)
    const guardianTenantId = guardianTenant?.id
    if (guardianTenantId == null) {
      return Response.json({ error: 'Claim your guardian angel before subscribing.' }, { status: 404 })
    }

    const priceCents = guardianAngelPriceCents()
    const baseUrl = getServerSideURL()
    const memberEmail = (u.email || '').trim()
    const memberName = (u.name || '').trim()

    // Metadata note: we set `tenantId` = the guardian tenant so the EXISTING
    // webhook upsert (which reads meta.tenantId) syncs the membership unchanged.
    const meta: Record<string, string> = {
      angelOs_type: 'guardian_angel',
      tenantId: String(guardianTenantId),
      guardianTenantId: String(guardianTenantId),
      planId: GUARDIAN_ANGEL_PLAN_ID,
      planName: GUARDIAN_ANGEL_PLAN_NAME,
      memberUserId: String(u.id),
      ...(memberName ? { memberName } : {}),
      ...(memberEmail ? { memberEmail } : {}),
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: { name: GUARDIAN_ANGEL_PLAN_NAME },
            unit_amount: priceCents,
            recurring: { interval: 'month' },
          },
        },
      ],
      subscription_data: { metadata: meta },
      ...(memberEmail ? { customer_email: memberEmail } : {}),
      success_url: `${baseUrl}/?guardian=success`,
      cancel_url: `${baseUrl}/?guardian=cancelled`,
      metadata: meta,
    })

    return Response.json({ url: session.url, sessionId: session.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[guardian-angel-checkout] ${msg}`)
    await logError({
      source: 'guardian-angel-checkout',
      message: `Guardian Angel checkout failed: ${msg}`,
      details: e instanceof Error ? e.stack : String(e),
      statusCode: 500,
      userId: u.id,
    }).catch(() => {})
    return Response.json({ error: 'Could not start the subscription. Please try again.' }, { status: 500 })
  }
}
