/**
 * Stripe Webhook Handler — POST /api/stripe/webhooks
 *
 * Handles Stripe events for Connect Direct Charges and payment processing.
 * Idempotent: stores processed event IDs to prevent duplicate handling.
 *
 * Direct Charges model:
 * - Payments are created ON the seller's connected account
 * - Platform receives application_fee as an automatic transfer
 * - Connect webhook events include an `account` field identifying the seller
 * - payment_intent.succeeded fires for BOTH direct and platform charges
 *
 * Events handled:
 * - payment_intent.succeeded — record Justice Fund allocation, update order status
 * - account.updated — sync Connect account onboarding status to tenant
 *
 * Webhook setup:
 * - In Stripe Dashboard → Webhooks → Add endpoint
 * - URL: https://www.spacesangels.com/api/stripe/webhooks
 * - IMPORTANT: Check "Listen to events on Connected accounts" for direct charges
 * - Events: payment_intent.succeeded, payment_intent.payment_failed,
 *           account.updated, charge.refunded
 *
 * @see src/lib/ultimate-fair-split.ts — split calculation
 * @see src/lib/stripe-connect-config.ts — fee configuration
 * @see src/lib/angel-os-stripe-adapter.ts — direct charges implementation
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'
import { calculateUltimateFairSplit, ULTIMATE_FAIR_SPLIT } from '@/lib/ultimate-fair-split'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil' as any,
    })
  }
  return _stripe
}

export const stripeWebhooksHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // Read raw body for signature verification
  let rawBody: string
  try {
    rawBody = await (req as Request).text()
  } catch {
    return Response.json({ error: 'Could not read request body' }, { status: 400 })
  }

  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOKS_SIGNING_SECRET

  if (!sig || !webhookSecret) {
    return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return Response.json({ error: message }, { status: 400 })
  }

  // For direct charges, the event includes `account` identifying the connected account.
  // This lets us know which seller the payment belongs to.
  const connectedAccountId = (event as any).account as string | undefined

  // Idempotency check — DB-persisted (survives deploys)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pse = payload as any // ProcessedStripeEvents not yet in generated types
  try {
    const existing = await pse.find({
      collection: 'processed-stripe-events',
      where: { eventId: { equals: event.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      return Response.json({ received: true, duplicate: true })
    }
  } catch (err) {
    // If the collection doesn't exist yet (pre-migration), log and continue
    console.warn('[Stripe Webhook] Idempotency check failed, proceeding:', err)
  }

  // Record the event as processed before handling (at-most-once delivery)
  try {
    await pse.create({
      collection: 'processed-stripe-events',
      data: {
        eventId: event.id,
        eventType: event.type,
        connectedAccountId: connectedAccountId || null,
        processedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch (err) {
    // Unique constraint violation means another instance already processed this event
    if (String(err).includes('unique') || String(err).includes('duplicate')) {
      return Response.json({ received: true, duplicate: true })
    }
    console.warn('[Stripe Webhook] Failed to record processed event:', err)
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(payload, paymentIntent, connectedAccountId)
        break
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentFailed(payload, paymentIntent, connectedAccountId)
        break
      }
      case 'account.updated': {
        await handleAccountUpdated(payload, event.data.object as Stripe.Account)
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(payload, charge, connectedAccountId)
        break
      }
      default: {
        // Unhandled event type — acknowledge receipt
        break
      }
    }
  } catch (err) {
    // Log error but return 200 to prevent Stripe retries for handler errors
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err)
  }

  return Response.json({ received: true })
}

// ─── Event Handlers ──────────────────────────────────────────────

async function handlePaymentIntentSucceeded(
  payload: Parameters<PayloadHandler>[0]['payload'],
  paymentIntent: Stripe.PaymentIntent,
  connectedAccountId?: string,
) {
  const amountCents = paymentIntent.amount
  const isDirectCharge = Boolean(connectedAccountId)
  const chargeModel = paymentIntent.metadata?.angelOs_chargeModel || (isDirectCharge ? 'direct' : 'platform')

  console.log(
    `[Stripe Webhook] Payment succeeded: ${paymentIntent.id} ` +
    `(${chargeModel} charge, $${(amountCents / 100).toFixed(2)})` +
    (connectedAccountId ? ` on account ${connectedAccountId}` : ''),
  )

  // For direct charges, the application_fee has already been split by Stripe.
  // The connected account received (amount - application_fee).
  // The platform received the application_fee.
  // We still need to record the Justice Fund allocation for our internal accounting.
  const splits = calculateUltimateFairSplit(amountCents)
  const justiceFundAmount = splits.find((s) => s.recipient === 'JUSTICE_FUND')?.amount || 0

  // Record Justice Fund allocation
  if (justiceFundAmount > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.create as any)({
        collection: 'justice-fund-transactions',
        data: {
          type: 'allocation',
          amountCents: justiceFundAmount,
          sourcePaymentIntentId: paymentIntent.id,
          sourceTotalCents: amountCents,
          percentage: ULTIMATE_FAIR_SPLIT.JUSTICE_FUND * 100,
          description: `5% allocation from ${chargeModel} charge ${paymentIntent.id}${connectedAccountId ? ` (seller: ${connectedAccountId})` : ''}`,
          status: 'completed',
          processedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    } catch (err) {
      // Justice Fund collection may not exist yet — log but don't fail
      console.error('[Stripe Webhook] Failed to record Justice Fund allocation:', err)
    }
  }

  // Try to update the related order status if metadata includes orderId
  const orderId = paymentIntent.metadata?.orderId
  if (orderId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'orders',
        id: orderId,
        data: {
          status: 'paid',
        },
        overrideAccess: true,
      })
    } catch {
      // Order may not exist or have different status field — non-fatal
    }
  }
}

async function handleAccountUpdated(
  payload: Parameters<PayloadHandler>[0]['payload'],
  account: Stripe.Account,
) {
  // Find tenant by Stripe account ID
  const tenants = await payload.find({
    collection: 'tenants',
    where: {
      'stripeConnect.stripeAccountId': { equals: account.id },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (tenants.docs.length === 0) return

  const tenant = tenants.docs[0]

  // Sync account status
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnect: {
          stripeAccountId: account.id,
          stripeOnboardingComplete: Boolean(account.details_submitted),
          stripeChargesEnabled: Boolean(account.charges_enabled),
          stripePayoutsEnabled: Boolean(account.payouts_enabled),
        },
      },
      overrideAccess: true,
    })

    console.log(
      `[Stripe Webhook] Account updated: ${account.id} → ` +
      `charges=${account.charges_enabled}, payouts=${account.payouts_enabled}, ` +
      `details_submitted=${account.details_submitted}`,
    )
  } catch (err) {
    console.error(`[Stripe Webhook] Failed to sync account ${account.id}:`, err)
  }
}

// ─── Payment Failed Handler ──────────────────────────────────────────

async function handlePaymentIntentFailed(
  payload: Parameters<PayloadHandler>[0]['payload'],
  paymentIntent: Stripe.PaymentIntent,
  connectedAccountId?: string,
) {
  const failureMessage = paymentIntent.last_payment_error?.message || 'Unknown error'
  const chargeModel = paymentIntent.metadata?.angelOs_chargeModel || (connectedAccountId ? 'direct' : 'platform')

  console.error(
    `[Stripe Webhook] Payment FAILED: ${paymentIntent.id} ` +
    `(${chargeModel} charge, $${(paymentIntent.amount / 100).toFixed(2)}) — ${failureMessage}` +
    (connectedAccountId ? ` on account ${connectedAccountId}` : ''),
  )

  // Update order status to failed if orderId exists in metadata
  const orderId = paymentIntent.metadata?.orderId
  if (orderId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await (payload.findByID as any)({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
      })

      // Only update if order is still in a pending/processing state
      const currentStatus = order?.status
      if (currentStatus && !['paid', 'fulfilled', 'cancelled'].includes(currentStatus)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (payload.update as any)({
          collection: 'orders',
          id: orderId,
          data: { status: 'cancelled' },
          overrideAccess: true,
        })
        console.log(`[Stripe Webhook] Order ${orderId} marked as cancelled due to payment failure`)
      }
    } catch (err) {
      console.error(`[Stripe Webhook] Failed to update order ${orderId} after payment failure:`, err)
    }
  }
}

// ─── Charge Refunded Handler ──────────────────────────────────────────

async function handleChargeRefunded(
  payload: Parameters<PayloadHandler>[0]['payload'],
  charge: Stripe.Charge,
  connectedAccountId?: string,
) {
  const isFullRefund = charge.refunded
  const amountRefunded = charge.amount_refunded

  console.log(
    `[Stripe Webhook] Refund processed on ${connectedAccountId || 'platform'}: ` +
    `charge ${charge.id}, amount refunded: $${(amountRefunded / 100).toFixed(2)}` +
    (isFullRefund ? ' (FULL REFUND)' : ' (partial)'),
  )

  // Find and update the related order if payment_intent metadata has orderId
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id

  if (!paymentIntentId) return

  try {
    // Look up the order via the payment intent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = getStripe()
    const pi = connectedAccountId
      ? await stripe.paymentIntents.retrieve(paymentIntentId, undefined, { stripeAccount: connectedAccountId })
      : await stripe.paymentIntents.retrieve(paymentIntentId)

    const orderId = pi.metadata?.orderId
    if (orderId && isFullRefund) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (payload.update as any)({
          collection: 'orders',
          id: orderId,
          data: { status: 'cancelled' },
          overrideAccess: true,
        })
        console.log(`[Stripe Webhook] Order ${orderId} marked as cancelled after full refund`)
      } catch (err) {
        console.error(`[Stripe Webhook] Failed to update order ${orderId} after refund:`, err)
      }
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Failed to process refund for charge ${charge.id}:`, err)
  }
}
