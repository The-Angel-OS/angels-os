/**
 * Booking Checkout Endpoint — POST /api/booking-ops/checkout
 *
 * Creates a Stripe PaymentIntent for a booking using the Direct Charges model.
 * The PaymentIntent is created ON the connected (seller) account with an
 * application_fee_amount for the platform's share (Ultimate Fair Split).
 *
 * Request body:
 *   - date (string, required): ISO date string (YYYY-MM-DD)
 *   - time (string, required): Time string (HH:MM)
 *   - duration (number): Duration in minutes (default: 60)
 *   - serviceType (string): Service type (default: 'service')
 *   - notes (string): Customer notes for the booking
 *
 * Response:
 *   - clientSecret: Stripe PaymentIntent client_secret for frontend confirmation
 *   - bookingId: Created booking record ID
 *   - stripeAccountId: Connected account ID for Stripe Elements
 *
 * Auth: Requires authentication.
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'

import { getStripeApplicationFeeCents } from '@/lib/stripe-connect-config'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const bookingCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'bookings')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { date, time, duration, serviceType, notes } = body

  if (!date || typeof date !== 'string') {
    return Response.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!time || typeof time !== 'string') {
    return Response.json({ error: 'time is required (HH:MM)' }, { status: 400 })
  }

  const slotDuration = Math.max(15, Number(duration) || 60)
  const resolvedServiceType = typeof serviceType === 'string' ? serviceType : 'service'

  try {
    // Resolve tenant
    const tenantSlug =
      req.headers.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'

    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs?.[0] as any
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Resolve Stripe Connect account
    const connect = tenant.stripeConnect as Record<string, unknown> | undefined
    if (!connect?.stripeAccountId || !connect?.stripeChargesEnabled) {
      return Response.json(
        { error: 'This enterprise has not set up payments yet. Please contact them directly.' },
        { status: 400 },
      )
    }
    const connectedAccountId = connect.stripeAccountId as string

    // Get Endeavor for pricing info
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = endeavors.docs?.[0] as any
    const endeavorName = endeavor?.name || tenant.name || 'Enterprise'

    // Determine pricing — check availability slots for configured pricing,
    // fall back to a default service rate
    let amountCents = 5000 // Default $50.00 per session
    const currency = 'usd'

    try {
      const availSlots = await payload.find({
        collection: 'availability',
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const slot = availSlots.docs?.[0] as any
      if (slot?.serviceTypes) {
        const matchingService = slot.serviceTypes.find(
          (s: any) => s.serviceType === resolvedServiceType,
        )
        if (matchingService?.price) {
          amountCents = Math.round(Number(matchingService.price) * 100)
        }
      }
    } catch {
      // Use default pricing
    }

    // Calculate booking times
    const startDateTime = new Date(`${date}T${time}:00`)
    if (isNaN(startDateTime.getTime())) {
      return Response.json({ error: 'Invalid date/time combination' }, { status: 400 })
    }
    const endDateTime = new Date(startDateTime.getTime() + slotDuration * 60 * 1000)

    // Create the booking record (status: pending until payment)
    const booking = await payload.create({
      collection: 'bookings' as any,
      data: {
        tenant: tenant.id,
        client: user.id,
        bookingType: resolvedServiceType,
        status: 'pending',
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        duration: slotDuration,
        notes: typeof notes === 'string' ? notes : undefined,
        pricing: {
          amount: amountCents / 100,
          currency,
        },
      } as any,
      overrideAccess: true,
    })

    // ── User Propagation: client → provider's tenant (Sprint 42) ──
    try {
      const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')
      await ensureTenantMembership(payload, user.id, tenant.id, 'booking')
    } catch {
      // Non-fatal: booking proceeds regardless of propagation
    }

    // Initialize Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return Response.json({ error: 'Payment system not configured' }, { status: 500 })
    }
    const stripe = new Stripe(stripeSecretKey)

    // Find or create customer on the connected account
    const customerEmail = (user as any).email
    let customer = (
      await stripe.customers.list(
        { email: customerEmail, limit: 1 },
        { stripeAccount: connectedAccountId },
      )
    ).data[0]
    if (!customer?.id) {
      customer = await stripe.customers.create(
        { email: customerEmail, name: (user as any).name || undefined },
        { stripeAccount: connectedAccountId },
      )
    }

    // Calculate application fee (40% platform share)
    const applicationFee = getStripeApplicationFeeCents(amountCents)

    // Create PaymentIntent on the connected account (Direct Charges)
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        application_fee_amount: applicationFee,
        payment_method_types: ['card'],
        currency,
        customer: customer.id,
        metadata: {
          bookingId: String(booking.id),
          bookingType: resolvedServiceType,
          clientId: String(user.id),
          clientEmail: customerEmail,
          endeavorName,
          date,
          time,
          duration: String(slotDuration),
          tenantSlug,
          angelOs_splitEnabled: 'true',
          angelOs_chargeModel: 'direct',
          angelOs_applicationFee: String(applicationFee),
        },
      },
      { stripeAccount: connectedAccountId },
    )

    // Update booking with Stripe PaymentIntent ID
    await payload.update({
      collection: 'bookings' as any,
      id: booking.id,
      data: {
        integration: {
          stripePaymentIntent: paymentIntent.id,
        },
      } as any,
      overrideAccess: true,
    })

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id,
      stripeAccountId: connectedAccountId,
      amount: amountCents,
      currency,
      endeavorName,
    })
  } catch (err) {
    console.error('[Booking Checkout] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create booking checkout' },
      { status: 500 },
    )
  }
}
