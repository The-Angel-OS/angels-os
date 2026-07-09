/**
 * workProgress — per-user reading position through ANY Work (the Primer/Training
 * Arc, a book, Daily Bread, a training arc). Generic by soulId, so one tracker
 * serves every work. Stored in the generic `settings` bag on the identity node
 * (spacesangels) — entityName='user', settingName='work_progress' — ZERO schema.
 *
 * One row per user holds a map { [soulId]: { chapterIdx, segIdx, percent } } so a
 * dashboard can list "your works in progress" and any reader can resume. Progress
 * is a gift, never a mandate.
 *
 * @see src/utilities/dailyBreadProgress.ts — the same pattern, Daily-Bread-specific
 */
import type { Payload } from 'payload'

const ENTITY = 'user'
const SETTING = 'work_progress'

export interface WorkPosition {
  chapterIdx: number
  segIdx: number
  percent?: number
  updatedAt?: string
}

export type WorkProgressMap = Record<string, WorkPosition>

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

/** All of a user's work positions (soulId → position). Fail-soft → {}. */
export async function getWorkProgress(payload: Payload, userId: number | string): Promise<WorkProgressMap> {
  try {
    const row = await findRow(payload, userId)
    if (!row?.settingValue) return {}
    const parsed = JSON.parse(row.settingValue) as WorkProgressMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Upsert one work's position; returns the full updated map. */
export async function setWorkProgress(
  payload: Payload,
  userId: number | string,
  soulId: string,
  pos: WorkPosition,
): Promise<WorkProgressMap> {
  const map = await getWorkProgress(payload, userId)
  map[soulId] = { ...pos, updatedAt: new Date().toISOString() }

  const row = await findRow(payload, userId)
  const data = {
    entityName: ENTITY,
    entityId: String(userId),
    settingName: SETTING,
    settingValue: JSON.stringify(map),
    isPrivate: true,
  }
  try {
    if (row) await payload.update({ collection: 'settings', id: row.id, data: data as never, overrideAccess: true })
    else await payload.create({ collection: 'settings', data: data as never, overrideAccess: true })
  } catch {
    /* non-fatal — progress never blocks reading */
  }
  return map
}
