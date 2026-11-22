/**
 * Booking Checkout Endpoint — POST /api/booking-ops/checkout
 *
 * Starts a Square or PayPal hosted checkout session for a booking deposit
 * (with Multi-Tenant Square OAuth + application fee split when connected, or
 * free/COD booking request when no up-front deposit is required).
 *
 * Request body:
 *   - date (string, required): ISO date string (YYYY-MM-DD)
 *   - time (string, required): Time string (HH:MM)
 *   - serviceId (string, required): id from the tenant's bookable service catalog
 *     (src/config/bookableServices.ts) — drives duration, total price, and deposit
 *   - notes (string): Customer notes for the booking
 *   - provider ('square' | 'paypal', optional): Payment rail choice
 *
 * The slot is conflict-checked against the provider's existing bookings before
 * creation (overbooking guard), and only the DEPOSIT is charged up front; the
 * balance is settled on completion.
 *
 * Auth: Requires authentication.
 */
import type { PayloadHandler } from 'payload'

import { generateCheckoutRef } from '@/lib/payments/config'
import {
  getAvailableProviders,
  resolveConnectedSquareForTenant,
  resolveProvider,
  startHostedCheckout,
} from '@/lib/payments/registry'
import type { PaymentProviderId } from '@/lib/payments/types'
import { getBillingMode } from '@/utilities/billingMode'
import { getServerSideURL } from '@/utilities/getURL'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'
import { getPlatformFeeBps, feeCents } from '@/utilities/platformFee'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { depositCents, totalCents } from '@/config/bookableServices'
import { resolveServices } from '@/utilities/resolveServices'
import { getBookingPaymentMode } from '@/utilities/bookingSettings'
import { resolveBookingProvider, providerWhere, matchesProvider } from '@/utilities/resolveBookingProvider'
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

  const { date, time, serviceId, notes, provider: requestedProvider } = body

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

    // Online payment is OPTIONAL — only needed when a real deposit is charged AND
    // either the endeavor has connected Square OAuth or platform-direct billing is active
    // with Square/PayPal configured. Otherwise take the booking as a REQUEST / COD.
    const billingMode = await getBillingMode(payload, tenant.id)
    const connectedSquare = await resolveConnectedSquareForTenant(payload, tenant.id)
    const { providers } = await getAvailableProviders(payload, tenant.id)
    const connectEnabled =
      Boolean(connectedSquare) || (billingMode === 'platform-direct' && providers.length > 0)

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
    // A flat-deposit service with no list price is QUOTED on completion, not
    // negative. `total - deposit` wrote -7500 onto the booking for a $75 flat deposit.
    const balanceCents = Math.max(0, total - deposit)

    // Does this booking need an up-front online payment? Only when there's a real
    // deposit AND a payment rail is ready AND it isn't explicitly COD.
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

    // null means the HOUSE calendar — the business itself. Refusing it turned
    // away real money on any portal run by one person with no named provider.
    const providerId = await resolveBookingProvider(payload, tenant.id)

    // Calculate booking times
    const startDateTime = new Date(`${date}T${time}:00`)
    if (isNaN(startDateTime.getTime())) {
      return Response.json({ error: 'Invalid date/time combination' }, { status: 400 })
    }
    const endDateTime = new Date(startDateTime.getTime() + slotDuration * 60 * 1000)

    // Re-initiating checkout for the SAME slot supersedes this user's own prior
    // pending hold (an earlier attempt they didn't pay) — cancel it so the guard
    // below doesn't reject them against themselves and no orphan hold lingers.
    try {
      const ownPending = await payload.find({
        collection: 'bookings' as any,
        where: {
          and: [
            { client: { equals: user.id } },
            providerWhere(providerId),
            { status: { equals: 'pending' } },
            { startDateTime: { equals: startDateTime.toISOString() } },
          ],
        },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })
      for (const b of ownPending.docs) {
        await payload
          .delete({ collection: 'bookings' as any, id: (b as { id: number | string }).id, overrideAccess: true })
          .catch(() => {})
      }
    } catch {
      /* non-fatal — the conflict guard still protects against real double-booking */
    }

    // ── Overbooking guard ──────────────────────────────────────────────
    // Reject the slot only once it is genuinely FULL. A one-to-one appointment
    // (capacity 1) is full on the first overlapping booking; a class or tour is
    // full at its seat count. The capacity comes from the provider's own
    // availability rules, so the guard agrees with the calendar the customer saw.
    const capacity = await resolveSlotCapacity(payload, providerId, tenant.id)
    const engine = new BookingEngine(payload)
    const conflicts = await engine.checkBookingConflicts({
      // Empty string = house calendar. NOT a 'house:<id>' sentinel: that is a
      // string Payload happily coerced to NaN, and every checkout 500'd on it.
      providerId: providerId == null ? '' : String(providerId),
      clientId: String(user.id),
      tenantId: String(tenant.id),
      startDateTime,
      duration: slotDuration,
      capacity,
      bookingType: service.bookingType,
      title: service.label,
      pricing: { amount: service.priceUSD, currency },
    })
    if (conflicts.length > 0) {
      return Response.json(
        {
          error: capacity > 1
            ? 'That session just filled up. Please choose another time.'
            : 'That time was just taken. Please choose another slot.',
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
        ...(providerId == null ? {} : { provider: providerId }),
        client: user.id,
        title: `${service.label} — ${endeavorName}`,
        bookingType: service.bookingType,
        status: 'pending',
        // Deposit-holds expire in 15 min if unpaid, so an abandoned checkout frees
        // the slot. No-deposit REQUESTS get no expiry (hold until owner acts).
        holdExpiresAt: needsPayment ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined,
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
      await ensureTenantMembership(user.id, tenant.id, req)
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

    // Dual-rail hosted checkout (Square primary + optional OAuth split, or PayPal/Venmo)
    const provider = await resolveProvider(
      payload,
      typeof requestedProvider === 'string' ? requestedProvider : undefined,
      tenant.id,
    )
    const activeConnectedSquare = provider === 'square' ? connectedSquare : null
    const applicationFee = activeConnectedSquare
      ? feeCents(deposit, await getPlatformFeeBps(payload, tenant.id))
      : 0

    const ref = generateCheckoutRef()
    const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
    const proto = req.headers?.get?.('x-forwarded-proto')
    const origin = host ? originFromHeaderValues(host, proto) : getServerSideURL()
    const customerEmail = (user as { email?: string; name?: string }).email
    const customerName = (user as { name?: string }).name

    const returnUrl = `${origin}/book?booking=paid&bookingId=${booking.id}&ref=${ref}&provider=${provider}`
    const cancelUrl = `${origin}/book?booking=cancelled&bookingId=${booking.id}`

    const session = await startHostedCheckout(payload, {
      ref,
      provider: provider as PaymentProviderId,
      kind: 'booking',
      title: `${service.label} Deposit — ${endeavorName}`,
      description: `Booking deposit for ${date} at ${time} (${endeavorName})`,
      amountCents: deposit,
      currency: 'USD',
      tenantId: tenant.id,
      tenantSlug,
      tenantName: endeavorName,
      recipientName: endeavorName,
      chargeModel: activeConnectedSquare ? 'direct' : 'platform',
      applicationFeeCents: applicationFee,
      connectedSquare: activeConnectedSquare,
      customerEmail,
      customerName,
      returnUrl,
      cancelUrl,
      intentData: {
        bookingId: booking.id,
        memberUserId: user.id,
      },
    })

    // Save checkout ref and provider token on the pending booking for server confirmation
    await payload.update({
      collection: 'bookings' as any,
      id: booking.id,
      data: {
        metadata: {
          serviceId: service.id,
          serviceLabel: service.label,
          depositPercent: service.depositPercent,
          depositCents: deposit,
          balanceDueCents: balanceCents,
          paymentKind: 'deposit',
          paymentRef: session.ref,
          paymentProvider: session.provider,
        },
        integration: {
          stripePaymentIntent: `${session.provider}:${session.externalId}`,
        },
      } as any,
      overrideAccess: true,
    })

    return Response.json({
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      externalId: session.externalId,
      ref: session.ref,
      bookingId: booking.id,
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

/**
 * The largest capacity the provider offers on any active availability rule.
 *
 * The rules are per-weekday, so "how many seats does this slot have" is only
 * unambiguous once you know which rule produced it — but the guard runs on a
 * concrete instant and the customer already picked from a calendar built by
 * those same rules. Taking the max keeps the guard from rejecting a seat the
 * calendar just offered; genuine per-day capacity differences are enforced by
 * the calendar, which is the surface that actually shows seats.
 *
 * ponytail: max-across-rules, not per-day lookup. Revisit if a provider wants
 * different seat counts on different days AND is overselling because of it.
 */
async function resolveSlotCapacity(
  payload: Parameters<PayloadHandler>[0]['payload'],
  /** null = house hours (the business's own calendar). */
  providerId: number | string | null,
  tenantId: number | string,
): Promise<number> {
  try {
    const rules = await payload.find({
      collection: 'availability',
      where: {
        and: [
          providerWhere(typeof providerId === 'string' ? Number(providerId) : providerId),
          { tenant: { equals: tenantId } },
          { isActive: { equals: true } },
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const caps = (rules.docs as Array<{ capacity?: number }>)
      .filter((r) => matchesProvider(r, typeof providerId === 'string' ? Number(providerId) : providerId))
      .map((r) => Math.max(1, Number(r.capacity) || 1))
    return caps.length ? Math.max(...caps) : 1
  } catch {
    // Fail CLOSED: capacity 1 is the strictest guard, so a lookup failure can
    // only ever refuse a booking, never oversell one.
    return 1
  }
}
