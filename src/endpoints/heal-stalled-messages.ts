/**
 * Stalled-reply watchdog — GET/POST /api/message-ops/heal-stalled
 *
 * LEO pre-creates a "..." placeholder before streaming so a partial answer
 * survives a dropped connection. When the turn finishes it becomes the reply.
 * When the turn NEVER finishes — a provider that accepts the request and never
 * responds, a container restart mid-stream, an image the model can't decode —
 * the "..." stays in the channel forever, because the only code that clears it
 * lives at the end of the turn that died.
 *
 * leo-stream already sweeps stale placeholders, but only in the channel you are
 * writing to, and only when you write again. So the failure is invisible exactly
 * when you are waiting on it: 260728, an analyze_image turn hung on
 * gemini-flash-lite and Ken watched "..." for five minutes with nothing on the
 * platform able to notice.
 *
 * This sweeps every channel on its own clock. A stalled turn becomes a message
 * that says what happened, which is the difference between a system that failed
 * and a system that appears to be thinking.
 */
import type { PayloadHandler } from 'payload'

/**
 * Older than this with `streaming: true` = the turn that wrote it is gone.
 *
 * Ten minutes, not three. The turn that prompted this watchdog took FIVE — a
 * single analyze_image tool call sat for 302 seconds and then answered
 * correctly. A three-minute sweep would have told Ken it failed while it was
 * still working, and then the real reply would have overwritten the apology.
 * The threshold has to sit above the slowest turn that still succeeds.
 */
const STALL_MS = 10 * 60 * 1000

/** Never rewrite more than this in one pass — a backlog is a bug, not a sweep. */
const MAX_PER_RUN = 50

const STALLED_TEXT =
  "⚠️ LEO didn't finish answering that one — the turn stopped before it could reply. Ask again and it will retry."

export const healStalledMessagesHandler: PayloadHandler = async (req) => {
  const { payload } = req

  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALL_MS).toISOString()

  let stalled: Array<{ id: number; channel?: string; space?: unknown }> = []
  try {
    const result = await payload.find({
      collection: 'messages',
      where: {
        and: [
          { messageType: { equals: 'ai_agent' } },
          { 'metadata.streaming': { equals: true } },
          { createdAt: { less_than: cutoff } },
        ],
      },
      limit: MAX_PER_RUN,
      depth: 0,
      sort: 'createdAt',
      overrideAccess: true,
    })
    stalled = result.docs as typeof stalled
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'find failed' },
      { status: 500 },
    )
  }

  let healed = 0
  const failed: number[] = []
  for (const msg of stalled) {
    try {
      await payload.update({
        collection: 'messages',
        id: msg.id,
        data: {
          content: { text: STALLED_TEXT, type: 'text' },
          // `abandoned` marks it as swept rather than answered, so the next pass
          // skips it and a human reading the row knows nothing was lost here that
          // the model ever produced.
          metadata: { streaming: false, error: true, abandoned: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        overrideAccess: true,
        context: { skipMessageVersioning: true },
      })
      healed++
    } catch {
      failed.push(msg.id)
    }
  }

  if (healed > 0) {
    console.info(`[heal-stalled] swept ${healed} stalled LEO placeholder(s)`)
  }

  return Response.json({
    ok: true,
    found: stalled.length,
    healed,
    ...(failed.length ? { failed } : {}),
    stallMinutes: STALL_MS / 60000,
  })
}
