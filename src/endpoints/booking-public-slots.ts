/**
 * Public Available Slots — POST /api/booking-ops/public-slots
 *
 * The smart calendar's data source: returns the start times on a given date that can
 * actually fit a service of `duration` minutes — i.e. start times where the FULL
 * service window stays within open hours AND doesn't overlap an existing booking
 * (expanded by the provider's buffer). So a 6-hour job only offers start times with
 * 6 contiguous free hours.
 *
 * Public (no auth) and privacy-safe: returns only available start times — never any
 * customer/booking detail. Tenant resolved host-first (x-tenant-id), body slug fallback.
 *
 * Body: { date: 'YYYY-MM-DD', duration: number (minutes), tenantSlug?, serviceType? }
 * Response: { slots: [{ time: 'HH:MM' }], date }
 *
 * @see src/endpoints/booking-checkout.ts (conflict-checks again at commit time)
 */
import type { PayloadHandler } from 'payload'
import { resolveBookingProvider, providerWhere } from '@/utilities/resolveBookingProvider'

const toMin = (hhmm: string): number | null => {
  const [h, m] = (hhmm || '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

export const bookingPublicSlotsHandler: PayloadHandler = async (req) => {
  const { payload } = req
  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }

  const dateStr = typeof body.date === 'string' ? body.date : ''
  const duration = Math.max(15, Number(body.duration) || 60)
  const serviceType = typeof body.serviceType === 'string' ? body.serviceType : undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return Response.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
  }

  try {
    const slug = req.headers?.get('x-tenant-id') || (typeof body.tenantSlug === 'string' ? body.tenantSlug : '')
    if (!slug) return Response.json({ slots: [], date: dateStr })
    const tenants = await payload.find({ collection: 'tenants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
    const tenant = tenants.docs?.[0] as { id: number | string } | undefined
    if (!tenant) return Response.json({ slots: [], date: dateStr })

    // null is not "no booking" any more — it means the HOUSE calendar, which
    // is what an unclaimed portal and a one-person business both use.
    const providerId = await resolveBookingProvider(payload, tenant.id)

    const dayStart = new Date(`${dateStr}T00:00:00`)
    const dayEnd = new Date(`${dateStr}T23:59:59`)
    const dow = dayStart.getDay()

    // Weekly availability rules that apply to this day
    const rules = await payload.find({
      collection: 'availability',
      where: { and: [providerWhere(providerId), { tenant: { equals: tenant.id } }, { isActive: { equals: true } }] },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    // Existing bookings on this date that still hold the calendar
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          providerWhere(providerId),
          { tenant: { equals: tenant.id } },
          { startDateTime: { greater_than_equal: dayStart.toISOString() } },
          { startDateTime: { less_than_equal: dayEnd.toISOString() } },
          { status: { in: ['pending', 'confirmed', 'in-progress'] } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    // Compare everything in UTC minutes-of-day. Bookings are created from a wall-clock
    // date+time via `new Date(\`${date}T${time}\`)` (booking-checkout), so on the UTC
    // server their stored instant's UTC clock IS the intended wall clock — and so are
    // the availability open/close times. Using minutes-of-day avoids any absolute-
    // instant timezone drift between the candidate and the stored booking.
    // A pending DEPOSIT-hold only blocks until its holdExpiresAt — an abandoned
    // checkout past that time frees the slot again. Confirmed/in-progress and
    // no-expiry pending (no-deposit requests) always block.
    const nowMs = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const busy = (bookings.docs as any[])
      .filter((b) => !(b.status === 'pending' && b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() < nowMs))
      .map((b) => {
        const s = new Date(b.startDateTime)
        const e = new Date(b.endDateTime)
        return { startMin: s.getUTCHours() * 60 + s.getUTCMinutes(), endMin: e.getUTCHours() * 60 + e.getUTCMinutes() }
      })

    const nowD = new Date()
    const todayUTC = nowD.toISOString().slice(0, 10)
    const nowMin = nowD.getUTCHours() * 60 + nowD.getUTCMinutes()
    const isPast = dateStr < todayUTC
    const isToday = dateStr === todayUTC

    const offered = new Set<string>()
    const slots: Array<{ time: string; seatsLeft: number }> = []

    for (const rule of rules.docs as unknown as Record<string, unknown>[]) {
      if (isPast) break
      if ((rule.availabilityType ?? 'weekly') !== 'weekly') continue
      const ws = rule.weeklySchedule as { dayOfWeek?: number; startTime?: string; endTime?: string } | undefined
      if (!ws || Number(ws.dayOfWeek) !== dow) continue
      const open = toMin(ws.startTime || '')
      const close = toMin(ws.endTime || '')
      if (open == null || close == null) continue

      const granularity = Math.max(15, Number(rule.slotDuration) || 60)
      // How many people this slot can hold. 1 = a one-to-one appointment; a tour,
      // class or group session takes several, and the slot stays open until it is
      // actually full instead of vanishing on the first booking.
      const capacity = Math.max(1, Number(rule.capacity) || 1)
      const bufferMin = Number(rule.bufferTime) || 0
      const minAdvanceMin = (Number(rule.minAdvanceBooking) || 0) * 60 // hours → minutes

      for (let t = open; t + duration <= close; t += granularity) {
        if (isToday && t < nowMin + minAdvanceMin) continue // too soon
        // Overlap (with buffer) against existing bookings — COUNT them, because
        // a slot with capacity 6 is only gone once six people have taken it.
        const taken = busy.filter(
          (b) => t < b.endMin + bufferMin && t + duration + bufferMin > b.startMin,
        ).length
        if (taken >= capacity) continue
        const time = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
        if (offered.has(time)) continue
        offered.add(time)
        slots.push({ time, seatsLeft: capacity - taken })
      }
    }

    slots.sort((a, b) => a.time.localeCompare(b.time))
    return Response.json({ slots, date: dateStr })
  } catch (e) {
    payload.logger?.error?.(`[public-slots] ${e instanceof Error ? e.message : String(e)}`)
    return Response.json({ slots: [], date: dateStr })
  }
}
