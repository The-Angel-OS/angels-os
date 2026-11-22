/**
 * Confirm a booking after its deposit is paid — POST /api/booking-ops/confirm
 *
 * The deposit checkout leaves the booking `pending` with a 15-min hold. Once the
 * client returns from Square or PayPal hosted checkout, the browser calls this
 * with bookingId (+ optional ref, orderId, transactionId, subscriptionId). We
 * VERIFY the payment server-side via the dual-rail registry before flipping
 * the booking to `confirmed` and clearing holdExpiresAt.
 *
 * Body: { bookingId, ref?, orderId?, transactionId?, subscriptionId? }.
 * Auth: the booking's client, or a super_admin.
 */
import type { PayloadHandler } from 'payload'
import { getCheckoutIntent } from '@/lib/payments/config'
import { fulfillVerifiedPayment } from '@/lib/payments/fulfillment'
import { verifyOrCaptureCheckout } from '@/lib/payments/registry'

export const bookingConfirmHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Auth required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }
  const bookingId = body.bookingId
  if (bookingId == null) return Response.json({ error: 'bookingId required' }, { status: 400 })

  const booking = (await payload
    .findByID({ collection: 'bookings' as any, id: bookingId as any, depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, any> | null
  if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 })

  // Authorize: the booking's own client, or a super_admin. (Tenant-admin confirm of
  // OTHER people's requests is the separate owner-approval flow.)
  const clientId = typeof booking.client === 'object' ? booking.client?.id : booking.client
  const isOwnerAdmin = ((user as { roles?: string[] }).roles || []).includes('super_admin')
  if (String(clientId) !== String(user.id) && !isOwnerAdmin) {
    return Response.json({ error: 'Not allowed' }, { status: 403 })
  }

  if (booking.status === 'confirmed') return Response.json({ ok: true, alreadyConfirmed: true })

  const ref =
    (typeof body.ref === 'string' && body.ref.trim()) ||
    ((booking.metadata as Record<string, unknown> | undefined)?.paymentRef as string | undefined)
  if (!ref) {
    return Response.json({ error: 'No payment reference on booking' }, { status: 400 })
  }

  const intent = await getCheckoutIntent(payload, ref)
  if (!intent) {
    return Response.json({ error: 'Payment session not found for booking' }, { status: 404 })
  }
  if (intent.bookingId != null && String(intent.bookingId) !== String(bookingId)) {
    return Response.json({ error: 'Payment reference does not match this booking' }, { status: 403 })
  }

  try {
    const verified = await verifyOrCaptureCheckout(payload, {
      provider: intent.provider,
      intent,
      orderId: typeof body.orderId === 'string' ? body.orderId.trim() : undefined,
      transactionId: typeof body.transactionId === 'string' ? body.transactionId.trim() : undefined,
      subscriptionId:
        typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : undefined,
    })

    if (!verified.verified) {
      return Response.json(
        { ok: false, status: verified.status, error: 'Deposit not paid' },
        { status: 402 },
      )
    }

    await fulfillVerifiedPayment(payload, {
      idempotencyKey: `confirm:${intent.ref}`,
      intent: { ...intent, bookingId },
      verified,
    })

    return Response.json({ ok: true, status: 'confirmed', provider: intent.provider })
  } catch (e) {
    payload.logger?.error?.(`[booking-confirm] ${e instanceof Error ? e.message : String(e)}`)
    return Response.json({ error: 'Confirm failed' }, { status: 500 })
  }
}
