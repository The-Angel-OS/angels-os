/**
 * Daily Bread Progress — GET/POST /api/works-ops/daily/progress
 *
 * The tracked-streak piece of Daily Bread. The Nimue reader:
 *   - GET  → fetch the signed-in user's progress (furthest day, streak, verses/day)
 *   - POST { dayNumber } → mark a day read (advances streak; the "Next" button)
 *   - POST { versesPerDay } → set the more/less verse dial
 *
 * Self-scoped, Settings-backed (no schema), fail-soft. Reading is a gift, not a
 * mandate — this just remembers where someone is so the reader can show it.
 *
 * @see src/utilities/dailyBreadProgress.ts
 */
import type { PayloadHandler } from 'payload'
import {
  getDailyBreadProgress,
  recordDailyBreadRead,
  setVersesPerDay,
} from '@/utilities/dailyBreadProgress'

export const dailyBreadProgressHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })
  const userId = (user as { id: number | string }).id

  const method = (req.method || 'GET').toUpperCase()

  try {
    if (method === 'GET') {
      const progress = await getDailyBreadProgress(payload, userId)
      return Response.json({ ok: true, progress })
    }

    // POST — record a read and/or set the verse dial.
    let body: Record<string, unknown> = {}
    try {
      body = (await (req as unknown as Request).json()) as Record<string, unknown>
    } catch {
      /* optional body */
    }

    let progress = await getDailyBreadProgress(payload, userId)

    if (typeof body.versesPerDay === 'number') {
      progress = await setVersesPerDay(payload, userId, body.versesPerDay)
    }
    if (typeof body.dayNumber === 'number') {
      const readIso = typeof body.readDate === 'string' ? body.readDate : new Date().toISOString()
      progress = await recordDailyBreadRead(payload, userId, body.dayNumber, readIso)
    }

    return Response.json({ ok: true, progress })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'progress update failed' },
      { status: 500 },
    )
  }
}
