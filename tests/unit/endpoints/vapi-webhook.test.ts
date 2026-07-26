/**
 * Vapi Webhook Endpoint — Unit Tests
 *
 * POST /api/vapi/webhook
 * Receives voice AI events from Vapi. Routes by event type.
 * Also tests exported utility functions: matchTenantByName, resolveTenantFromConversation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLeoProcessMessage = vi.hoisted(() => vi.fn().mockResolvedValue({ response: 'ok' }))
const mockCreateVoiceCallContent = vi.hoisted(() => vi.fn().mockReturnValue({ root: {} }))

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: mockLeoProcessMessage,
}))
vi.mock('@/utilities/messageContent', () => ({
  createVoiceCallContent: mockCreateVoiceCallContent,
}))

import {
  vapiWebhookHandler,
  matchTenantByName,
  resolveTenantFromConversation,
} from '@/endpoints/vapi-webhook'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    ...overrides,
  }
}

function makeReq(
  body: Record<string, unknown> | null = { message: { type: 'status-update' } },
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, string> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...headerOverrides }
  const nativeReq = new Request('http://localhost/api/vapi/webhook', {
    method: 'POST',
    headers,
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { payload }) as any
}

function withSecret(secret: string, incoming: string | null = secret) {
  const origEnv = process.env.VAPI_WEBHOOK_SECRET
  process.env.VAPI_WEBHOOK_SECRET = secret
  return {
    headers: incoming !== null ? { 'x-vapi-secret': incoming } : {},
    restore: () => {
      if (origEnv === undefined) delete process.env.VAPI_WEBHOOK_SECRET
      else process.env.VAPI_WEBHOOK_SECRET = origEnv
    },
  }
}

// ── Tests: vapiWebhookHandler ──────────────────────────────────────────────────

describe('vapiWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VAPI_WEBHOOK_SECRET
  })

  // ── Secret validation ──────────────────────────────────────────────────────

  it('returns 401 when VAPI_WEBHOOK_SECRET is set and header is wrong', async () => {
    const { restore } = withSecret('correct-secret', 'wrong-secret')
    process.env.VAPI_WEBHOOK_SECRET = 'correct-secret'
    const req = makeReq(
      { message: { type: 'status-update' } },
      {},
      { 'x-vapi-secret': 'wrong-secret' },
    )
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/unauthorized/i)
    restore()
  })

  it('accepts request when secret matches', async () => {
    process.env.VAPI_WEBHOOK_SECRET = 'my-secret'
    const req = makeReq(
      { message: { type: 'status-update' } },
      {},
      { 'x-vapi-secret': 'my-secret' },
    )
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    delete process.env.VAPI_WEBHOOK_SECRET
  })

  // ── Body parsing ───────────────────────────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when message field is missing', async () => {
    const req = makeReq({ otherField: 'value' })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message\.type/i)
  })

  it('returns 400 when message.type is missing', async () => {
    const req = makeReq({ message: { call: {} } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message\.type/i)
  })

  // ── Event routing ──────────────────────────────────────────────────────────

  it('returns 200 for status-update event', async () => {
    const req = makeReq({ message: { type: 'status-update' } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 for transcript event', async () => {
    const req = makeReq({ message: { type: 'transcript' } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 for speech-update event', async () => {
    const req = makeReq({ message: { type: 'speech-update' } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 for hang event', async () => {
    const req = makeReq({ message: { type: 'hang' } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 for unknown event type', async () => {
    const req = makeReq({ message: { type: 'some-future-event' } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 200 for assistant-request and includes assistant config', async () => {
    const req = makeReq({ message: { type: 'assistant-request', call: {} } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assistant).toBeDefined()
    expect(body.assistant.name).toBe('LEO')
  })

  it('returns 200 for function-call with no functionCall field', async () => {
    const req = makeReq({ message: { type: 'function-call' } })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toMatch(/no function call/i)
  })

  it('returns 200 for end-of-call-report event', async () => {
    const req = makeReq({
      message: {
        type: 'end-of-call-report',
        call: {},
        artifact: { transcript: 'Hello', messages: [] },
        endedReason: 'customer-ended-call',
      },
    })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 200 for conversation-update event', async () => {
    const req = makeReq({
      message: {
        type: 'conversation-update',
        call: {},
        conversation: [{ role: 'user', content: 'hello' }],
      },
    })
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  // This used to force a TypeError by passing phoneNumber.number as a JS number.
  // The handler type-guards that now, so the test was asserting an accident, not
  // a contract. What actually matters on a voice webhook: a dead DB must still
  // produce a well-formed answer — a thrown handler is dead air on a live call.
  it('answers with valid JSON, never a throw, when the DB is down', async () => {
    const req = makeReq(
      { message: { type: 'assistant-request', call: { phoneNumber: { number: '+15555550100' } } } },
      { find: vi.fn().mockRejectedValue(new Error('DB down')) },
    )
    const res = await vapiWebhookHandler(req)
    expect(res.status).toBeLessThan(600)
    await expect(res.json()).resolves.toBeTypeOf('object')
  })
})

// ── Tests: matchTenantByName ───────────────────────────────────────────────────

describe('matchTenantByName', () => {
  const TENANTS = [
    { id: 1, name: 'Clearwater Coffee', slug: 'clearwater-coffee', type: 'enterprise', branding: { siteName: 'Clearwater Café' } },
    { id: 2, name: 'Hays Cactus Farm', slug: 'hays-cactus', type: 'enterprise', branding: {} },
    { id: 3, name: 'Platform Ops', slug: 'platform', type: 'platform', branding: {} },
  ]

  it('returns null for empty speech', () => {
    expect(matchTenantByName('', TENANTS)).toBeNull()
  })

  it('returns null when tenants list is empty', () => {
    expect(matchTenantByName('clearwater', [])).toBeNull()
  })

  it('matches by siteName (score 100)', () => {
    const result = matchTenantByName('i want to call clearwater café please', TENANTS)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
  })

  it('matches by tenant name (score 90)', () => {
    // "Hays Cactus Farm" — branding has no siteName, matches tenant name
    const result = matchTenantByName('calling hays cactus farm about an order', TENANTS)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(2)
  })

  it('matches by slug with hyphens replaced by spaces (score 80)', () => {
    // slug "hays-cactus" → "hays cactus"
    const result = matchTenantByName('i am trying to reach hays cactus', TENANTS)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(2)
  })

  it('skips platform type tenants', () => {
    // Platform Ops is type=platform — should never match
    const result = matchTenantByName('platform ops support please', TENANTS)
    expect(result).toBeNull()
  })

  it('returns null when no confident match is found', () => {
    const result = matchTenantByName('i want to order a pizza', TENANTS)
    expect(result).toBeNull()
  })

  it('partial word match — all significant words in speech', () => {
    // "clearwater coffee" → words ["clearwater", "coffee"] → all in speech
    const result = matchTenantByName('i would like clearwater coffee please', TENANTS)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
  })

  it('prefers higher-score match when multiple tenants match', () => {
    const tenants = [
      { id: 10, name: 'Coffee Co', slug: 'coffee-co', type: 'enterprise', branding: { siteName: 'clearwater' } },
      { id: 11, name: 'clearwater', slug: 'other', type: 'enterprise', branding: {} },
    ]
    // siteName exact match for id=10 wins over name match for id=11
    const result = matchTenantByName('clearwater', tenants)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(10)
  })
})

// ── Tests: resolveTenantFromConversation ──────────────────────────────────────

describe('resolveTenantFromConversation', () => {
  // Advance fake time by >TENANT_CACHE_TTL (60s) before each test so the
  // module-level tenantCache always appears stale and triggers a fresh fetch.
  let fakeTimeMs = new Date('2099-01-01').getTime()

  beforeEach(() => {
    vi.clearAllMocks()
    fakeTimeMs += 120_000 // each test is 120s further than the previous loadedAt
    vi.useFakeTimers()
    vi.setSystemTime(fakeTimeMs)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when conversation is empty', async () => {
    const payload = makePayload({
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const message = { conversation: [] }
    const result = await resolveTenantFromConversation(message, payload)
    expect(result).toBeNull()
  })

  it('returns null when conversation has no user messages', async () => {
    const payload = makePayload({
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const message = {
      conversation: [
        { role: 'assistant', content: 'Hello, which business are you calling?' },
      ],
    }
    const result = await resolveTenantFromConversation(message, payload)
    expect(result).toBeNull()
  })

  it('matches tenant from user speech in conversation', async () => {
    const fakeTenant = { id: 42, name: 'Clearwater Coffee', slug: 'clearwater', type: 'enterprise', branding: {} }
    const payload = makePayload({
      find: vi.fn().mockResolvedValue({ docs: [fakeTenant], totalDocs: 1 }),
    })
    const message = {
      conversation: [{ role: 'user', content: 'clearwater coffee' }],
    }
    const result = await resolveTenantFromConversation(message, payload)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(42)
  })

  it('returns dedicated-number tenant when call.phoneNumber matches', async () => {
    const fakeTenant = { id: 7, name: 'Hays Cactus', slug: 'hays-cactus', type: 'enterprise', branding: {}, vapi: { enabled: true, phoneNumber: '+15555550200' } }
    const payload = makePayload({
      find: vi.fn().mockResolvedValue({ docs: [fakeTenant], totalDocs: 1 }),
    })
    const message = {
      call: { phoneNumber: { number: '+1 555-555-0200' } },
      conversation: [],
    }
    const result = await resolveTenantFromConversation(message, payload)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(7)
  })
})
