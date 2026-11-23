/**
 * Unified, Idempotent Payment Fulfillment
 *
 * Handles verified payments & webhooks across BOTH Square and PayPal for all
 * Angel OS commerce surfaces:
 *   - Donations -> JusticeFundTransactions
 *   - Memberships & Guardian Angel -> Memberships collection (+ invited user attach)
 *   - Portal Plans -> Tenants.portalPlan
 *   - Bookings -> Bookings status='confirmed', clear holdExpiresAt
 *   - Shop Orders -> Orders collection + inventory decrement + cart mark purchased + email
 */
import type { Payload } from 'payload'
import { markOrderPaidAndDecrementInventory } from '@/utilities/applyOrderInventory'
import { DONATION_JUSTICE_FUND_PERCENT } from '@/utilities/donationRouting'
import { findOrCreateInvitedUser } from '@/utilities/findOrCreateInvitedUser'
import { bpsToPercent, feeCents, getPlatformFeeBps } from '@/utilities/platformFee'
import { sendOrderConfirmationEmail } from '@/utilities/sendOrderConfirmationEmail'
import { logError } from '@/utilities/logError'
import { updateCheckoutIntent } from './config'
import type { CheckoutIntentRecord, VerifiedPaymentResult } from './types'

async function claimIdempotencyKey(
  payload: Payload,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any
    const existing = await p.find({
      collection: 'processed-stripe-events',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing?.docs?.length > 0) return false

    await p.create({
      collection: 'processed-stripe-events',
      data: {
        eventId,
        eventType,
        processedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    return true
  } catch (err) {
    const msg = String(err)
    if (msg.includes('unique') || msg.includes('duplicate')) return false
    return true
  }
}

async function recordJusticeFundAllocation(
  payload: Payload,
  opts: {
    amountCents: number
    sourceTotalCents: number
    percentage: number
    sourceId: string
    description: string
    tenantId?: number
  },
) {
  if (opts.amountCents <= 0) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.create as any)({
      collection: 'justice-fund-transactions',
      data: {
        type: 'allocation',
        amountCents: opts.amountCents,
        sourcePaymentIntentId: opts.sourceId,
        sourceTotalCents: opts.sourceTotalCents,
        percentage: opts.percentage,
        description: opts.description,
        status: 'completed',
        processedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch (err) {
    void logError({
      level: 'warning',
      source: 'payments/justiceFundAllocation',
      message: `Failed to record Justice Fund allocation (${opts.sourceId}): ${err instanceof Error ? err.message : String(err)}`,
      tenantId: opts.tenantId,
    })
  }
}

async function fulfillSubscriptionMembership(
  payload: Payload,
  intent: CheckoutIntentRecord,
  verified: VerifiedPaymentResult,
) {
  if (!intent.tenantId) return

  let memberUserId = intent.memberUserId ? Number(intent.memberUserId) : undefined
  const memberEmail = (intent.memberEmail || verified.payerEmail || intent.customerEmail || '').trim()
  const memberName = (intent.memberName || verified.payerName || '').trim()

  if (!memberUserId && memberEmail) {
    try {
      const resolved = await findOrCreateInvitedUser(payload, {
        email: memberEmail,
        name: memberName || null,
      })
      memberUserId = Number(resolved.userId)
    } catch (err) {
      void logError({
        level: 'warning',
        source: 'payments/attachMember',
        message: `Could not attach ${verified.provider} subscription (${memberEmail}): ${err instanceof Error ? err.message : String(err)}`,
        tenantId: intent.tenantId,
      })
    }
  }

  const subKey = `${verified.provider}:${verified.subscriptionId || verified.externalId || intent.ref}`
  const status: 'active' | 'past_due' | 'canceled' | 'incomplete' =
    verified.status === 'canceled'
      ? 'canceled'
      : verified.status === 'past_due'
        ? 'past_due'
        : verified.verified || verified.status === 'active' || verified.status === 'completed'
          ? 'active'
          : 'incomplete'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {
    tenant: Number(intent.tenantId),
    ...(memberUserId ? { member: memberUserId } : {}),
    ...(memberEmail ? { memberEmail } : {}),
    ...(memberName ? { memberName } : {}),
    ...(intent.planId ? { planId: intent.planId } : {}),
    ...(intent.planName ? { planName: intent.planName } : {}),
    amountCents: intent.amountCents,
    interval: intent.interval || 'month',
    status,
    stripeSubscriptionId: subKey,
    ...(verified.customerId ? { stripeCustomerId: `${verified.provider}:${verified.customerId}` } : {}),
    ...(verified.currentPeriodEnd ? { currentPeriodEnd: verified.currentPeriodEnd } : {}),
    startedAt: new Date().toISOString(),
    metadata: {
      provider: verified.provider,
      environment: intent.environment,
      ref: intent.ref,
      externalId: verified.externalId,
      transactionId: verified.transactionId,
    },
  }

  const existing = await payload.find({
    collection: 'memberships',
    where: { stripeSubscriptionId: { equals: subKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'memberships',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.create as any)({
      collection: 'memberships',
      data,
      overrideAccess: true,
    })
  }
}

async function fulfillPortalPlan(
  payload: Payload,
  intent: CheckoutIntentRecord,
  verified: VerifiedPaymentResult,
) {
  if (!intent.tenantId) return
  const tenant = (await payload
    .findByID({
      collection: 'tenants',
      id: intent.tenantId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)) as { portalPlan?: string | null } | null

  if (tenant?.portalPlan === 'demo') return

  const live = verified.verified || verified.status === 'active' || verified.status === 'completed'
  const nextPlan =
    live &&
    (intent.portalPlan === 'creator' ||
      intent.portalPlan === 'site' ||
      intent.portalPlan === 'business')
      ? intent.portalPlan
      : 'free'

  if (tenant?.portalPlan === nextPlan) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.update as any)({
    collection: 'tenants',
    id: intent.tenantId,
    data: { portalPlan: nextPlan },
    overrideAccess: true,
  })
}

async function fulfillShopOrder(
  payload: Payload,
  intent: CheckoutIntentRecord,
  verified: VerifiedPaymentResult,
): Promise<{ orderId?: number | string }> {
  if (!intent.cartId) return {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cart = (await (payload.findByID as any)({
    collection: 'carts',
    id: intent.cartId,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null)) as Record<string, any> | null

  if (!cart) return {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems = Array.isArray(cart.items) ? (cart.items as any[]) : []
  const orderItems = rawItems.map((item) => {
    const productId = typeof item.product === 'object' ? item.product?.id : item.product
    const variantId = item.variant
      ? typeof item.variant === 'object'
        ? item.variant.id
        : item.variant
      : undefined
    return {
      product: productId,
      ...(variantId !== undefined ? { variant: variantId } : {}),
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    }
  })

  const customerId =
    typeof cart.customer === 'object' ? cart.customer?.id : cart.customer ?? intent.memberUserId
  const customerEmail = (
    intent.customerEmail ||
    verified.payerEmail ||
    (typeof cart.customer === 'object' ? cart.customer?.email : '') ||
    ''
  ).trim()

  const orderTenant =
    intent.tenantId ??
    (typeof cart.tenant === 'object' ? cart.tenant?.id : cart.tenant) ??
    undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdOrder = await (payload.create as any)({
    collection: 'orders',
    data: {
      ...(orderTenant != null ? { tenant: Number(orderTenant) } : {}),
      items: orderItems,
      amount: verified.amountCents || intent.amountCents,
      currency: 'USD',
      status: 'processing',
      ...(customerId != null ? { customer: Number(customerId) } : {}),
      ...(customerEmail ? { customerEmail } : {}),
      ...(intent.shippingAddress ? { shippingAddress: intent.shippingAddress } : {}),
    },
    overrideAccess: true,
  })

  const orderId = createdOrder?.id
  if (orderId != null) {
    await markOrderPaidAndDecrementInventory(payload, orderId).catch(() => {})
  }

  // Mark cart purchased so cart UI clears cleanly
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.update as any)({
      collection: 'carts',
      id: cart.id,
      data: {
        status: 'purchased',
        purchasedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch {
    // Non-fatal
  }

  if (orderTenant != null && customerId != null) {
    try {
      const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')
      await ensureTenantMembership(customerId, orderTenant)
    } catch {
      // Non-fatal
    }
  }

  if (customerEmail) {
    if (orderTenant != null) {
      void (async () => {
        const { markContactPurchased } = await import('@/utilities/markContactPurchased')
        await markContactPurchased(payload, {
          tenantId: orderTenant,
          email: customerEmail,
        })
      })().catch(() => {})
    }

    const emailItems = rawItems.map((item) => {
      const prod = typeof item.product === 'object' ? item.product : null
      const priceCents =
        (typeof item.variant === 'object' ? item.variant?.priceInUSD : null) ??
        prod?.priceInUSD ??
        0
      return {
        title: String(prod?.title || 'Product'),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        priceInUSD: Number(priceCents) / 100,
      }
    })

    await sendOrderConfirmationEmail({
      payload,
      tenantId: orderTenant,
      customerEmail,
      customerName: verified.payerName,
      orderId: String(orderId),
      orderItems: emailItems,
      totalCents: verified.amountCents || intent.amountCents,
      currency: 'usd',
    }).catch(() => {})
  }

  const feeBps = await getPlatformFeeBps(payload, orderTenant)
  const totalAmount = verified.amountCents || intent.amountCents
  const allocCents = feeCents(totalAmount, feeBps)
  await recordJusticeFundAllocation(payload, {
    amountCents: allocCents,
    sourceTotalCents: totalAmount,
    percentage: Number(bpsToPercent(feeBps)),
    sourceId: `${verified.provider}:${verified.transactionId || verified.externalId}`,
    description: `${bpsToPercent(feeBps)}% allocation from ${verified.provider} order #${orderId}`,
    tenantId: orderTenant != null ? Number(orderTenant) : undefined,
  })

  return { orderId }
}

export async function fulfillVerifiedPayment(
  payload: Payload,
  params: {
    idempotencyKey: string
    intent: CheckoutIntentRecord
    verified: VerifiedPaymentResult
  },
): Promise<{
  fulfilled: boolean
  alreadyProcessed?: boolean
  orderId?: number | string
  bookingId?: number | string
}> {
  const { idempotencyKey, intent, verified } = params

  if (!verified.verified && verified.status !== 'canceled' && verified.status !== 'past_due') {
    return { fulfilled: false }
  }

  const isOneOff =
    intent.kind === 'donation' || intent.kind === 'order' || intent.kind === 'booking'
  const effectiveKey = isOneOff ? `oneoff:${intent.ref}` : idempotencyKey

  if (isOneOff && intent.status === 'completed') {
    return {
      fulfilled: true,
      alreadyProcessed: true,
      orderId: intent.orderId,
      bookingId: intent.bookingId,
    }
  }

  const claimed = await claimIdempotencyKey(
    payload,
    effectiveKey,
    `${verified.provider}:${intent.kind}:${verified.status}`,
  )
  if (!claimed) {
    return {
      fulfilled: true,
      alreadyProcessed: true,
      orderId: intent.orderId,
      bookingId: intent.bookingId,
    }
  }

  await updateCheckoutIntent(payload, intent.ref, {
    status: verified.status === 'canceled' ? 'canceled' : 'completed',
    externalId: verified.externalId || intent.externalId,
  }).catch(() => {})

  if (intent.kind === 'donation') {
    const amount = verified.amountCents || intent.amountCents
    const isDirect = intent.chargeModel === 'direct'
    const allocCents = isDirect
      ? Math.round((amount * DONATION_JUSTICE_FUND_PERCENT) / 100)
      : amount

    await recordJusticeFundAllocation(payload, {
      amountCents: allocCents,
      sourceTotalCents: amount,
      percentage: isDirect ? DONATION_JUSTICE_FUND_PERCENT : 100,
      sourceId: `${verified.provider}:${verified.transactionId || verified.externalId}`,
      description: `Donation $${(amount / 100).toFixed(2)} via ${verified.provider}${intent.donorName ? ` from ${intent.donorName}` : ''}${intent.message ? `: ${intent.message}` : ''}`,
      tenantId: intent.tenantId,
    })
    return { fulfilled: true }
  }

  if (intent.kind === 'membership' || intent.kind === 'guardian_angel') {
    await fulfillSubscriptionMembership(payload, intent, verified)
    return { fulfilled: true }
  }

  if (intent.kind === 'portal_plan') {
    await fulfillPortalPlan(payload, intent, verified)
    return { fulfilled: true }
  }

  if (intent.kind === 'booking') {
    if (intent.bookingId != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'bookings',
        id: intent.bookingId,
        data: {
          status: 'confirmed',
          holdExpiresAt: null,
          integration: {
            stripePaymentIntent: `${verified.provider}:${verified.transactionId || verified.externalId}`,
          },
        },
        overrideAccess: true,
      })

      const feeAmt = intent.applicationFeeCents || 0
      if (feeAmt > 0) {
        await recordJusticeFundAllocation(payload, {
          amountCents: feeAmt,
          sourceTotalCents: verified.amountCents || intent.amountCents,
          percentage: Number(((feeAmt / Math.max(1, intent.amountCents)) * 100).toFixed(2)),
          sourceId: `${verified.provider}:${verified.transactionId || verified.externalId}`,
          description: `Booking deposit fee (${verified.provider}) for booking #${intent.bookingId}`,
          tenantId: intent.tenantId,
        })
      }
    }
    return { fulfilled: true, bookingId: intent.bookingId }
  }

  if (intent.kind === 'order') {
    const { orderId } = await fulfillShopOrder(payload, intent, verified)
    if (orderId != null) {
      await updateCheckoutIntent(payload, intent.ref, { orderId }).catch(() => {})
    }
    return { fulfilled: true, orderId }
  }

  return { fulfilled: true }
}
