/**
 * ensureDefaultAvailability — give a tenant bookable hours.
 *
 * A service business needs THREE things for /book to work: services, a provider,
 * and hours. Services are seeded at provision and the provider resolves from the
 * tenant's admin — but nothing ever created hours, so `/book` correctly found a
 * provider, correctly found services, and then showed "no open times" forever.
 * A booking page that can never be booked is worse than none, because the owner
 * shows it to a customer before discovering it.
 *
 * Default is Mon–Fri 9–5, which is wrong for roughly every trade — and that is
 * fine. The point is a working calendar the owner EDITS, not a guess at their
 * week. Empty hours look broken; wrong hours look like a setting.
 *
 * Idempotent: does nothing if the tenant already has any availability row, so an
 * owner's edited schedule is never overwritten.
 *
 * @see src/utilities/resolveBookingProvider.ts  @see src/collections/Availability.ts
 */
import type { Payload, PayloadRequest } from 'payload'
import { resolveBookingProvider } from './resolveBookingProvider'

/** Mon–Fri. Weekend work is real for trades, but opting IN is the safer default. */
const WEEKDAYS = ['1', '2', '3', '4', '5'] as const
const DAY_NAMES: Record<string, string> = {
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
}

export interface EnsureAvailabilityResult {
  created: number
  providerId: number | null
  note: string
}

export async function ensureDefaultAvailability(
  payload: Payload,
  tenantId: number | string,
  req?: PayloadRequest,
): Promise<EnsureAvailabilityResult> {
  const existing = await payload.find({
    collection: 'availability',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.length) {
    return { created: 0, providerId: null, note: 'availability already configured' }
  }

  const providerId = await resolveBookingProvider(payload, tenantId)
  if (providerId == null) {
    // No admin on the tenant yet. Hours pinned to nobody would resolve to an
    // empty calendar anyway, so say so rather than write rows that cannot work.
    return { created: 0, providerId: null, note: 'no provider (tenant has no admin) — hours not created' }
  }

  let created = 0
  for (const dayOfWeek of WEEKDAYS) {
    await payload.create({
      collection: 'availability',
      data: {
        title: `${DAY_NAMES[dayOfWeek]} — standard hours`,
        provider: providerId,
        tenant: tenantId,
        availabilityType: 'weekly',
        weeklySchedule: { dayOfWeek, startTime: '09:00', endTime: '17:00' },
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      req,
    })
    created++
  }

  return { created, providerId, note: `Mon–Fri 09:00–17:00 for provider ${providerId}` }
}
