/**
 * buildPersonalAgenda — the personal planner's brain.
 *
 * Aggregates everything on a person's plate into ONE sorted timeline, pulling
 * from collections they already have data in:
 *   - Bookings  (appointments on their calendar — they're the provider)
 *   - Events    (things they're hosting/attending)
 *   - Quests    (active quest participations — the "to-do" rail)
 *
 * This is what makes the home angel "a complete planner out of the box": every
 * time-bound thing across all their portals, in one agenda. Reused by the
 * planner endpoint AND the `get_agenda` LEO tool so both answer identically.
 *
 * Fail-soft per source — a missing/renamed collection degrades that lane to empty
 * rather than breaking the whole agenda.
 *
 * @see src/collections/Bookings.ts · Events.ts · QuestParticipations
 * @see src/utilities/guardianEntitlement.ts — resolveGuardianTenant (the /book link)
 */
import type { Payload } from 'payload'
import { resolveGuardianTenant } from '@/utilities/guardianEntitlement'
import { guardianBaseDomain } from '@/utilities/guardianSlug'

export interface AgendaItem {
  type: 'booking' | 'event'
  id: number | string
  title: string
  start: string // ISO
  end?: string // ISO
  status?: string
}

export interface AgendaQuest {
  id: number | string
  title: string
  status?: string
}

export interface PersonalAgenda {
  now: string
  windowDays: number
  /** Time-sorted upcoming bookings + events. */
  items: AgendaItem[]
  /** Active quests (the to-do rail; no fixed time). */
  quests: AgendaQuest[]
  /** The user's public "book time with me" link, when they have a guardian angel. */
  schedulingLink?: string
  counts: { bookings: number; events: number; quests: number }
}

/**
 * Build the signed-in user's agenda over the next `days` (default 14). `nowIso`
 * is injected (callers stamp the clock) so this stays pure/testable.
 */
export async function buildPersonalAgenda(
  payload: Payload,
  userId: number | string,
  opts: { days?: number; nowIso: string },
): Promise<PersonalAgenda> {
  const windowDays = Math.max(1, Math.min(90, Math.round(opts.days ?? 14)))
  const now = opts.nowIso
  const until = new Date(new Date(now).getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString()

  const items: AgendaItem[] = []
  const quests: AgendaQuest[] = []

  // ── Bookings on my calendar (I'm the provider) ──
  let bookings = 0
  try {
    const res = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { provider: { equals: userId } },
          { startDateTime: { greater_than_equal: now } },
          { startDateTime: { less_than_equal: until } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      sort: 'startDateTime',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of res.docs as unknown as Array<Record<string, unknown>>) {
      items.push({
        type: 'booking',
        id: d.id as number | string,
        title: (d.title as string) || 'Appointment',
        start: d.startDateTime as string,
        end: (d.endDateTime as string) || undefined,
        status: (d.status as string) || undefined,
      })
      bookings++
    }
  } catch {
    /* lane empty */
  }

  // ── Events I host ──
  let events = 0
  try {
    const res = await payload.find({
      collection: 'events',
      where: {
        and: [
          { provider: { equals: userId } },
          { startDateTime: { greater_than_equal: now } },
          { startDateTime: { less_than_equal: until } },
        ],
      },
      sort: 'startDateTime',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of res.docs as unknown as Array<Record<string, unknown>>) {
      items.push({
        type: 'event',
        id: d.id as number | string,
        title: (d.title as string) || 'Event',
        start: d.startDateTime as string,
        end: (d.endDateTime as string) || undefined,
        status: (d.status as string) || undefined,
      })
      events++
    }
  } catch {
    /* lane empty */
  }

  // ── Active quests (the to-do rail) ──
  try {
    const res = await payload.find({
      collection: 'quest-participations',
      where: {
        and: [
          { participant: { equals: userId } },
          { status: { in: ['active', 'in-progress', 'accepted', 'pending'] } },
        ],
      },
      limit: 100,
      depth: 1,
      overrideAccess: true,
    })
    for (const d of res.docs as unknown as Array<Record<string, unknown>>) {
      const q = d.quest as { id?: number | string; title?: string } | number | string | undefined
      const title = q && typeof q === 'object' ? q.title || 'Quest' : 'Quest'
      quests.push({ id: d.id as number | string, title, status: (d.status as string) || undefined })
    }
  } catch {
    /* lane empty */
  }

  // Merge-sort the timed items chronologically.
  items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // The "book time with me" link off their guardian angel.
  let schedulingLink: string | undefined
  try {
    const t = await resolveGuardianTenant(payload, userId)
    const host = t?.domain || (t?.slug ? `${t.slug}.${guardianBaseDomain()}` : undefined)
    if (host) schedulingLink = `https://${host}/book`
  } catch {
    /* no angel yet */
  }

  return {
    now,
    windowDays,
    items,
    quests,
    schedulingLink,
    counts: { bookings, events, quests: quests.length },
  }
}
