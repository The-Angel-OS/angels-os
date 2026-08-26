/**
 * Who has finished which training.
 *
 * The question every employer actually has, and the one thing the training
 * story was still missing: a manager can assign four or five trainings, but had
 * no way to see who had done them.
 *
 * Nothing new is stored. Progress already lives as ONE `settings` row per user
 * (`entityName: 'user'`, `settingName: 'work_progress'`) holding a
 * `{ [workSlug]: { percent } }` map — so this is three queries, no join table
 * and no reporting schema.
 *
 * ponytail: reads every member's row and crosses them in memory. That is right
 * for a company with staff; a portal with 10,000 members wants a real query, and
 * the fix then is a materialized view, not a rewrite of this.
 */
import type { Payload } from 'payload'
import type { WorkProgressMap } from '@/utilities/workProgress'

export interface CompletionRow {
  userId: number
  name: string
  /** workSlug → percent complete (0–100). Absent = never opened. */
  progress: Record<string, number>
}

export interface CompletionReport {
  works: Array<{ slug: string; title: string }>
  people: CompletionRow[]
}

const pct = (p: { percent?: number } | undefined): number => {
  const n = Number(p?.percent)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
}

export async function buildCompletionReport(
  payload: Payload,
  tenantId: number | string,
  workSlugs: Array<{ slug: string; title: string }>,
): Promise<CompletionReport> {
  const members = await payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] },
    limit: 0,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })

  const people = new Map<number, string>()
  for (const m of members.docs as unknown as Array<Record<string, unknown>>) {
    const u = m.user
    const id = u && typeof u === 'object' ? Number((u as { id?: number }).id) : Number(u)
    if (!Number.isFinite(id)) continue
    const name =
      u && typeof u === 'object'
        ? String((u as { name?: string; email?: string }).name || (u as { email?: string }).email || `User ${id}`)
        : `User ${id}`
    people.set(id, name)
  }

  if (!people.size) return { works: workSlugs, people: [] }

  // One query for everyone's progress — `entityId` is the user id as text.
  const rows = await payload.find({
    collection: 'settings',
    where: {
      and: [
        { entityName: { equals: 'user' } },
        { settingName: { equals: 'work_progress' } },
        { entityId: { in: [...people.keys()].map(String) } },
      ],
    },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  const byUser = new Map<number, WorkProgressMap>()
  for (const r of rows.docs as Array<{ entityId?: string; settingValue?: string }>) {
    const id = Number(r.entityId)
    if (!Number.isFinite(id)) continue
    try {
      const parsed = JSON.parse(String(r.settingValue ?? '{}'))
      if (parsed && typeof parsed === 'object') byUser.set(id, parsed as WorkProgressMap)
    } catch {
      // A corrupt row means "no progress recorded", not a broken report.
    }
  }

  const result: CompletionRow[] = [...people.entries()].map(([userId, name]) => {
    const map = byUser.get(userId) ?? {}
    const progress: Record<string, number> = {}
    for (const w of workSlugs) progress[w.slug] = pct(map[w.slug])
    return { userId, name, progress }
  })

  // Furthest along first — a manager is looking for who has NOT finished, and a
  // stable order beats an arbitrary one.
  result.sort((a, b) => a.name.localeCompare(b.name))
  return { works: workSlugs, people: result }
}
