/**
 * Donation PaymentIntent Endpoint — POST /api/donation-ops/create-intent
 *
 * Creates a Stripe PaymentIntent for one-time donations. Endeavor-specific:
 * a donation on a tenant's /donate is a destination charge to that endeavor's
 * connected account (the Justice Fund share is kept as the application fee).
 * Platform context (no Connect-enabled tenant) → platform charge, 100% Justice Fund.
 *
 * No authentication required — donations are public.
 *
 * Request body:
 *   { amount: number (cents, min 100), donorEmail?: string, donorName?: string, message?: string }
 *
 * Response:
 *   { clientSecret: string, paymentIntentId: string }
 *
 * Sprint 43 — Monetization Go-Live
 */

import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'
import { logError } from '@/utilities/logError'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    })
  }
  return _stripe
}

/** Minimum donation: $1.00 (100 cents) */
const MIN_DONATION_CENTS = 100
/** Maximum donation: $10,000.00 (1,000,000 cents) */
const MAX_DONATION_CENTS = 1_000_000
/** Justice Fund share (constitutional floor) taken from endeavor donations. */
const DONATION_JUSTICE_FUND_PERCENT = 5

export const donationCreateIntentHandler: PayloadHandler = async (req) => {
  // ── Parse body ────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await (req as unknown as Request).json()
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { amount, donorEmail, donorName, message, tenantSlug } = body

  // ── Validate amount ───────────────────────────────────────────
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return Response.json(
      { error: 'amount must be an integer (cents)' },
      { status: 400 },
    )
  }

  if (amount < MIN_DONATION_CENTS) {
    return Response.json(
      { error: `Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}` },
      { status: 400 },
    )
  }

  if (amount > MAX_DONATION_CENTS) {
    return Response.json(
      { error: `Maximum donation is $${(MAX_DONATION_CENTS / 100).toFixed(2)}` },
      { status: 400 },
    )
  }

  // ── Resolve the recipient endeavor ────────────────────────────
  // A donation on a tenant's /donate raises funds FOR that endeavor: a Stripe
  // destination charge routes the gift to the endeavor's connected account,
  // with the constitutional Justice Fund share kept as the application fee.
  // Platform context (no tenant / not Connect-enabled) keeps the legacy
  // behavior: a platform charge, 100% to the Justice Fund.
  // The HOST is authoritative for "whose site is this gift on": the middleware sets
  // x-tenant-id from the hostname (e.g. grace-chapel.spacesangels.com → 'grace-chapel'),
  // which is correct even when the client's payload-tenant cookie is absent or stale
  // (the public church site has no such cookie). Body tenantSlug is the fallback.
  const headerTenant = req.headers?.get('x-tenant-id') || ''
  const bodySlug = typeof tenantSlug === 'string' && tenantSlug && tenantSlug !== 'default' ? tenantSlug : ''
  const slug = headerTenant || bodySlug
  let connectedAccountId: string | null = null
  let resolvedTenantId: number | undefined
  let recipientName = 'the Justice Fund'
  let chargeModel: 'destination' | 'platform' = 'platform'
  let applicationFee = 0

  if (slug && slug !== 'default' && slug !== 'platform') {
    try {
      const tenants = await req.payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const tenant = tenants.docs?.[0] as any
      if (tenant?.id != null) resolvedTenantId = Number(tenant.id)
      const connect = tenant?.stripeConnect as Record<string, unknown> | undefined
      if (
        tenant &&
        tenant.type !== 'platform' &&
        connect?.stripeAccountId &&
        connect?.stripeChargesEnabled
      ) {
        connectedAccountId = connect.stripeAccountId as string
        recipientName = tenant.branding?.siteName || tenant.name || 'this enterprise'
        chargeModel = 'destination'
        applicationFee = Math.round((amount * DONATION_JUSTICE_FUND_PERCENT) / 100)
      }
    } catch (err) {
      // Fall back to platform / Justice Fund on any lookup failure — but ESCALATE:
      // a failed tenant/Connect-account lookup silently misroutes a donation meant
      // for this endeavor to the platform account. That must never be invisible.
      void logError({
        level: 'warning',
        source: 'donation-create-intent/resolveTenantAccount',
        message: `Failed to resolve Stripe Connect account for tenant '${slug}' — donation of $${(amount / 100).toFixed(2)} may misroute to the platform: ${err instanceof Error ? err.message : String(err)}`,
        details: err instanceof Error ? err.stack : String(err),
        tenantId: resolvedTenantId,
      })
    }
  }

  // ── Create Stripe PaymentIntent ───────────────────────────────
  try {
    const paymentIntent = await getStripe().paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      // Destination charge → funds flow to the endeavor's connected account
      ...(connectedAccountId
        ? {
            transfer_data: { destination: connectedAccountId },
            application_fee_amount: applicationFee,
          }
        : {}),
      metadata: {
        angelOs_type: 'donation',
        angelOs_chargeModel: chargeModel,
        recipientName,
        ...(slug ? { recipientTenant: slug } : {}),
        ...(applicationFee ? { angelOs_justiceFundCents: String(applicationFee) } : {}),
        ...(typeof donorEmail === 'string' ? { donorEmail } : {}),
        ...(typeof donorName === 'string' ? { donorName } : {}),
        ...(typeof message === 'string' ? { message: message.slice(0, 500) } : {}),
      },
      ...(typeof donorEmail === 'string' ? { receipt_email: donorEmail } : {}),
      description: `Donation to ${recipientName}${typeof donorName === 'string' ? ` from ${donorName}` : ''}`,
    })

    console.log(
      `[Donation] PaymentIntent ${paymentIntent.id} ($${(amount / 100).toFixed(2)}) → ${recipientName} [${chargeModel}]`,
    )

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      recipientName,
      chargeModel,
    })
  } catch (err) {
    console.error('[Donation] Failed to create PaymentIntent:', err)
    await logError({
      source: 'donation-create-intent',
      message: `Failed to create donation PaymentIntent: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId: resolvedTenantId,
    })
    return Response.json(
      { error: 'Failed to create payment. Please try again.' },
      { status: 500 },
    )
  }
}
