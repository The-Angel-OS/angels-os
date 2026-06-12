/**
 * Booking work-session + invoice — metered hourly billing.
 *
 *   POST /api/booking-ops/clock     { bookingId, action: 'in'|'out' }
 *   POST /api/booking-ops/add-cost  { bookingId, label, amountCents }
 *   POST /api/booking-ops/finalize  { bookingId, units? }   → computes the invoice
 *
 * The provider clocks in/out as they work (a phone call = clock out, not billed),
 * adds material/trip costs, then finalizes: invoice = rate × billable time + costs.
 * State lives on Bookings.metadata.workSession — no schema change. Finalize also
 * writes pricing.amount so the existing balance-on-completion flow settles it.
 *
 * Auth: the booking's provider, or super_admin/admin. `-ops` prefix avoids the
 * bookings collection route shadowing.
 *
 * @see src/utilities/meterHourly.ts  @see src/utilities/resolveServices.ts
 */
import type { Payload, PayloadHandler, PayloadRequest } from 'payload'
import {
  emptySession, clockIn, clockOut, billableMinutes, computeInvoice, isOnClock,
  type WorkSession,
} from '@/utilities/meterHourly'
import { resolveServices } from '@/utilities/resolveServices'

async function loadAuthorized(req: PayloadRequest, bookingId: unknown): Promise<{ booking: any; error?: Response }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { payload, user } = req
  if (!user) return { booking: null, error: Response.json({ error: 'authentication required' }, { status: 401 }) }
  if (bookingId == null) return { booking: null, error: Response.json({ error: 'bookingId required' }, { status: 400 }) }
  let booking: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    booking = await payload.findByID({ collection: 'bookings' as any, id: bookingId as any, depth: 0, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch {
    return { booking: null, error: Response.json({ error: 'booking not found' }, { status: 404 }) }
  }
  const roles = (user as { roles?: string[] }).roles ?? []
  const isAdmin = roles.includes('super_admin') || roles.includes('admin')
  const providerId = typeof booking.provider === 'object' ? booking.provider?.id : booking.provider
  if (!isAdmin && String(providerId) !== String((user as { id: unknown }).id)) {
    return { booking: null, error: Response.json({ error: 'only the provider or an admin can manage this job' }, { status: 403 }) }
  }
  return { booking }
}

function getSession(booking: any): WorkSession { // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = (booking.metadata || {}) as Record<string, unknown>
  const ws = m.workSession as WorkSession | undefined
  if (!ws || !Array.isArray(ws.segments)) return emptySession()
  return { segments: ws.segments, extraCosts: Array.isArray(ws.extraCosts) ? ws.extraCosts : [], invoice: ws.invoice, finalizedAt: ws.finalizedAt }
}

async function saveSession(payload: Payload, booking: any, session: WorkSession, extra?: Record<string, unknown>): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
  await payload.update({
    collection: 'bookings' as any, id: booking.id, // eslint-disable-line @typescript-eslint/no-explicit-any
    data: { metadata: { ...(booking.metadata || {}), workSession: session }, ...(extra || {}) } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    overrideAccess: true,
  })
}

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try { return (typeof req.json === 'function' ? await req.json() : {}) as Record<string, unknown> } catch { return {} }
}

export const clockHandler: PayloadHandler = async (req) => {
  const b = await body(req)
  const { booking, error } = await loadAuthorized(req, b.bookingId)
  if (error) return error
  const action = b.action === 'out' ? 'out' : 'in'
  const now = new Date().toISOString()
  let session = getSession(booking)
  session = action === 'in' ? clockIn(session, now) : clockOut(session, now)
  await saveSession(req.payload, booking, session)
  return Response.json({ ok: true, onClock: isOnClock(session), segments: session.segments.length })
}

export const addCostHandler: PayloadHandler = async (req) => {
  const b = await body(req)
  const { booking, error } = await loadAuthorized(req, b.bookingId)
  if (error) return error
  const label = String(b.label || '').trim()
  const amountCents = Number(b.amountCents)
  if (!label || !Number.isInteger(amountCents) || amountCents <= 0) {
    return Response.json({ error: 'label and positive integer amountCents required' }, { status: 400 })
  }
  const session = getSession(booking)
  session.extraCosts = [...(session.extraCosts || []), { label, amountCents }]
  await saveSession(req.payload, booking, session)
  return Response.json({ ok: true, extraCosts: session.extraCosts })
}

export const finalizeHandler: PayloadHandler = async (req) => {
  const b = await body(req)
  const { booking, error } = await loadAuthorized(req, b.bookingId)
  if (error) return error
  const session = getSession(booking)

  // Resolve the service (rate/increment/min) from the booking's tenant + serviceId.
  const tenantId = typeof booking.tenant === 'object' ? booking.tenant?.id : booking.tenant
  const serviceId = (booking.metadata as Record<string, unknown> | undefined)?.serviceId as string | undefined
  const services = await resolveServices(req.payload, { tenantId })
  const svc = services.find((s) => s.id === serviceId)

  const pricingModel = svc?.pricingModel ?? 'fixed'
  const now = new Date().toISOString()
  const billed = billableMinutes(session.segments, {
    incrementMinutes: svc?.billingIncrementMinutes ?? 1,
    minimumMinutes: svc?.minimumMinutes,
  }, now)

  const invoice = computeInvoice({
    pricingModel,
    hourlyRateCents: svc?.hourlyRateUSD != null ? Math.round(svc.hourlyRateUSD * 100) : undefined,
    billedMinutes: billed,
    fixedPriceCents: svc?.priceUSD != null ? Math.round(svc.priceUSD * 100) : undefined,
    unitRateCents: svc?.unitRateUSD != null ? Math.round(svc.unitRateUSD * 100) : undefined,
    units: b.units != null ? Number(b.units) : undefined,
    unitLabel: svc?.unitLabel,
    extraCosts: session.extraCosts,
  })

  session.invoice = invoice
  session.finalizedAt = now
  // Write the total to pricing.amount (USD) so the balance-on-completion flow settles it.
  const pricing = { ...(booking.pricing || {}), amount: invoice.totalCents / 100 }
  await saveSession(req.payload, booking, session, { pricing })

  return Response.json({ ok: true, invoice, billedMinutes: billed, pricingModel })
}
