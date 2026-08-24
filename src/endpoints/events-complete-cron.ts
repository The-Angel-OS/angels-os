/**
 * Close out events whose time has passed — GET /api/event-ops/complete
 *
 * `Events.status` is a manual dropdown (draft / upcoming / live / completed) and
 * nothing ever moved it. So "Past Events" on /events only filled up if a human
 * remembered to go and flip it, which on a portal with one admin means never —
 * and an archive nobody populates is not an archive.
 *
 * The rule is deliberately dumb: an event whose end (or start, when there is no
 * end) is more than END_GRACE_MS behind us is completed. The grace exists so a
 * long meeting that runs over is not marked finished while people are still in
 * the room.
 *
 * `cancelled` and `draft` are left alone — cancelled did not happen, and draft
 * was never published. Only `upcoming` and `live` are ours to close.
 *
 * Runs hourly from the jobs queue. Idempotent: a second pass finds nothing.
 *
 * @see src/jobs/cronTasks.ts
 */
import type { PayloadHandler } from 'payload'
import { logError } from '@/utilities/logError'

/** Two hours. Long enough that an event running over is not closed under it. */
const END_GRACE_MS = 2 * 60 * 60 * 1000

export const eventsCompleteCronHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const cutoff = new Date(Date.now() - END_GRACE_MS).toISOString()

  try {
    // Two passes rather than one clever `or`: events WITH an end date are judged
    // on it, events without are judged on their start. Expressing that as a
    // single where-clause needs an `exists` branch that reads worse than this.
    const withEnd = await payload.find({
      collection: 'events',
      where: {
        and: [
          { status: { in: ['upcoming', 'live'] } },
          { endDateTime: { less_than: cutoff } },
        ],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
      req,
    })

    const withoutEnd = await payload.find({
      collection: 'events',
      where: {
        and: [
          { status: { in: ['upcoming', 'live'] } },
          { endDateTime: { exists: false } },
          { startDateTime: { less_than: cutoff } },
        ],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
      req,
    })

    const stale = [...withEnd.docs, ...withoutEnd.docs] as Array<{ id: number; title?: string }>

    let completed = 0
    for (const ev of stale) {
      try {
        await payload.update({
          collection: 'events',
          id: ev.id,
          data: { status: 'completed' },
          overrideAccess: true,
          req,
        })
        completed++
      } catch (err) {
        // Non-fatal per event — one bad row must not stop the sweep.
        payload.logger?.warn?.(
          `[events-complete] could not close event ${ev.id}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    if (completed > 0) payload.logger?.info?.(`[events-complete] closed ${completed} event(s)`)
    return Response.json({ ok: true, examined: stale.length, completed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logError({
      source: 'events-complete',
      message: `Event completion sweep failed: ${msg}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
    })
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
