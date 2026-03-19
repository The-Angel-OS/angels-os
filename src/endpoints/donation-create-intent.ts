/**
 * Donation PaymentIntent Endpoint — POST /api/donation-ops/create-intent
 *
 * Creates a Stripe PaymentIntent for one-time donations to Angel OS.
 * Donations are platform-level charges (not Connect direct charges) —
 * 100% goes to the Justice Fund.
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
})

/** Minimum donation: $1.00 (100 cents) */
const MIN_DONATION_CENTS = 100
/** Maximum donation: $10,000.00 (1,000,000 cents) */
const MAX_DONATION_CENTS = 1_000_000

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

  // ── Create Stripe PaymentIntent (platform account) ────────────
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        angelOs_type: 'donation',
        angelOs_chargeModel: 'platform',
        ...(typeof tenantSlug === 'string' ? { tenantSlug } : {}),
        ...(typeof donorEmail === 'string' ? { donorEmail } : {}),
        ...(typeof donorName === 'string' ? { donorName } : {}),
        ...(typeof message === 'string' ? { message: message.slice(0, 500) } : {}),
      },
      ...(typeof donorEmail === 'string' ? { receipt_email: donorEmail } : {}),
      description: `Angel OS Donation${typeof donorName === 'string' ? ` from ${donorName}` : ''}`,
    })

    console.log(
      `[Donation] PaymentIntent created: ${paymentIntent.id} ($${(amount / 100).toFixed(2)})`,
    )

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err) {
    console.error('[Donation] Failed to create PaymentIntent:', err)
    return Response.json(
      { error: 'Failed to create payment. Please try again.' },
      { status: 500 },
    )
  }
}
