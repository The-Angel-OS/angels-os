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
import { sendOrderConfirmationEmail } from '@/utilities/sendOrderConfirmationEmail'
import { logError } from '@/utilities/logError'

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
      // ── Recurring memberships/dues — sync the Memberships collection ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertMembershipFromSubscription(payload, event.data.object as Stripe.Subscription)
        break
      }
      default: {
        // Unhandled event type — acknowledge receipt
        break
      }
    }
  } catch (err) {
    // Return 200 to prevent Stripe retry storms for handler errors — but ESCALATE
    // first. A swallowed payment/membership sync failure was previously invisible;
    // it must reach the error channel so the self-improvement loop catches it.
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err)
    // Best-effort tenant from the event object metadata (varies per event type).
    const meta = (event.data?.object as { metadata?: Record<string, string> })?.metadata
    const tenantId = meta?.tenantId ? Number(meta.tenantId) : undefined
    await logError({
      source: 'stripe-webhooks',
      message: `Stripe webhook handler failed for ${event.type}: ${err instanceof Error ? err.message : String(err)}`,
      details: `event=${event.id} type=${event.type} account=${connectedAccountId || 'platform'}\n${err instanceof Error ? err.stack : String(err)}`,
      statusCode: 200,
      tenantId,
    })
  }

  return Response.json({ received: true })
}

// ─── Event Handlers ──────────────────────────────────────────────

/**
 * Sync a Stripe subscription → the Memberships collection (the authoritative
 * "who's a member / dues current" record). Idempotent upsert by subscription id;
 * the membership context (tenant, plan, member) rides on the subscription metadata
 * set at checkout.
 */
async function upsertMembershipFromSubscription(
  payload: Parameters<PayloadHandler>[0]['payload'],
  sub: Stripe.Subscription,
) {
  const meta = (sub.metadata || {}) as Record<string, string>
  if (meta.angelOs_type !== 'membership' || !meta.tenantId) return

  // current_period_end moved off the top-level Subscription in newer API versions —
  // read it defensively (top-level, else the first item's period end).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cpe = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end
  const periodEnd = cpe ? new Date(cpe * 1000).toISOString() : undefined
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  const memberUserId = meta.memberUserId ? Number(meta.memberUserId) : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {
    tenant: Number(meta.tenantId),
    ...(memberUserId ? { member: memberUserId } : {}),
    ...(meta.memberEmail ? { memberEmail: meta.memberEmail } : {}),
    ...(meta.memberName ? { memberName: meta.memberName } : {}),
    ...(meta.planId ? { planId: meta.planId } : {}),
    ...(meta.planName ? { planName: meta.planName } : {}),
    status: sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due' || sub.status === 'canceled'
      ? sub.status
      : 'incomplete',
    stripeSubscriptionId: sub.id,
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    startedAt: new Date((sub.start_date || sub.created) * 1000).toISOString(),
  }

  try {
    const existing = await payload.find({
      collection: 'memberships',
      where: { stripeSubscriptionId: { equals: sub.id } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const doc = existing.docs?.[0] as { id: number | string } | undefined
    if (doc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({ collection: 'memberships', id: doc.id, data, overrideAccess: true })
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.create as any)({ collection: 'memberships', data, overrideAccess: true })
    }
  } catch (err) {
    console.error('[Stripe Webhook] Failed to upsert membership:', err instanceof Error ? err.message : err)
    void logError({
      level: 'warning',
      source: 'stripe-webhooks/upsertMembership',
      message: `Failed to sync membership from subscription ${sub.id}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      tenantId: meta.tenantId ? Number(meta.tenantId) : undefined,
    })
  }
}

async function handlePaymentIntentSucceeded(
  payload: Parameters<PayloadHandler>[0]['payload'],
  paymentIntent: Stripe.PaymentIntent,
  connectedAccountId?: string,
) {
  const amountCents = paymentIntent.amount
  const metadata = paymentIntent.metadata || {}
  const isDirectCharge = Boolean(connectedAccountId)
  const chargeModel = metadata.angelOs_chargeModel || (isDirectCharge ? 'direct' : 'platform')

  console.log(
    `[Stripe Webhook] Payment succeeded: ${paymentIntent.id} ` +
    `(${chargeModel} charge, $${(amountCents / 100).toFixed(2)})` +
    (connectedAccountId ? ` on account ${connectedAccountId}` : ''),
  )

  // ── Sprint 43: Donation handling — 100% to Justice Fund ─────────
  if (metadata.angelOs_type === 'donation') {
    console.log(`[Stripe Webhook] Recording donation: $${(amountCents / 100).toFixed(2)}`)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.create as any)({
        collection: 'justice-fund-transactions',
        data: {
          type: 'allocation',
          amountCents,
          sourcePaymentIntentId: paymentIntent.id,
          sourceTotalCents: amountCents,
          percentage: 100,
          description: `Donation $${(amountCents / 100).toFixed(2)}${metadata.donorName ? ` from ${metadata.donorName}` : ''}${metadata.message ? `: ${metadata.message}` : ''}`,
          status: 'completed',
          processedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      console.log(`[Stripe Webhook] Donation recorded to Justice Fund`)
    } catch (err) {
      console.error('[Stripe Webhook] Failed to record donation:', err)
      void logError({
        level: 'warning',
        source: 'stripe-webhooks/recordDonation',
        message: `Failed to record donation ($${(amountCents / 100).toFixed(2)}, PI ${paymentIntent.id}) to Justice Fund: ${err instanceof Error ? err.message : String(err)}`,
        details: err instanceof Error ? err.stack : String(err),
        tenantId: metadata.tenantId ? Number(metadata.tenantId) : undefined,
      })
    }
    return // Donations don't have orders — exit early
  }

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
      void logError({
        level: 'warning',
        source: 'stripe-webhooks/justiceFundAllocation',
        message: `Failed to record Justice Fund allocation ($${(justiceFundAmount / 100).toFixed(2)}) from ${chargeModel} charge ${paymentIntent.id}: ${err instanceof Error ? err.message : String(err)}`,
        details: err instanceof Error ? err.stack : String(err),
        tenantId: metadata.tenantId ? Number(metadata.tenantId) : undefined,
      })
    }
  }

  // Try to update the related order status if metadata includes orderId
  const orderId = paymentIntent.metadata?.orderId
  if (orderId) {
    try {
      // Mark paid + decrement product inventory on the FIRST transition only
      // (idempotent — a webhook retry sees status==='paid' and skips). This is
      // what keeps inventory truthful across online/kiosk/QR/POS so Hays can't
      // oversell his 100 dish gardens.
      const { markOrderPaidAndDecrementInventory } = await import('@/utilities/applyOrderInventory')
      const result = await markOrderPaidAndDecrementInventory(payload, orderId)
      if (result.applied && result.decremented.length) {
        console.log(`[Stripe Webhook] Order ${orderId} paid — inventory decremented:`, result.decremented)
      }
    } catch (e) {
      // Non-fatal: never let inventory bookkeeping break payment handling.
      console.error('[Stripe Webhook] markOrderPaid/inventory failed:', e instanceof Error ? e.message : e)
      void logError({
        level: 'warning',
        source: 'stripe-webhooks/markOrderPaidInventory',
        message: `markOrderPaid/inventory-decrement failed for order ${orderId} (PI ${paymentIntent.id}): ${e instanceof Error ? e.message : String(e)}`,
        details: e instanceof Error ? e.stack : String(e),
        tenantId: metadata.tenantId ? Number(metadata.tenantId) : undefined,
      })
    }

    // ── User Propagation: buyer → seller's tenant (Sprint 42) ──
    try {
      const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await (payload.findByID as any)({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
      })
      const orderTenantId = order?.tenant
        ? (typeof order.tenant === 'object' ? order.tenant.id : order.tenant)
        : undefined
      const orderUserId = order?.orderedBy
        ? (typeof order.orderedBy === 'object' ? order.orderedBy.id : order.orderedBy)
        : (order?.customer
          ? (typeof order.customer === 'object' ? order.customer.id : order.customer)
          : undefined)
      if (orderTenantId && orderUserId) {
        await ensureTenantMembership(orderUserId, orderTenantId)
      }
    } catch {
      // Non-fatal: propagation failure must never break payment handling
    }

    // Send order confirmation email
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await (payload.findByID as any)({
        collection: 'orders',
        id: orderId,
        depth: 1,
        overrideAccess: true,
      })

      const customerEmail =
        paymentIntent.metadata?.customerEmail ||
        paymentIntent.receipt_email ||
        order?.orderedBy?.email ||
        (typeof order?.orderedBy === 'object' ? order.orderedBy?.email : null)

      if (customerEmail) {
        // Build order items from the order data
        const orderItems: Array<{ title: string; quantity: number; priceInUSD: number }> = []
        const items = order?.items || []
        for (const item of items) {
          const product = typeof item.product === 'object' ? item.product : null
          orderItems.push({
            title: product?.title || item.productTitle || 'Product',
            quantity: item.quantity || 1,
            priceInUSD: (item.priceInUSD || item.price || 0),
          })
        }

        // Get Stripe receipt URL from the latest charge
        let receiptUrl: string | undefined
        try {
          const stripe = getStripe()
          if (connectedAccountId) {
            const charges = await stripe.charges.list(
              { payment_intent: paymentIntent.id, limit: 1 },
              { stripeAccount: connectedAccountId },
            )
            receiptUrl = charges.data[0]?.receipt_url || undefined
          } else {
            const charges = await stripe.charges.list(
              { payment_intent: paymentIntent.id, limit: 1 },
            )
            receiptUrl = charges.data[0]?.receipt_url || undefined
          }
        } catch {
          // Receipt URL is nice-to-have, not critical
        }

        const customerName =
          paymentIntent.metadata?.customerName ||
          (typeof order?.orderedBy === 'object' ? order.orderedBy?.name : undefined)

        // Resolve tenant for per-tenant email outbound connector
        const orderTenantId = order?.tenant
          ? typeof order.tenant === 'object' ? order.tenant.id : order.tenant
          : undefined

        await sendOrderConfirmationEmail({
          payload,
          tenantId: orderTenantId,
          customerEmail,
          customerName,
          orderId: String(orderId),
          orderItems,
          totalCents: amountCents,
          currency: paymentIntent.currency || 'usd',
          stripeReceiptUrl: receiptUrl,
        })
      }
    } catch (err) {
      // Email send failure should never break the webhook
      console.error('[Stripe Webhook] Failed to send order confirmation email:', err)
      void logError({
        level: 'warning',
        source: 'stripe-webhooks/orderConfirmationEmail',
        message: `Failed to send order confirmation email for order ${orderId} (PI ${paymentIntent.id}): ${err instanceof Error ? err.message : String(err)}`,
        details: err instanceof Error ? err.stack : String(err),
        tenantId: metadata.tenantId ? Number(metadata.tenantId) : undefined,
      })
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
    void logError({
      level: 'warning',
      source: 'stripe-webhooks/accountUpdated',
      message: `Failed to sync Stripe Connect account ${account.id} to tenant ${tenant.id}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      tenantId: tenant.id,
    })
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
      void logError({
        level: 'warning',
        source: 'stripe-webhooks/orderCancelOnPaymentFailure',
        message: `Failed to mark order ${orderId} cancelled after payment failure (PI ${paymentIntent.id}): ${err instanceof Error ? err.message : String(err)}`,
        details: err instanceof Error ? err.stack : String(err),
        tenantId: paymentIntent.metadata?.tenantId ? Number(paymentIntent.metadata.tenantId) : undefined,
      })
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
        void logError({
          level: 'warning',
          source: 'stripe-webhooks/refundOrderUpdate',
          message: `Failed to mark order ${orderId} cancelled after full refund (charge ${charge.id}): ${err instanceof Error ? err.message : String(err)}`,
          details: err instanceof Error ? err.stack : String(err),
          tenantId: pi.metadata?.tenantId ? Number(pi.metadata.tenantId) : undefined,
        })
      }
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Failed to process refund for charge ${charge.id}:`, err)
    void logError({
      level: 'warning',
      source: 'stripe-webhooks/refund',
      message: `Failed to process refund for charge ${charge.id} ($${(amountRefunded / 100).toFixed(2)} refunded): ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
    })
  }
}
