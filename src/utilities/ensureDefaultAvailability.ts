/**
 * ensureDefaultAvailability — give a personal guardian angel a working
 * "book time with me" link OUT OF THE BOX.
 *
 * The booking engine already resolves a tenant's `/book` page to its owner (the
 * tenant_admin, via resolveBookingProvider) and serves slots from that provider's
 * Availability rows. The one missing piece for a turnkey personal scheduler is
 * that a freshly-provisioned angel has NO availability — so their link shows
 * nothing. This seeds a sensible default (weekdays 9–5, 30-min slots) so the
 * scheduling link works the moment the angel is born; the owner edits it later.
 *
 * Config-free for the 99%: no setup screen, they just have a working scheduler.
 * Idempotent (skips if the provider already has availability for this tenant) and
 * fail-soft (never breaks provisioning).
 *
 * @see src/utilities/resolveBookingProvider.ts — resolves /book to the owner
 * @see src/endpoints/booking-public-slots.ts — serves the slots
 * @see src/collections/Availability.ts — the schema
 */
import type { Payload } from 'payload'

const WEEKDAYS = ['1', '2', '3', '4', '5'] as const // Mon–Fri
const DEFAULT_START = '09:00'
const DEFAULT_END = '17:00'
const DEFAULT_SLOT_MINUTES = 30

export interface EnsureAvailabilityResult {
  created: number
  skipped: boolean
}

/**
 * Seed a default weekday 9–5 availability for `providerUserId` under `tenantId`,
 * unless they already have availability there. Returns how many rows were created.
 */
export async function ensureDefaultAvailability(
  payload: Payload,
  tenantId: number | string,
  providerUserId: number | string,
): Promise<EnsureAvailabilityResult> {
  try {
    const existing = await payload.find({
      collection: 'availability',
      where: {
        and: [
          { provider: { equals: providerUserId } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) return { created: 0, skipped: true }

    let created = 0
    // One weekly row per weekday (the schema keys weeklySchedule to a single day).
    for (const dayOfWeek of WEEKDAYS) {
      try {
        await payload.create({
          collection: 'availability',
          data: {
            provider: providerUserId,
            tenant: tenantId,
            availabilityType: 'weekly',
            weeklySchedule: { dayOfWeek, startTime: DEFAULT_START, endTime: DEFAULT_END },
            slotDuration: DEFAULT_SLOT_MINUTES,
            bufferTime: 0,
            maxAdvanceBooking: 30,
            minAdvanceBooking: 1,
            isActive: true,
            serviceTypes: [{ serviceType: 'consultation', maxConcurrent: 1 }],
          } as never,
          overrideAccess: true,
        })
        created++
      } catch {
        /* one bad row shouldn't block the rest */
      }
    }
    return { created, skipped: false }
  } catch {
    return { created: 0, skipped: true }
  }
}
