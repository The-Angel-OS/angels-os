/**
 * Personal Agenda — GET /api/planner-ops/agenda?days=14
 *
 * The signed-in user's complete planner in one call: upcoming bookings + events
 * merged into a time-sorted timeline, their active quests, and their "book time
 * with me" scheduling link. This is the data behind the home angel's out-of-the-
 * box planner (Slice 3). Self-scoped — always the caller's own agenda.
 *
 * @see src/utilities/buildPersonalAgenda.ts
 */
import type { PayloadHandler } from 'payload'
import { buildPersonalAgenda } from '@/utilities/buildPersonalAgenda'

export const personalAgendaHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const daysParam = Number(url.searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 14

  try {
    const agenda = await buildPersonalAgenda(payload, (user as { id: number | string }).id, {
      days,
      nowIso: new Date().toISOString(),
    })
    return Response.json({ ok: true, ...agenda })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'agenda lookup failed' },
      { status: 500 },
    )
  }
}
