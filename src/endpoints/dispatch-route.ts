/**
 * Dispatch Route — POST /api/dispatch-ops/route
 *
 * The active-routing engine for quests-as-delivery: given the signed-in person's
 * current position, sequence the geo-located quests they've accepted into an
 * efficient route (Uber-Eats-style). Call it again whenever a new quest is
 * accepted (or priorities change) to REROUTE — it re-sequences from scratch.
 *
 * Body: { lat, lng, avgMph?, questIds? }
 *   - lat/lng   current position (device GPS)
 *   - avgMph    optional speed for the ETA (default 30)
 *   - questIds  optional explicit set; default = the caller's active accepted quests
 *
 * @see src/utilities/sequenceRoute.ts — the sequencer/optimizer
 * @see src/collections/QuestParticipations — accepted quests
 */
import type { PayloadHandler } from 'payload'
import { sequenceRoute, type RouteStop } from '@/utilities/sequenceRoute'

/** Pull a lat/lng off a quest doc, tolerating a flat or grouped location shape. */
function questGeo(q: Record<string, unknown>): { lat: number; lng: number; address?: string } | null {
  const loc = (q.location as Record<string, unknown>) || q
  const lat = Number(loc.latitude ?? q.latitude)
  const lng = Number(loc.longitude ?? q.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const address = (loc.address as string) || (q.address as string) || undefined
  return { lat, lng, address }
}

export const dispatchRouteHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })
  const userId = (user as { id: number | string }).id

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: 'lat and lng (current position) are required' }, { status: 400 })
  }
  const avgMph = typeof body.avgMph === 'number' ? body.avgMph : undefined

  try {
    // The caller's accepted/active quest participations, with the quest expanded.
    const parts = await payload.find({
      collection: 'quest-participations',
      where: {
        and: [
          { participant: { equals: userId } },
          { status: { in: ['accepted', 'active', 'in-progress'] } },
        ],
      },
      depth: 1,
      limit: 200,
      overrideAccess: true,
    })

    const explicit = Array.isArray(body.questIds) ? new Set((body.questIds as unknown[]).map(String)) : null

    const stops: RouteStop[] = []
    for (const p of parts.docs as unknown as Array<Record<string, unknown>>) {
      const quest = p.quest as Record<string, unknown> | number | string | undefined
      if (!quest || typeof quest !== 'object') continue
      const qId = (quest.id as number | string) ?? ''
      if (explicit && !explicit.has(String(qId))) continue
      const g = questGeo(quest)
      if (!g) continue
      stops.push({
        id: qId,
        label: (quest.title as string) || (g.address ?? `Quest ${qId}`),
        lat: g.lat,
        lng: g.lng,
        address: g.address,
        // Quest priority (if present) pulls urgent stops forward.
        priority: Number(quest.priority) || 0,
        participationId: p.id as number | string,
      })
    }

    const route = sequenceRoute({ lat, lng }, stops, { avgMph })
    return Response.json({
      ok: true,
      ...route,
      skipped: parts.totalDocs - stops.length, // accepted quests without usable geo
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'routing failed' },
      { status: 500 },
    )
  }
}
