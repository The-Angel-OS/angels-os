/**
 * Booking Hours Editor — POST /api/booking-ops/set-hours
 *
 * The owner-facing way to say "I'm open Mon–Fri 9–5, 30 minute appointments".
 * Before this, /dashboard/admin/bookings showed a GUIDE telling a plumber to open
 * the Payload admin and hand-create a row with fields called `availabilityType`
 * and `maxAdvanceBooking`. Provisioning now seeds weekday hours, so this is
 * "adjust your hours", not "build a schedule from nothing".
 *
 * Writes the WEEKLY rows for the tenant's booking provider — the same provider
 * /book resolves to, because hours pinned to anyone else render an empty grid.
 * Days omitted from the request are deactivated, not deleted (isActive is what
 * public-slots and bookingEngine filter on, and past bookings keep their row).
 *
 * Body: { slotDuration?: number, days: [{ day: 0-6, start: 'HH:MM', end: 'HH:MM' }] }
 * Auth: platform admin, or tenant_admin / tenant_manager of the current portal.
 */
import type { PayloadHandler } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { resolveBookingProvider } from '@/utilities/resolveBookingProvider'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

const HHMM = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

interface DayInput {
  day: number
  start: string
  end: string
}

export function parseDays(raw: unknown): DayInput[] | string {
  if (!Array.isArray(raw)) return 'days must be an array'
  const seen = new Set<number>()
  const out: DayInput[] = []
  for (const item of raw) {
    const d = item as Record<string, unknown>
    const day = Number(d?.day)
    const start = String(d?.start ?? '')
    const end = String(d?.end ?? '')
    if (!Number.isInteger(day) || day < 0 || day > 6) return 'day must be 0–6'
    if (seen.has(day)) return 'duplicate day'
    if (!HHMM.test(start) || !HHMM.test(end)) return 'start and end must be HH:MM'
    if (start >= end) return 'start must be before end'
    seen.add(day)
    out.push({ day, start, end })
  }
  return out
}

export const bookingSetHoursHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const days = parseDays(body.days)
  if (typeof days === 'string') return Response.json({ error: days }, { status: 400 })

  const slotDuration = Number(body.slotDuration ?? 30)
  if (!Number.isInteger(slotDuration) || slotDuration < 5 || slotDuration > 480) {
    return Response.json({ error: 'slotDuration must be 5–480 minutes' }, { status: 400 })
  }

  // 1 = a one-to-one appointment; higher = a class, tour or group session.
  const capacity = Number(body.capacity ?? 1)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    return Response.json({ error: 'capacity must be 1–500 people' }, { status: 400 })
  }

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return Response.json({ error: 'No portal context' }, { status: 400 })

  if (!checkRole(ADMIN_ROLES, user)) {
    const m = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: user.id } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const role = (m.docs?.[0] as { role?: string } | undefined)?.role
    if (!role || !MANAGER_ROLES.has(role)) {
      return Response.json({ error: 'Not permitted for this portal' }, { status: 403 })
    }
  }

  const providerId = await resolveBookingProvider(payload, tenantId)
  if (providerId == null) {
    return Response.json(
      { error: 'This portal has no booking provider yet — add an admin to the portal first.' },
      { status: 409 },
    )
  }

  const existing = await payload.find({
    collection: 'availability',
    where: {
      and: [
        { provider: { equals: providerId } },
        { tenant: { equals: tenantId } },
        { availabilityType: { equals: 'weekly' } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  })

  // ponytail: first row per day wins; the UI only ever writes one block per day.
  const byDay = new Map<number, { id: number | string }>()
  for (const doc of existing.docs as Array<Record<string, any>>) {
    const day = Number(doc?.weeklySchedule?.dayOfWeek)
    if (Number.isInteger(day) && !byDay.has(day)) byDay.set(day, { id: doc.id })
  }

  const wanted = new Map(days.map((d) => [d.day, d]))
  let created = 0
  let updated = 0
  let deactivated = 0

  for (const d of days) {
    const row = byDay.get(d.day)
    const data = {
      title: `${DAY_NAMES[d.day]} ${d.start}-${d.end}`,
      provider: providerId,
      tenant: tenantId,
      availabilityType: 'weekly',
      weeklySchedule: { dayOfWeek: String(d.day), startTime: d.start, endTime: d.end },
      slotDuration,
      capacity,
      isActive: true,
    }
    if (row) {
      await payload.update({
        collection: 'availability',
        id: row.id,
        data: data as never,
        overrideAccess: true,
        req,
      })
      updated++
    } else {
      await payload.create({
        collection: 'availability',
        data: { ...data, bufferTime: 0, maxAdvanceBooking: 30, minAdvanceBooking: 1 } as never,
        overrideAccess: true,
        req,
      })
      created++
    }
  }

  for (const [day, row] of byDay) {
    if (wanted.has(day)) continue
    await payload.update({
      collection: 'availability',
      id: row.id,
      data: { isActive: false } as never,
      overrideAccess: true,
      req,
    })
    deactivated++
  }

  return Response.json({ ok: true, providerId, created, updated, deactivated, slotDuration, capacity })
}
