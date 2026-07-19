/**
 * Confirm a booking after its deposit is paid — POST /api/booking-ops/confirm
 *
 * The deposit checkout leaves the booking `pending` with a 15-min hold. Once the
 * client pays, the browser calls this with the bookingId; we VERIFY the deposit
 * PaymentIntent actually succeeded on Stripe (never trust the client), then flip
 * the booking to `confirmed` and clear holdExpiresAt so the slot is locked for
 * good. Without this the hold would expire and free a PAID slot.
 *
 * ponytail: client-triggered + server-verified covers the normal flow. A Stripe
 * webhook on payment_intent.succeeded is the belt-and-suspenders for a tab that
 * closes in the ms between payment and this call — add if that ever bites.
 *
 * Body: { bookingId }. Auth: the booking's client, or a tenant admin.
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'

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

  const piId = booking.integration?.stripePaymentIntent as string | undefined
  if (!piId) return Response.json({ error: 'No payment intent on booking' }, { status: 400 })

  // Resolve the tenant's connected account (direct-charge PI lives there).
  const tenantId = typeof booking.tenant === 'object' ? booking.tenant?.id : booking.tenant
  const tenant = (await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, any> | null
  const connectedAccountId = tenant?.stripeConnect?.stripeAccountId as string | undefined

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return Response.json({ error: 'Payments not configured' }, { status: 500 })

  try {
    const stripe = new Stripe(secretKey)
    const pi = await stripe.paymentIntents.retrieve(
      piId,
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
    )
    if (pi.status !== 'succeeded') {
      return Response.json({ ok: false, status: pi.status, error: 'Deposit not paid' }, { status: 402 })
    }
    await payload.update({
      collection: 'bookings' as any,
      id: bookingId as any,
      data: { status: 'confirmed', holdExpiresAt: null } as any,
      overrideAccess: true,
    })
    return Response.json({ ok: true, status: 'confirmed' })
  } catch (e) {
    payload.logger?.error?.(`[booking-confirm] ${e instanceof Error ? e.message : String(e)}`)
    return Response.json({ error: 'Confirm failed' }, { status: 500 })
  }
}
