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
 *   - serviceId (string, required): id from the tenant's bookable service catalog
 *     (src/config/bookableServices.ts) — drives duration, total price, and deposit
 *   - notes (string): Customer notes for the booking
 *
 * The slot is conflict-checked against the provider's existing bookings before
 * creation (overbooking guard), and only the DEPOSIT is charged up front; the
 * balance is settled on completion.
 *
 * Response:
 *   - clientSecret: Stripe PaymentIntent client_secret for the deposit
 *   - bookingId, stripeAccountId, depositCents, totalCents, balanceCents, serviceLabel
 *
 * Auth: Requires authentication.
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'

import { getStripeApplicationFeeCents } from '@/lib/stripe-connect-config'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { depositCents, totalCents } from '@/config/bookableServices'
import { resolveServices } from '@/utilities/resolveServices'
import { getBookingPaymentMode } from '@/utilities/bookingSettings'
import { resolveBookingProvider } from '@/utilities/resolveBookingProvider'
import { BookingEngine } from '@/utilities/bookingEngine'
import { logError } from '@/utilities/logError'

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

  const { date, time, serviceId, notes } = body

  if (!date || typeof date !== 'string') {
    return Response.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!time || typeof time !== 'string') {
    return Response.json({ error: 'time is required (HH:MM)' }, { status: 400 })
  }
  if (!serviceId || typeof serviceId !== 'string') {
    return Response.json({ error: 'serviceId is required' }, { status: 400 })
  }

  let resolvedTenantId: number | undefined
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
    if (tenant?.id != null) resolvedTenantId = Number(tenant.id)
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Stripe Connect is OPTIONAL — only needed when a deposit is actually charged.
    // A COD/pay-on-site business (e.g. an electrician) or a $0 / no-deposit service
    // takes the booking as a REQUEST and settles on completion. No payment ≠ no service.
    const connect = tenant.stripeConnect as Record<string, unknown> | undefined
    const connectEnabled = Boolean(connect?.stripeAccountId && connect?.stripeChargesEnabled)
    const connectedAccountId = (connect?.stripeAccountId as string) || ''

    // Resolve the service DB-first (the owner-configured Services catalog), static fallback.
    const catalog = await resolveServices(payload, { tenantSlug, tenantId: tenant.id })
    const service = catalog.find((s) => s.id === serviceId)
    if (!service) {
      return Response.json({ error: 'Unknown service for this enterprise' }, { status: 400 })
    }
    const slotDuration = service.durationMinutes
    const currency = 'usd'
    const total = totalCents(service)
    const deposit = depositCents(service)
    const balanceCents = total - deposit

    // Does this booking need an up-front online payment? Only when there's a real
    // deposit AND the endeavor can take card AND it isn't explicitly COD. A $0 / no-
    // deposit service, a COD endeavor, or one without Stripe → booking REQUEST.
    const paymentMode = await getBookingPaymentMode(payload, tenant.id) // 'deposit' | 'cod' | null
    const needsPayment = deposit > 0 && connectEnabled && paymentMode !== 'cod'

    // Get Endeavor (display name) + resolve the booking provider (one shared calendar)
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = endeavors.docs?.[0] as any
    const endeavorName = endeavor?.name || tenant.name || 'Enterprise'

    const providerId = await resolveBookingProvider(payload, tenant.id)
    if (providerId == null) {
      return Response.json(
        { error: 'This enterprise has not configured a booking provider yet.' },
        { status: 400 },
      )
    }

    // Calculate booking times
    const startDateTime = new Date(`${date}T${time}:00`)
    if (isNaN(startDateTime.getTime())) {
      return Response.json({ error: 'Invalid date/time combination' }, { status: 400 })
    }
    const endDateTime = new Date(startDateTime.getTime() + slotDuration * 60 * 1000)

    // ── Overbooking guard ──────────────────────────────────────────────
    // Reject the slot if it overlaps an existing pending/confirmed booking on
    // the provider's calendar. A pending booking already blocks the slot, so
    // this prevents two clients (or two services) from claiming the same time.
    const engine = new BookingEngine(payload)
    const conflicts = await engine.checkBookingConflicts({
      providerId: String(providerId),
      clientId: String(user.id),
      tenantId: String(tenant.id),
      startDateTime,
      duration: slotDuration,
      bookingType: service.bookingType,
      title: service.label,
      pricing: { amount: service.priceUSD, currency },
    })
    if (conflicts.length > 0) {
      return Response.json(
        {
          error: 'That time was just taken. Please choose another slot.',
          conflicts: conflicts.map((c) => c.message),
        },
        { status: 409 },
      )
    }

    // Create the booking record (status: pending until deposit is paid)
    const booking = await payload.create({
      collection: 'bookings' as any,
      data: {
        tenant: tenant.id,
        provider: providerId,
        client: user.id,
        title: `${service.label} — ${endeavorName}`,
        bookingType: service.bookingType,
        status: 'pending',
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        duration: slotDuration,
        notes: typeof notes === 'string' ? notes : undefined,
        pricing: {
          amount: service.priceUSD,
          currency,
        },
        metadata: {
          serviceId: service.id,
          serviceLabel: service.label,
          depositPercent: service.depositPercent,
          depositCents: needsPayment ? deposit : 0,
          balanceDueCents: needsPayment ? balanceCents : total,
          paymentKind: needsPayment ? 'deposit' : 'cod',
        },
      } as any,
      overrideAccess: true,
    })

    // ── User Propagation: client → provider's tenant (Sprint 42) ──
    try {
      const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')
      await ensureTenantMembership(user.id, tenant.id)
    } catch {
      // Non-fatal: booking proceeds regardless of propagation
    }

    // ── COD / no-deposit path ──────────────────────────────────────────
    // No online payment needed → the booking stands as a REQUEST. The owner
    // confirms and collects on completion (cash, check, Zelle). This is the
    // common case for trades and any $0/no-deposit service.
    if (!needsPayment) {
      return Response.json({
        requested: true,
        bookingId: booking.id,
        totalCents: total,
        depositCents: 0,
        balanceCents: total,
        currency,
        serviceLabel: service.label,
        endeavorName,
        paymentNote:
          total > 0
            ? 'Payment is collected on completion (cash, check, or Zelle).'
            : 'No payment required to request this booking.',
      })
    }

    // Initialize Stripe (deposit path)
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

    // Application fee (platform share) is calculated on the DEPOSIT being charged
    const applicationFee = getStripeApplicationFeeCents(deposit)

    // Create PaymentIntent on the connected account (Direct Charges) — DEPOSIT only
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: deposit,
        application_fee_amount: applicationFee,
        payment_method_types: ['card'],
        currency,
        customer: customer.id,
        metadata: {
          bookingId: String(booking.id),
          bookingType: service.bookingType,
          serviceId: service.id,
          serviceLabel: service.label,
          clientId: String(user.id),
          clientEmail: customerEmail,
          endeavorName,
          date,
          time,
          duration: String(slotDuration),
          tenantSlug,
          angelOs_splitEnabled: 'true',
          angelOs_chargeModel: 'direct',
          angelOs_paymentKind: 'deposit',
          angelOs_totalCents: String(total),
          angelOs_balanceDueCents: String(balanceCents),
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
      depositCents: deposit,
      totalCents: total,
      balanceCents,
      currency,
      serviceLabel: service.label,
      endeavorName,
    })
  } catch (err) {
    console.error('[Booking Checkout] Error:', err)
    await logError({
      source: 'booking-checkout',
      message: `Booking checkout failed: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId: resolvedTenantId,
    })
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create booking checkout' },
      { status: 500 },
    )
  }
}
