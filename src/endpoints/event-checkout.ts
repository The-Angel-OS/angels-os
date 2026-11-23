/**
 * Event Ticket Checkout Endpoint — POST /api/event-ops/checkout
 *
 * Starts a Square or PayPal hosted checkout session for paid event tickets.
 * Supports creator multi-tenant Square accounts with automatic platform fee deduction
 * based on the creator's plan tier (0% to 5%).
 */
import type { PayloadHandler } from 'payload'
import { generateCheckoutRef } from '@/lib/payments/config'
import {
  resolveConnectedSquareForTenant,
  resolveProvider,
  startHostedCheckout,
} from '@/lib/payments/registry'
import type { PaymentProviderId } from '@/lib/payments/types'
import { checkApiRateLimit, extractRateLimitKey } from '@/utilities/apiRateLimiter'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'
import { feeCents, getPlatformFeeBps } from '@/utilities/platformFee'

export const eventTicketCheckoutHandler: PayloadHandler = async (req) => {
  const rateLimitKey = extractRateLimitKey(req)
  const rateLimit = checkApiRateLimit(rateLimitKey, 'registration')
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many checkout attempts. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await (req as unknown as Request).json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    eventId,
    name,
    email,
    attendanceMode = 'in-person',
    ticketCount: rawTicketCount = 1,
    provider: requestedProvider,
  } = body

  if (!eventId) {
    return Response.json({ error: 'eventId is required' }, { status: 400 })
  }

  const attendeeName = typeof name === 'string' ? name.trim() : ''
  const attendeeEmail = typeof email === 'string' ? email.trim() : ''

  if (!attendeeName) {
    return Response.json({ error: 'Attendee name is required' }, { status: 400 })
  }
  if (!attendeeEmail || !attendeeEmail.includes('@')) {
    return Response.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const ticketCount = Math.max(1, Math.min(10, Number(rawTicketCount) || 1))

  try {
    // 1. Fetch Event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (await (req.payload.findByID as any)({
      collection: 'events',
      id: eventId,
      depth: 1,
      overrideAccess: true,
    })) as Record<string, any> | null

    if (!event) {
      return Response.json({ error: 'Event not found.' }, { status: 404 })
    }

    // 2. Check Event Status and Registration Availability
    if (event.status === 'cancelled') {
      return Response.json({ error: 'This event has been cancelled.' }, { status: 400 })
    }

    const reg = event.registration || {}
    if (reg.isOpen === false) {
      return Response.json({ error: 'Registration is closed for this event.' }, { status: 400 })
    }

    // 3. Check Capacity
    const capacity = Number(event.capacity?.maxAttendees || 0)
    if (capacity > 0) {
      const activeRegistrations = await req.payload.count({
        collection: 'event-registrations',
        where: {
          and: [
            { event: { equals: event.id } },
            { status: { not_equals: 'cancelled' } },
          ],
        },
        overrideAccess: true,
      })

      if (activeRegistrations.totalDocs + ticketCount > capacity) {
        return Response.json(
          { error: 'Not enough tickets remaining for this event.' },
          { status: 400 },
        )
      }
    }

    // 4. Validate Pricing
    const pricing = event.pricing || {}
    if (pricing.isFree || !pricing.amount || Number(pricing.amount) <= 0) {
      return Response.json(
        { error: 'This event is free. Please register directly without checkout.' },
        { status: 400 },
      )
    }

    const unitPriceCents = Math.round(Number(pricing.amount) * 100)
    const amountCents = unitPriceCents * ticketCount
    const currency = (pricing.currency || 'USD').toUpperCase()

    // 5. Resolve Tenant
    let tenantId: number | undefined
    if (event.tenant) {
      tenantId = Number(typeof event.tenant === 'object' ? event.tenant.id : event.tenant)
    }
    if (tenantId == null) {
      const headerSlug = req.headers?.get?.('x-tenant-id') || ''
      if (headerSlug && headerSlug !== 'default') {
        const tRes = await req.payload.find({
          collection: 'tenants',
          where: { slug: { equals: headerSlug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (tRes.docs?.[0]?.id != null) tenantId = Number(tRes.docs[0].id)
      }
    }

    // 6. Resolve Provider & Multi-tenant Square Split
    const provider = await resolveProvider(
      req.payload,
      typeof requestedProvider === 'string' ? (requestedProvider as PaymentProviderId) : undefined,
      tenantId,
    )
    const connectedSquare =
      provider === 'square' && tenantId != null
        ? await resolveConnectedSquareForTenant(req.payload, tenantId)
        : null

    const chargeModel: 'platform' | 'direct' = connectedSquare ? 'direct' : 'platform'
    let applicationFeeCents = 0
    if (connectedSquare && tenantId != null) {
      const feeBps = await getPlatformFeeBps(req.payload, tenantId)
      applicationFeeCents = feeCents(amountCents, feeBps)
    }

    // 7. Resolve Return and Cancel URLs
    const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
    const proto = req.headers?.get?.('x-forwarded-proto')
    const origin = host ? originFromHeaderValues(host, proto) : getServerSideURL()
    const ref = generateCheckoutRef()

    const returnUrl = `${origin}/events/${event.slug}?payment=success&ref=${ref}`
    const cancelUrl = `${origin}/events/${event.slug}?payment=canceled`

    // 8. Start Hosted Checkout Session
    const session = await startHostedCheckout(req.payload, {
      ref,
      provider,
      kind: 'event_ticket',
      title: `${event.title} - ${ticketCount === 1 ? 'Ticket' : `${ticketCount} Tickets`}`,
      description: `Admission ticket for ${event.title}`,
      amountCents,
      currency,
      tenantId,
      chargeModel,
      applicationFeeCents,
      connectedSquare,
      customerEmail: attendeeEmail,
      customerName: attendeeName,
      returnUrl,
      cancelUrl,
      intentData: {
        eventId: event.id,
        eventTitle: event.title,
        ticketCount,
        customerName: attendeeName,
        customerEmail: attendeeEmail,
        attendanceMode: String(attendanceMode),
      },
    })

    return Response.json({
      ok: true,
      checkoutUrl: session.checkoutUrl,
      ref: session.ref,
      provider: session.provider,
      amountCents,
      ticketCount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Event ticket checkout failed'
    void logError({
      source: 'event-ops/checkout',
      message: `Failed to initiate event ticket checkout for eventId=${eventId}: ${msg}`,
      details: err instanceof Error ? err.stack : String(err),
    })
    const status = msg.includes('not configured') ? 503 : 500
    return Response.json({ error: msg }, { status })
  }
}
