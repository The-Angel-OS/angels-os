/**
 * Read state — POST /api/chat/mark-read and GET /api/chat/unread
 *
 * The pair that gives anyone a reason to open the app: something can finally
 * tell you there is a message you have not seen.
 *
 * Both operate on `users.readState`, a `{ channelSlug: isoTimestamp }` map. See
 * `utilities/readState.ts` for why that shape and what it cannot do.
 */
import type { PayloadHandler } from 'payload'

import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { logError } from '@/utilities/logError'
import {
  capUnread,
  mergeReadState,
  normalizeReadState,
  sinceFor,
  UNREAD_CAP,
  type ReadState,
} from '@/utilities/readState'

/** Bound the fan-out; a client asking about more channels than this is a bug. */
const MAX_CHANNELS_PER_QUERY = 200

/**
 * POST /api/chat/mark-read
 * Body: { channel: string, at?: ISO string }   (`at` defaults to now)
 *
 * Idempotent and monotonic — see mergeReadState. Marking a channel you have
 * already read past is a no-op that does not write.
 */
export const markReadHandler: PayloadHandler = async (req) => {
  const { user, payload } = req
  if (!user) return Response.json({ message: 'Unauthorized' }, { status: 401 })

  const rateLimited = applyRateLimit(req, 'chat_mark_read')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const channel = typeof body.channel === 'string' ? body.channel.trim() : ''
  if (!channel) return Response.json({ message: 'Missing: channel' }, { status: 400 })

  const at = typeof body.at === 'string' && !Number.isNaN(Date.parse(body.at))
    ? new Date(body.at).toISOString()
    : new Date().toISOString()

  try {
    const before = normalizeReadState((user as unknown as { readState?: unknown }).readState)
    const merged = mergeReadState(before, channel, at)

    // The mark only ever moves forward, so most calls change nothing: the client
    // re-marks on a debounce while you sit in a channel. Skipping the write is
    // the difference between one row update per channel VISIT and one per tick.
    if (merged[channel] === before[channel]) {
      return Response.json({ channel, at: before[channel] ?? at, changed: false })
    }

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { readState: merged } as unknown as Record<string, unknown>,
      overrideAccess: true,
      depth: 0,
    })

    return Response.json({ channel, at: merged[channel], changed: true })
  } catch (err) {
    void logError({
      source: 'chat/mark-read',
      level: 'warning',
      message: `mark-read failed for user ${user.id} on ${channel}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
    })
    return Response.json({ message: 'Failed to record read state' }, { status: 500 })
  }
}

/**
 * GET /api/chat/unread?channels=a,b,c
 * → { unread: { a: 3, b: 0, c: 99 }, cap: 99 }
 *
 * One query for every channel, not one per channel: the per-channel time floor
 * rides along in a VALUES join. A channel with no mark has no floor, so all of
 * it counts.
 */
export const unreadHandler: PayloadHandler = async (req) => {
  const { user, payload } = req
  if (!user) return Response.json({ message: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const channels = (url.searchParams.get('channels') || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, MAX_CHANNELS_PER_QUERY)

  if (channels.length === 0) return Response.json({ unread: {}, cap: UNREAD_CAP })

  const state = normalizeReadState((user as unknown as { readState?: unknown }).readState)
  const unread: Record<string, number> = {}
  for (const c of channels) unread[c] = 0

  try {
    const counts = await countUnread(payload, user.id, channels, state)
    for (const [channel, n] of Object.entries(counts)) unread[channel] = capUnread(n)
    return Response.json({ unread, cap: UNREAD_CAP })
  } catch (err) {
    // Returning zeros on failure is indistinguishable from "nothing new", which
    // is the one wrong answer a user cannot detect. Say so instead.
    void logError({
      source: 'chat/unread',
      level: 'warning',
      message: `unread count failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
    })
    return Response.json({ message: 'Failed to count unread' }, { status: 500 })
  }
}

/**
 * One SQL round trip. Falls back to per-channel `payload.count()` if the raw
 * pool is not reachable — slower, but a wrong zero here looks exactly like
 * "nothing new", and that is the failure a user can never notice.
 */
async function countUnread(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  userId: number | string,
  channels: string[],
  state: ReadState,
): Promise<Record<string, number>> {
  const pool = payload?.db?.pool || payload?.db?.drizzle?.session?.client

  if (pool) {
    const params: unknown[] = [userId]
    const rows = channels.map((c) => {
      const since = sinceFor(state, c)
      params.push(c, since)
      // The first row carries the casts so Postgres can type the VALUES list.
      const i = params.length
      return params.length === 3
        ? `($${i - 1}::text, $${i}::timestamptz)`
        : `($${i - 1}, $${i})`
    })

    const sql = `
      SELECT m.channel AS channel, count(*)::int AS n
        FROM messages m
        JOIN (VALUES ${rows.join(', ')}) AS r(channel, since)
          ON m.channel = r.channel
       WHERE (r.since IS NULL OR m.created_at > r.since)
         -- Your own message is not news to you.
         AND (m.author_id IS NULL OR m.author_id <> $1)
       GROUP BY m.channel
    `
    const res = await pool.query(sql, params)
    const out: Record<string, number> = {}
    for (const row of res.rows || []) out[String(row.channel)] = Number(row.n) || 0
    return out
  }

  const out: Record<string, number> = {}
  for (const channel of channels) {
    const since = sinceFor(state, channel)
    const where: Record<string, unknown> = { channel: { equals: channel } }
    if (since) where.createdAt = { greater_than: since }
    const { totalDocs } = await payload.count({
      collection: 'messages',
      where: { and: [where, { author: { not_equals: userId } }] },
      overrideAccess: true,
    })
    out[channel] = totalDocs || 0
  }
  return out
}
