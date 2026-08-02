/**
 * Chat Send Endpoint — Unit Tests
 *
 * POST /api/chat/send
 * Auth required. Creates a message in the Messages collection.
 * Validates space membership (or admin bypass). Rate limited.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// logError lazy-imports @payload-config (boots Payload against a live DB) —
// unmocked, error-path tests hang to the 30s timeout instead of asserting.
vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
  logCaughtError: vi.fn(async () => {}),
}))

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))

import { chatSendHandler } from '@/endpoints/chat-send'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_SPACE = { id: 5, name: 'Main Space', tenant: { id: 10 } }
const SAVED_MESSAGE = { id: 100, content: { root: {} }, channel: 'general' }
const VALID_BODY = { space: 5, channel: 'general', content: { root: {} } }

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(DEFAULT_SPACE),
    find: vi.fn().mockResolvedValue({ docs: [{ id: 1, role: 'member' }], totalDocs: 1 }),
    create: vi.fn().mockResolvedValue(SAVED_MESSAGE),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, roles: ['member'] },
  body: Record<string, unknown> | null = VALID_BODY,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('chatSendHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await chatSendHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/unauthorized/i)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(
      Response.json({ error: 'Rate limit exceeded' }, { status: 429 }),
    )
    const req = makeReq()
    const res = await chatSendHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1, roles: ['member'] }, null)
    const res = await chatSendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/invalid json/i)
  })

  it('returns 400 when space is missing', async () => {
    const req = makeReq({ id: 1 }, { channel: 'general', content: {} })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/space/i)
  })

  it('returns 400 when channel is missing', async () => {
    const req = makeReq({ id: 1 }, { space: 5, content: {} })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/channel/i)
  })

  it('returns 400 when content is missing', async () => {
    const req = makeReq({ id: 1 }, { space: 5, channel: 'general' })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/content/i)
  })

  it('returns 400 for whitespace-only text content', async () => {
    const req = makeReq({ id: 1 }, { space: 5, channel: 'general', content: { type: 'text', text: '   \n  ' } })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/empty/i)
  })

  it('returns 400 for message exceeding length limit', async () => {
    const longText = 'a'.repeat(51_000)
    const req = makeReq({ id: 1 }, { space: 5, channel: 'general', content: { type: 'text', text: longText } })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/too long/i)
  })

  it('allows message just under the length limit', async () => {
    const okText = 'a'.repeat(50_000)
    const req = makeReq({ id: 1, roles: ['admin'] }, { space: 5, channel: 'general', content: { type: 'text', text: okText } })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(201)
  })

  it('returns 404 when space is not found', async () => {
    const req = makeReq({ id: 1 }, VALID_BODY, {
      findByID: vi.fn().mockResolvedValue(null),
    })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toMatch(/not found/i)
  })

  it('returns 404 when findByID throws', async () => {
    const req = makeReq({ id: 1 }, VALID_BODY, {
      findByID: vi.fn().mockRejectedValue(new Error('Not Found')),
    })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(404)
  })

  it('returns 403 when user has no active space membership', async () => {
    const req = makeReq(
      { id: 1, roles: ['member'] }, // not admin
      VALID_BODY,
      {
        find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }), // no membership
      },
    )
    const res = await chatSendHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.message).toMatch(/access to this space/i)
  })

  it('allows admin to send without space membership', async () => {
    const createMock = vi.fn().mockResolvedValue(SAVED_MESSAGE)
    const req = makeReq(
      { id: 1, roles: ['admin'] },
      VALID_BODY,
      {
        find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }), // no membership
        create: createMock,
      },
    )
    const res = await chatSendHandler(req)
    expect(res.status).toBe(201)
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('returns 201 with saved message on success', async () => {
    const req = makeReq()
    const res = await chatSendHandler(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.doc).toEqual(SAVED_MESSAGE)
  })

  it('attaches media in a phase-2 update, never in the create (rollback hardening)', async () => {
    // The endpoint is deliberately TWO-PHASE: create the message attachment-
    // free (so the attachment-gated hook chain can't roll the save back), then
    // link media in a follow-up update that is isolated in its own try/catch.
    const createMock = vi.fn().mockResolvedValue(SAVED_MESSAGE)
    const updateMock = vi.fn().mockResolvedValue({
      ...SAVED_MESSAGE,
      attachments: [{ media: 5, caption: 'Photo' }],
    })
    const req = makeReq(
      { id: 1, roles: ['admin'] },
      { ...VALID_BODY, attachments: [{ media: 5, caption: 'Photo' }] },
      { create: createMock, update: updateMock },
    )
    await chatSendHandler(req)
    const createData = createMock.mock.calls[0][0].data
    expect(createData.attachments).toBeUndefined()
    expect(updateMock).toHaveBeenCalledOnce()
    const updateArgs = updateMock.mock.calls[0][0]
    expect(updateArgs.id).toBe(SAVED_MESSAGE.id)
    expect(updateArgs.data.attachments).toHaveLength(1)
    expect(updateArgs.data.attachments[0].media).toBe(5)
  })

  it('coerces a string media id to a number — Payload rejects "5" outright', async () => {
    // isValidID(value, 'number') is a bare `typeof value === 'number'`, so a
    // JSON-encoded string id fails as "invalid: Attachments 1 > Media" even
    // though the row exists. Nimue sends strings; the web composer sends numbers,
    // which is why only one of them ever showed the bug. (260801)
    const createMock = vi.fn().mockResolvedValue(SAVED_MESSAGE)
    const updateMock = vi.fn().mockResolvedValue({ ...SAVED_MESSAGE, attachments: [{ media: 5 }] })
    const req = makeReq(
      { id: 1, roles: ['admin'] },
      { ...VALID_BODY, attachments: [{ media: '5', caption: 'From Nimue' }] },
      { create: createMock, update: updateMock },
    )
    await chatSendHandler(req)
    const sent = updateMock.mock.calls[0][0].data.attachments[0]
    expect(sent.media).toBe(5)
    expect(sent.caption).toBe('From Nimue')
  })

  it('unwraps a populated media object to its numeric id', async () => {
    const createMock = vi.fn().mockResolvedValue(SAVED_MESSAGE)
    const updateMock = vi.fn().mockResolvedValue({ ...SAVED_MESSAGE, attachments: [{ media: 7 }] })
    const req = makeReq(
      { id: 1, roles: ['admin'] },
      { ...VALID_BODY, attachments: [{ media: { id: '7', filename: 'a.jpg' } }] },
      { create: createMock, update: updateMock },
    )
    await chatSendHandler(req)
    expect(updateMock.mock.calls[0][0].data.attachments[0].media).toBe(7)
  })

  it('returns 500 when message creation fails', async () => {
    const req = makeReq({ id: 1, roles: ['admin'] }, VALID_BODY, {
      create: vi.fn().mockRejectedValue(new Error('DB write failed')),
    })
    const res = await chatSendHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toMatch(/failed to create message/i)
  })
})
