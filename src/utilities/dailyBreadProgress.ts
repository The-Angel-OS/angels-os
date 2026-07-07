/**
 * dailyBreadProgress — per-user reading progress + streak for Daily Bread.
 *
 * Daily Bread is deterministic by date (dailyBread.ts: each day = a dayNumber
 * into the canon), so "progress" is just a little state: how far they've read and
 * their streak. We persist it in the generic `settings` bag (entityName='user',
 * settingName='daily_bread_progress') — ZERO new schema, no migration.
 *
 * Non-forcing by design: reading is a gift, not a mandate — this just lets the
 * reader show "day 42, 6-day streak" and lets someone read ahead without losing
 * their place.
 *
 * @see src/utilities/dailyBread.ts — the deterministic plan
 * @see src/collections/Settings — the generic key/value store
 */
import type { Payload } from 'payload'

const ENTITY = 'user'
const SETTING = 'daily_bread_progress'

export interface DailyBreadProgress {
  /** Furthest day-number in the plan the user has marked read. */
  furthestDay: number
  /** ISO date (YYYY-MM-DD) they last read on. */
  lastReadDate: string | null
  /** Consecutive-day streak. */
  streak: number
  longestStreak: number
  /** Preferred verses-per-day (the reader's "more/less" dial). */
  versesPerDay: number
  /** Total distinct days they've read. */
  totalDaysRead: number
}

const EMPTY: DailyBreadProgress = {
  furthestDay: 0,
  lastReadDate: null,
  streak: 0,
  longestStreak: 0,
  versesPerDay: 3,
  totalDaysRead: 0,
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}
function daysBetween(a: string, b: string): number {
  const ms = new Date(`${dayKey(b)}T00:00:00Z`).getTime() - new Date(`${dayKey(a)}T00:00:00Z`).getTime()
  return Math.round(ms / 86_400_000)
}

async function findRow(payload: Payload, userId: number | string) {
  const res = await payload.find({
    collection: 'settings',
    where: {
      and: [
        { entityName: { equals: ENTITY } },
        { entityId: { equals: String(userId) } },
        { settingName: { equals: SETTING } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs?.[0] as { id: number | string; settingValue?: string } | undefined
}

/** Read a user's progress. Fail-soft → EMPTY. */
export async function getDailyBreadProgress(
  payload: Payload,
  userId: number | string,
): Promise<DailyBreadProgress> {
  try {
    const row = await findRow(payload, userId)
    if (!row?.settingValue) return { ...EMPTY }
    return { ...EMPTY, ...(JSON.parse(row.settingValue) as Partial<DailyBreadProgress>) }
  } catch {
    return { ...EMPTY }
  }
}

async function save(payload: Payload, userId: number | string, p: DailyBreadProgress): Promise<void> {
  const row = await findRow(payload, userId)
  const data = {
    entityName: ENTITY,
    entityId: String(userId),
    settingName: SETTING,
    settingValue: JSON.stringify(p),
    isPrivate: true,
  }
  if (row) {
    await payload.update({ collection: 'settings', id: row.id, data: data as never, overrideAccess: true })
  } else {
    await payload.create({ collection: 'settings', data: data as never, overrideAccess: true })
  }
}

/**
 * Record that the user read `dayNumber` on `readIso`. Advances furthest-day and
 * updates the streak (consecutive calendar days). Idempotent within a day —
 * reading twice the same day doesn't inflate the streak. Returns the new state.
 */
export async function recordDailyBreadRead(
  payload: Payload,
  userId: number | string,
  dayNumber: number,
  readIso: string,
): Promise<DailyBreadProgress> {
  const p = await getDailyBreadProgress(payload, userId)
  const today = dayKey(readIso)

  if (p.lastReadDate !== today) {
    // New calendar day → advance the streak (or reset if a day was skipped).
    if (p.lastReadDate) {
      const gap = daysBetween(p.lastReadDate, today)
      p.streak = gap === 1 ? p.streak + 1 : 1
    } else {
      p.streak = 1
    }
    p.lastReadDate = today
    p.totalDaysRead += 1
    if (p.streak > p.longestStreak) p.longestStreak = p.streak
  }
  if (dayNumber > p.furthestDay) p.furthestDay = dayNumber

  try {
    await save(payload, userId, p)
  } catch {
    /* non-fatal — progress is nice-to-have, never blocks reading */
  }
  return p
}

/** Set the reader's verses-per-day preference (the more/less dial). */
export async function setVersesPerDay(
  payload: Payload,
  userId: number | string,
  versesPerDay: number,
): Promise<DailyBreadProgress> {
  const p = await getDailyBreadProgress(payload, userId)
  p.versesPerDay = Math.max(1, Math.min(12, Math.round(versesPerDay)))
  try {
    await save(payload, userId, p)
  } catch {
    /* non-fatal */
  }
  return p
}
