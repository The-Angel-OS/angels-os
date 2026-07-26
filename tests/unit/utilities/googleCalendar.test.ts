/**
 * Google Calendar integration — the parts that can be wrong quietly.
 *
 * The failure that matters isn't an exception, it's a DOUBLE BOOKING: a provider
 * who took an appointment by phone shows as free, someone books over it, and the
 * platform looks broken at the exact moment it's being judged. So: busy blocks
 * must actually be read, and every failure mode must degrade to "no blocks"
 * rather than throwing into /book.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

vi.mock('@/utilities/logError', () => ({ logError: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/utilities/encryption', () => ({
  safeDecrypt: (v: string) => (v === 'BAD' ? null : v.replace(/^enc:/, '')),
}))

import { fetchBusyBlocks, createCalendarEvent } from '@/utilities/googleCalendar'

const realFetch = globalThis.fetch
const T0 = new Date('2026-08-01T12:00:00.000Z')
const T1 = new Date('2026-08-01T20:00:00.000Z')

function payloadWith(googleCalendar: unknown) {
  return { findByID: vi.fn().mockResolvedValue({ id: 7, googleCalendar }) } as never
}

const CONNECTED = { connected: true, refreshToken: 'enc:refresh-abc', calendarId: 'primary' }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_CLIENT_ID = 'cid'
  process.env.GOOGLE_CLIENT_SECRET = 'csecret'
})

afterAll(() => {
  globalThis.fetch = realFetch
})

/** token endpoint → then the API call. */
function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  const fn = vi.fn()
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: async () => r.body ?? {},
    })
  }
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

describe('fetchBusyBlocks', () => {
  it('returns the provider’s busy windows', async () => {
    mockFetchSequence(
      { ok: true, body: { access_token: 'at' } },
      {
        ok: true,
        body: {
          calendars: {
            primary: {
              busy: [{ start: '2026-08-01T14:00:00Z', end: '2026-08-01T15:00:00Z' }],
            },
          },
        },
      },
    )
    const blocks = await fetchBusyBlocks(payloadWith(CONNECTED), 7, T0, T1)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.start.toISOString()).toBe('2026-08-01T14:00:00.000Z')
  })

  it('returns [] when the provider never connected a calendar', async () => {
    const fetchFn = mockFetchSequence()
    const blocks = await fetchBusyBlocks(payloadWith(undefined), 7, T0, T1)
    expect(blocks).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled() // no token round-trip for the common case
  })

  // Each of these used to be a way to throw INTO the booking page.
  it('returns [] — never throws — when the token refresh is rejected', async () => {
    mockFetchSequence({ ok: false, status: 400 })
    await expect(fetchBusyBlocks(payloadWith(CONNECTED), 7, T0, T1)).resolves.toEqual([])
  })

  it('returns [] when the stored token cannot be decrypted', async () => {
    mockFetchSequence()
    await expect(
      fetchBusyBlocks(payloadWith({ ...CONNECTED, refreshToken: 'BAD' }), 7, T0, T1),
    ).resolves.toEqual([])
  })

  it('returns [] when Google times out', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch
    await expect(fetchBusyBlocks(payloadWith(CONNECTED), 7, T0, T1)).resolves.toEqual([])
  })

  it('drops malformed busy rows instead of emitting Invalid Date', async () => {
    mockFetchSequence(
      { ok: true, body: { access_token: 'at' } },
      { ok: true, body: { calendars: { primary: { busy: [{ start: 'nonsense', end: 'nope' }] } } } },
    )
    await expect(fetchBusyBlocks(payloadWith(CONNECTED), 7, T0, T1)).resolves.toEqual([])
  })
})

describe('createCalendarEvent', () => {
  it('returns the new event id', async () => {
    mockFetchSequence({ ok: true, body: { access_token: 'at' } }, { ok: true, body: { id: 'evt_1' } })
    const id = await createCalendarEvent(payloadWith(CONNECTED), 7, {
      summary: 'Consult',
      start: T0,
      end: T1,
    })
    expect(id).toBe('evt_1')
  })

  it('returns null rather than throwing when the write fails — the booking is already saved', async () => {
    mockFetchSequence({ ok: true, body: { access_token: 'at' } }, { ok: false, status: 403 })
    await expect(
      createCalendarEvent(payloadWith(CONNECTED), 7, { summary: 'Consult', start: T0, end: T1 }),
    ).resolves.toBeNull()
  })
})
