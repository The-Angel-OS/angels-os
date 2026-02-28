/**
 * Order Cancel Endpoint — POST /api/orders/cancel
 *
 * Cancels a queued Angel Token and initiates a Stripe refund.
 * Only works for items still in pending_match status — once a maker
 * has claimed or started production, cancellation is not allowed.
 *
 * Auth: order owner only.
 *
 * @see src/utilities/angelTokens.ts — refundToken()
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const orderCancelHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'orders')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId, orderItemIndex } = body

  if (!orderId || orderItemIndex === undefined) {
    return Response.json({ error: 'orderId and orderItemIndex are required.' }, { status: 400 })
  }

  try {
    // Fetch order
    const order = await payload.findByID({
      collection: 'orders' as any,
      id: orderId as number,
      depth: 1,
      overrideAccess: true,
    }) as any

    if (!order) {
      return Response.json({ error: 'Order not found.' }, { status: 404 })
    }

    // Verify ownership
    const orderedBy = typeof order.orderedBy === 'object' ? order.orderedBy?.id : order.orderedBy
    if (String(orderedBy) !== String(user.id)) {
      return Response.json({ error: 'You can only cancel your own orders.' }, { status: 403 })
    }

    // Find the fulfillment entry
    const fulfillment = (order.fulfillment || []).slice()
    const fi = fulfillment.findIndex(
      (f: any) => f.orderItemIndex === (orderItemIndex as number),
    )

    if (fi < 0) {
      return Response.json({ error: 'No fulfillment entry found for this item.' }, { status: 404 })
    }

    const entry = fulfillment[fi]

    // Only cancellable if still queued (pending_match + active token)
    if (entry.fulfillmentStatus !== 'pending_match') {
      return Response.json({
        error: 'Cannot cancel — a maker has already been matched or started production. Contact support for assistance.',
      }, { status: 409 })
    }

    // Update fulfillment entry
    fulfillment[fi] = {
      ...entry,
      fulfillmentStatus: 'cancelled',
      tokenStatus: 'refunded',
    }

    await payload.update({
      collection: 'orders' as any,
      id: orderId as number,
      data: { fulfillment } as any,
      overrideAccess: true,
    })

    // Attempt Stripe refund if we have the payment intent
    let stripeRefundId: string | null = null
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (stripeSecretKey && order.stripePaymentIntentID) {
      try {
        const stripe = new Stripe(stripeSecretKey)

        // Calculate refund amount for this specific item
        const items = order.items || []
        const item = items[orderItemIndex as number]
        const itemPrice = item?.price || 0
        const refundAmountCents = Math.round(itemPrice * 100)

        if (refundAmountCents > 0) {
          const refund = await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentID,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
              angelTokenId: entry.angelTokenId || '',
              orderId: String(orderId),
              orderItemIndex: String(orderItemIndex),
            },
          })
          stripeRefundId = refund.id
        }
      } catch (stripeErr) {
        console.error('[Order Cancel] Stripe refund failed:', stripeErr)
        // Token is already marked refunded — manual refund may be needed
      }
    }

    return Response.json({
      success: true,
      message: `Angel Token ${entry.angelTokenId || ''} cancelled. ${stripeRefundId ? 'Refund issued.' : 'Refund pending manual processing.'}`,
      angelTokenId: entry.angelTokenId,
      stripeRefundId,
    })
  } catch (err) {
    console.error('Order cancel error:', err)
    return Response.json({ error: 'Failed to cancel order.' }, { status: 500 })
  }
}
