/**
 * Membership Checkout — POST /api/membership-ops/checkout
 *
 * Starts a recurring membership/dues subscription for an endeavor's plan. Creates a
 * Stripe Checkout Session in subscription mode as a DESTINATION charge: the
 * subscription lives on the platform, net dues transfer to the endeavor's connected
 * account, and the platform keeps a small application fee. Subscription lifecycle is
 * synced to the Memberships collection by the platform webhook.
 *
 * Recipient tenant is resolved from the request HOST (x-tenant-id) first — the same
 * fix as donations — so a public church/gym site routes dues to ITS account even
 * with no payload-tenant cookie. The endeavor must have Stripe Connect onboarded.
 *
 * No auth required (a member may not have an account yet); the member is identified
 * by email + the logged-in user when present.
 *
 * Body: { planId, memberEmail?, memberName? }
 * Response: { url }  (Stripe-hosted checkout)
 *
 * @see src/utilities/membershipPlans.ts  @see src/collections/Memberships
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'
import { getMembershipPlan } from '@/utilities/membershipPlans'
import { getBillingMode } from '@/utilities/billingMode'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
  }
  return _stripe
}

/** Platform fee on membership dues (percent). Honest/small per the constitution. */
const PLATFORM_FEE_PERCENT = Number(process.env.MEMBERSHIP_PLATFORM_FEE_PERCENT || 2)

export const membershipCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }

  const planId = typeof body.planId === 'string' ? body.planId.trim() : ''
  if (!planId) return Response.json({ error: 'planId is required' }, { status: 400 })

  // Recipient tenant: host-authoritative (x-tenant-id), body slug as fallback.
  const headerTenant = req.headers?.get('x-tenant-id') || ''
  const bodySlug = typeof body.tenantSlug === 'string' && body.tenantSlug && body.tenantSlug !== 'default' ? body.tenantSlug : ''
  const slug = headerTenant || bodySlug
  if (!slug) return Response.json({ error: 'Could not resolve the endeavor for this membership.' }, { status: 400 })

  let resolvedTenantId: number | undefined
  try {
    const tenants = await payload.find({
      collection: 'tenants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = tenants.docs?.[0] as any
    if (tenant?.id != null) resolvedTenantId = Number(tenant.id)
    if (!tenant) return Response.json({ error: `No endeavor "${slug}"` }, { status: 404 })

    // Billing topology: first-party portals bill PLATFORM-DIRECT (money to the
    // root's Stripe, no Connect); third-party endeavors use a Connect DESTINATION
    // charge (Stripe settles their bank). Default is platform-direct.
    const billingMode = await getBillingMode(payload, tenant.id)
    const connect = tenant.stripeConnect as Record<string, unknown> | undefined

    // Connect is REQUIRED only for the destination-charge (third-party) path.
    if (billingMode === 'connect' && (!connect?.stripeAccountId || !connect?.stripeChargesEnabled)) {
      return Response.json(
        { error: `${tenant.name || slug} hasn't finished connecting their bank yet — memberships can't be collected until then.` },
        { status: 409 },
      )
    }

    const plan = await getMembershipPlan(payload, tenant.id, planId)
    if (!plan) return Response.json({ error: `No membership plan "${planId}"` }, { status: 404 })
    if (plan.active === false) return Response.json({ error: 'That plan is not currently available.' }, { status: 409 })

    // Payment rail. Recurring RENT should ride ACH bank-debit (0.8%, capped $5)
    // — card (2.9%+30¢) is ~$44/mo on $1,500 rent and kills the model. Gym/church
    // dues stay on card (ACH's verification step is clunky for small dues), so ACH
    // is OPT-IN per request: rail='ach' (bank only) | 'both' (bank+card) | default
    // card. @see docs/strategy/BOOKABLE_INVENTORY_PLAN.md §4.
    // Rent plans prefer ACH by default (the caller can still force a rail).
    const rail =
      typeof body.rail === 'string' && body.rail.trim()
        ? body.rail.trim().toLowerCase()
        : plan.kind === 'rent'
          ? 'ach'
          : ''
    const wantsAch = rail === 'ach' || rail === 'both'
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] | undefined =
      rail === 'ach' ? ['us_bank_account'] : rail === 'both' ? ['us_bank_account', 'card'] : undefined

    const memberEmail = typeof body.memberEmail === 'string' ? body.memberEmail.trim() : ((user as { email?: string } | null)?.email || '')
    const memberName = typeof body.memberName === 'string' ? body.memberName.trim() : ((user as { name?: string } | null)?.name || '')
    const baseUrl = getServerSideURL()
    // Plan-level fee override (admin-set, trusted) wins over the env default — a
    // rent plan set feePercent:0 bills the renter fee-free (money all to the
    // landlady's connected account).
    const feeBase = typeof plan.feePercent === 'number' ? plan.feePercent : PLATFORM_FEE_PERCENT
    const applicationFeePercent = Math.max(0, Math.min(feeBase, 100))

    const subMetadata = {
      angelOs_type: 'membership',
      tenantId: String(tenant.id),
      tenantSlug: slug,
      planId: plan.id,
      planName: plan.name,
    }

    // Connect (third-party): destination-transfer the dues to their account, keep
    // the platform fee. Platform-direct (first-party, default): no transfer, no
    // fee — the money is the platform's; the webhook records the Membership either
    // way (both carry angelOs_type 'membership' + tenantId).
    const subscription_data =
      billingMode === 'connect'
        ? {
            transfer_data: { destination: connect!.stripeAccountId as string },
            application_fee_percent: applicationFeePercent,
            metadata: subMetadata,
          }
        : { metadata: subMetadata }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: { name: `${plan.name} — ${tenant.name || slug}` },
            unit_amount: plan.amountCents,
            recurring: { interval: plan.interval },
          },
        },
      ],
      subscription_data,
      // ACH bank-debit rail (opt-in). Checkout collects the mandate and verifies
      // the bank instantly via Financial Connections. Omitted → Stripe's card default.
      ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),
      ...(wantsAch
        ? { payment_method_options: { us_bank_account: { verification_method: 'automatic' as const } } }
        : {}),
      ...(memberEmail ? { customer_email: memberEmail } : {}),
      success_url: `${baseUrl}/?membership=success`,
      cancel_url: `${baseUrl}/?membership=cancelled`,
      metadata: {
        angelOs_type: 'membership',
        tenantId: String(tenant.id),
        tenantSlug: slug,
        planId: plan.id,
        planName: plan.name,
        ...(memberName ? { memberName } : {}),
        ...(memberEmail ? { memberEmail } : {}),
        ...((user as { id?: number | string } | null)?.id != null ? { memberUserId: String((user as { id: number | string }).id) } : {}),
      },
    })

    return Response.json({ url: session.url, sessionId: session.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[membership-checkout] ${msg}`)
    await logError({
      source: 'membership-checkout',
      message: `Membership checkout failed: ${msg}`,
      details: e instanceof Error ? e.stack : String(e),
      statusCode: 500,
      tenantId: resolvedTenantId,
    })
    if (msg.includes('platform-profile') || msg.includes('managing losses')) {
      return Response.json({ error: 'Stripe needs the platform Connect profile accepted before subscriptions can run. Please try again shortly.' }, { status: 503 })
    }
    return Response.json({ error: 'Could not start the membership checkout. Please try again.' }, { status: 500 })
  }
}
