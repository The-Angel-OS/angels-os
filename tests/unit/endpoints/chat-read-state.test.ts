/**
 * Read state endpoints — POST /api/chat/mark-read, GET /api/chat/unread
 *
 * The behaviours worth locking down are the ones a user could never notice were
 * broken: a write that silently does not happen, and an unread count that
 * silently reads zero.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { markReadHandler, unreadHandler } from '@/endpoints/chat-read-state'
import { UNREAD_CAP } from '@/utilities/readState'

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: vi.fn(() => null) }))
vi.mock('@/utilities/logError', () => ({ logError: vi.fn() }))

const T1 = '2026-08-24T10:00:00.000Z'
const T2 = '2026-08-24T11:00:00.000Z'

function makeMarkReq(body: unknown, user: Record<string, unknown> | null = { id: 7 }) {
  const update = vi.fn().mockResolvedValue({})
  const req = Object.assign(
    new Request('http://localhost/api/chat/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { user, payload: { update } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any
  return { req, update }
}

function makeUnreadReq(
  channels: string,
  user: Record<string, unknown> | null = { id: 7 },
  rows: Array<{ channel: string; n: number }> = [],
) {
  const query = vi.fn().mockResolvedValue({ rows })
  const req = Object.assign(
    new Request(`http://localhost/api/chat/unread?channels=${channels}`, { method: 'GET' }),
    { user, payload: { db: { pool: { query } } } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any
  return { req, query }
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/chat/mark-read', () => {
  it('rejects an anonymous caller', async () => {
    const { req } = makeMarkReq({ channel: 'general' }, null)
    expect((await markReadHandler(req)).status).toBe(401)
  })

  it('requires a channel', async () => {
    const { req } = makeMarkReq({ at: T1 })
    expect((await markReadHandler(req)).status).toBe(400)
  })

  it('writes the mark for a channel with none', async () => {
    const { req, update } = makeMarkReq({ channel: 'general', at: T1 })
    const body = await (await markReadHandler(req)).json()
    expect(body).toMatchObject({ channel: 'general', at: T1, changed: true })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].data.readState).toEqual({ general: T1 })
  })

  it('moves an existing mark forward', async () => {
    const { req, update } = makeMarkReq({ channel: 'general', at: T2 }, { id: 7, readState: { general: T1 } })
    const body = await (await markReadHandler(req)).json()
    expect(body.changed).toBe(true)
    expect(update.mock.calls[0][0].data.readState).toEqual({ general: T2 })
  })

  it('DOES NOT WRITE when the mark would not move — the debounce case', async () => {
    // The client re-marks on a timer while you sit in a channel. Writing every
    // tick would be one row update per second per reader.
    const { req, update } = makeMarkReq({ channel: 'general', at: T1 }, { id: 7, readState: { general: T2 } })
    const body = await (await markReadHandler(req)).json()
    expect(body.changed).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('defaults `at` to now when omitted', async () => {
    const { req, update } = makeMarkReq({ channel: 'general' })
    await markReadHandler(req)
    const written = update.mock.calls[0][0].data.readState.general
    expect(Date.now() - Date.parse(written)).toBeLessThan(5000)
  })

  it('reports failure instead of pretending the mark landed', async () => {
    const { req } = makeMarkReq({ channel: 'general', at: T1 })
    req.payload.update = vi.fn().mockRejectedValue(new Error('DB write failed'))
    expect((await markReadHandler(req)).status).toBe(500)
  })
})

describe('GET /api/chat/unread', () => {
  it('rejects an anonymous caller', async () => {
    const { req } = makeUnreadReq('general', null)
    expect((await unreadHandler(req)).status).toBe(401)
  })

  it('returns an empty map when no channels are asked for', async () => {
    const { req, query } = makeUnreadReq('')
    const body = await (await unreadHandler(req)).json()
    expect(body.unread).toEqual({})
    expect(query).not.toHaveBeenCalled()
  })

  it('reports zero for a channel the query returned no row for', async () => {
    // GROUP BY omits empty channels entirely; the caller still needs the key,
    // or the UI cannot tell "zero unread" from "channel unknown".
    const { req } = makeUnreadReq('general,random', { id: 7 }, [{ channel: 'general', n: 3 }])
    const body = await (await unreadHandler(req)).json()
    expect(body.unread).toEqual({ general: 3, random: 0 })
  })

  it('caps the count at 99', async () => {
    const { req } = makeUnreadReq('gotify', { id: 7 }, [{ channel: 'gotify', n: 1909 }])
    const body = await (await unreadHandler(req)).json()
    expect(body.unread.gotify).toBe(UNREAD_CAP)
    expect(body.cap).toBe(UNREAD_CAP)
  })

  it('passes a NULL floor for an unread channel and the mark for a read one', async () => {
    const { req, query } = makeUnreadReq('a,b', { id: 7, readState: { b: T1 } })
    await unreadHandler(req)
    const [, params] = query.mock.calls[0]
    expect(params[0]).toBe(7) // the user, for the "not my own message" clause
    expect(params).toContain('a')
    expect(params).toContain(null) // channel a has never been read
    expect(params).toContain(T1) // channel b resumes from its mark
  })

  it('excludes the caller\'s own messages', async () => {
    const { req, query } = makeUnreadReq('general')
    await unreadHandler(req)
    expect(query.mock.calls[0][0]).toMatch(/author_id/)
  })

  it('500s rather than reporting zero unread when the query fails', async () => {
    // A wrong zero is indistinguishable from "nothing new" — the one failure a
    // user can never detect, and the reason this is not a silent catch.
    const { req } = makeUnreadReq('general')
    req.payload.db.pool.query = vi.fn().mockRejectedValue(new Error('pg down'))
    expect((await unreadHandler(req)).status).toBe(500)
  })

  it('falls back to per-channel counts when no raw pool is reachable', async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 4 })
    const req = Object.assign(
      new Request('http://localhost/api/chat/unread?channels=general', { method: 'GET' }),
      { user: { id: 7 }, payload: { count } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any
    const body = await (await unreadHandler(req)).json()
    expect(body.unread).toEqual({ general: 4 })
    expect(count).toHaveBeenCalledTimes(1)
  })
})
