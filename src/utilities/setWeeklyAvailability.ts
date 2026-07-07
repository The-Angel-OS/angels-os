/**
 * setWeeklyAvailability — set a provider's recurring weekly hours.
 *
 * Powers the `set_availability` LEO tool ("I'm free weekdays 9–5", "open
 * Tuesdays 2–5pm") so a person shapes their scheduling calendar conversationally
 * instead of through the admin. Upserts ONE weekly Availability row per named day
 * (the schema keys weeklySchedule to a single day), leaving other days untouched.
 *
 * @see src/collections/Availability.ts
 * @see src/utilities/ensureDefaultAvailability.ts — the birth-time default
 */
import type { Payload } from 'payload'

const DAY_NAMES: Record<string, string> = {
  sun: '0', sunday: '0',
  mon: '1', monday: '1',
  tue: '2', tues: '2', tuesday: '2',
  wed: '3', weds: '3', wednesday: '3',
  thu: '4', thur: '4', thurs: '4', thursday: '4',
  fri: '5', friday: '5',
  sat: '6', saturday: '6',
}

const TIME_RE = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

/** Normalize a mixed list of day names/numbers → unique '0'..'6' strings. */
export function normalizeDays(days: Array<string | number>): string[] {
  const out = new Set<string>()
  for (const d of days) {
    const s = String(d).trim().toLowerCase()
    if (/^[0-6]$/.test(s)) out.add(s)
    else if (DAY_NAMES[s]) out.add(DAY_NAMES[s])
  }
  return [...out]
}

export interface SetAvailabilityInput {
  tenantId: number | string
  providerUserId: number | string
  days: Array<string | number>
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  slotDuration?: number
}

export interface SetAvailabilityResult {
  ok: boolean
  updated: number
  created: number
  days: string[]
  error?: string
}

const DOW_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function setWeeklyAvailability(
  payload: Payload,
  input: SetAvailabilityInput,
): Promise<SetAvailabilityResult> {
  const days = normalizeDays(input.days || [])
  if (days.length === 0) return { ok: false, updated: 0, created: 0, days: [], error: 'No valid days given.' }
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) {
    return { ok: false, updated: 0, created: 0, days, error: 'Times must be HH:MM (24-hour), e.g. 09:00.' }
  }
  if (input.startTime >= input.endTime) {
    return { ok: false, updated: 0, created: 0, days, error: 'Start time must be before end time.' }
  }
  const slotDuration = input.slotDuration && input.slotDuration > 0 ? Math.round(input.slotDuration) : 30

  let updated = 0
  let created = 0
  for (const dayOfWeek of days) {
    try {
      // Find an existing weekly row for this provider+tenant+day.
      const existing = await payload.find({
        collection: 'availability',
        where: {
          and: [
            { provider: { equals: input.providerUserId } },
            { tenant: { equals: input.tenantId } },
            { availabilityType: { equals: 'weekly' } },
            { 'weeklySchedule.dayOfWeek': { equals: dayOfWeek } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const doc = existing.docs?.[0] as { id: number | string } | undefined
      const data = {
        title: `${DOW_LABEL[Number(dayOfWeek)]} ${input.startTime}-${input.endTime}`,
        provider: input.providerUserId,
        tenant: input.tenantId,
        availabilityType: 'weekly',
        weeklySchedule: { dayOfWeek, startTime: input.startTime, endTime: input.endTime },
        slotDuration,
        isActive: true,
      }
      if (doc) {
        await payload.update({ collection: 'availability', id: doc.id, data: data as never, overrideAccess: true })
        updated++
      } else {
        await payload.create({ collection: 'availability', data: data as never, overrideAccess: true })
        created++
      }
    } catch {
      /* skip this day, keep going */
    }
  }
  return { ok: updated + created > 0, updated, created, days }
}
