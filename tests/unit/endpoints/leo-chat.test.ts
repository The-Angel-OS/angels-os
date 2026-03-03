/**
 * LEO Chat Endpoint — Unit Tests
 *
 * POST /api/leo
 * Allows authenticated users AND guests (with x-leo-guest: true) to send messages to LEO.
 * Rate limited. Persists responses to the Messages collection when spaceId is provided.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockLeoProcessMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    text: 'Hello, I am LEO.',
    agentName: 'LEO',
    agentType: 'leo',
    conversationId: 'conv_abc123',
  }),
)
const mockWrapTextContent = vi.hoisted(() => vi.fn().mockReturnValue({ root: { children: [] } }))
const mockLeoSystemUserEmail = vi.hoisted(() => vi.fn().mockReturnValue('leo@clearwater.local'))
const mockLeoLegacyEmail = vi.hoisted(() => vi.fn().mockReturnValue('leo-legacy@clearwater.local'))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/leoProcessMessage', () => ({ leoProcessMessage: mockLeoProcessMessage }))
vi.mock('@/utilities/messageContent', () => ({ wrapTextContent: mockWrapTextContent }))
vi.mock('@/utilities/leoEmail', () => ({
  leoSystemUserEmail: mockLeoSystemUserEmail,
  leoLegacyEmail: mockLeoLegacyEmail,
}))

import { leoChatHandler } from '@/endpoints/leo-chat'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = { message: 'Hello LEO', spaceId: 5, channelSlug: 'general' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants') return Promise.resolve({ docs: [{ id: 10 }], totalDocs: 1 })
      if (collection === 'users') return Promise.resolve({ docs: [{ id: 99 }], totalDocs: 1 })
      return Promise.resolve({ docs: [], totalDocs: 0 })
    }),
    create: vi.fn().mockResolvedValue({ id: 200 }),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, email: 'user@test.com', roles: ['member'] },
  body: Record<string, unknown> | null = VALID_BODY,
  headerOverrides: Record<string, string> = {},
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': 'clearwater',
    ...headerOverrides,
  }
  const nativeReq = new Request('http://localhost/api/leo', {
    method: 'POST',
    headers,
    body: body !== null ? JSON.stringify(body) : 'INVALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('leoChatHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockLeoProcessMessage.mockResolvedValue({
      text: 'Hello, I am LEO.',
      agentName: 'LEO',
      agentType: 'leo',
      conversationId: 'conv_abc123',
    })
    mockWrapTextContent.mockReturnValue({ root: { children: [] } })
    process.env.DEFAULT_TENANT_SLUG = 'clearwater'
  })

  it('returns 401 when no user and no x-leo-guest header', async () => {
    const req = makeReq(null, VALID_BODY)
    const res = await leoChatHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/unauthorized/i)
  })

  it('allows guest access when x-leo-guest: true header is set', async () => {
    const req = makeReq(null, VALID_BODY, { 'x-leo-guest': 'true' })
    const res = await leoChatHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const req = makeReq()
    const res = await leoChatHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com' }, null)
    const res = await leoChatHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/invalid json/i)
  })

  it('returns 400 when message is missing', async () => {
    const req = makeReq({ id: 1 }, { spaceId: 5 })
    const res = await leoChatHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/missing or empty.*message/i)
  })

  it('returns 400 when message is empty string', async () => {
    const req = makeReq({ id: 1 }, { message: '   ' })
    const res = await leoChatHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with LEO response fields for authenticated user', async () => {
    const req = makeReq()
    const res = await leoChatHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.text).toBe('Hello, I am LEO.')
    expect(body.agentName).toBe('LEO')
    expect(body.agentType).toBe('leo')
    expect(body.conversationId).toBe('conv_abc123')
    expect(body.isGuest).toBe(false)
  })

  it('includes guestCta in response for guest users', async () => {
    const req = makeReq(null, VALID_BODY, { 'x-leo-guest': 'true' })
    const res = await leoChatHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isGuest).toBe(true)
    expect(body.guestCta).toBeTruthy()
    expect(typeof body.guestCta).toBe('string')
  })

  it('calls leoProcessMessage with correct context', async () => {
    const req = makeReq({ id: 1, email: 'user@test.com', roles: ['admin'] }, VALID_BODY)
    await leoChatHandler(req)
    expect(mockLeoProcessMessage).toHaveBeenCalledOnce()
    const args = mockLeoProcessMessage.mock.calls[0][0]
    expect(args.message).toBe('Hello LEO')
    expect(args.spaceId).toBe(5)
  })

  it('persists LEO response when spaceId is provided and user is authenticated', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 200 })
    const req = makeReq({ id: 1, email: 'user@test.com' }, VALID_BODY, {}, { create: createMock })
    const res = await leoChatHandler(req)
    expect(res.status).toBe(200)
    expect(createMock).toHaveBeenCalledOnce()
    const createArgs = createMock.mock.calls[0][0]
    expect(createArgs.collection).toBe('messages')
    expect(createArgs.data.space).toBe(5)
  })

  it('does not persist response for guest users even with spaceId', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 200 })
    const req = makeReq(null, VALID_BODY, { 'x-leo-guest': 'true' }, { create: createMock })
    await leoChatHandler(req)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('does not persist response when no spaceId', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 200 })
    const req = makeReq({ id: 1 }, { message: 'Hello' }, {}, { create: createMock })
    await leoChatHandler(req)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns 500 when leoProcessMessage throws', async () => {
    mockLeoProcessMessage.mockRejectedValue(new Error('LLM backend unavailable'))
    const req = makeReq()
    const res = await leoChatHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.agentName).toBe('LEO')
    expect(body.error).toMatch(/llm backend unavailable/i)
  })
})
