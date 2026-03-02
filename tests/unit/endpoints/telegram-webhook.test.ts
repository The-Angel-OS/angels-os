import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

const mockLeoProcess = vi.fn().mockResolvedValue({
  text: 'Hi from LEO',
  agentName: 'LEO',
  conversationId: 'tg-12345',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: (...args: unknown[]) => mockLeoProcess(...args),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ id: 'ch-1', slug: 'tg-12345' }),
  findOrCreateGuestUser: vi.fn().mockResolvedValue({ id: 10, name: 'Alice', email: 'tg-12345@guests.angel-os.local', isNew: false }),
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
  isMessageDuplicate: vi.fn().mockResolvedValue(false),
  SOURCE_ENUM_MAP: { telegram: 'telegram' },
  MESSAGE_TYPE_MAP: { telegram: 'telegram_message' },
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue({ id: 'space-1', slug: 'dm' }),
}))

vi.mock('@/utilities/resolveConnector', () => ({
  findAllConnectors: vi.fn().mockResolvedValue([{
    id: 'conn-tg-1',
    config: { webhookSecret: 'tg-secret-123', botToken: 'bot123:ABC' },
  }]),
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logCaughtError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/messageContent', () => ({
  wrapTextContent: vi.fn((text: string) => text),
}))

const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
vi.stubGlobal('fetch', mockFetch)

import { telegramWebhookHandler } from '@/endpoints/telegram-webhook'
import { isMessageDuplicate } from '@/utilities/bridgeHelpers'

// ── Helpers ───────────────────────────────────────────────────

function makeTelegramUpdate(overrides?: Record<string, unknown>) {
  return {
    update_id: 100001,
    message: {
      message_id: 42,
      from: { id: 12345, is_bot: false, first_name: 'Alice', username: 'alice_test' },
      chat: { id: 12345, type: 'private' },
      date: 1700000000,
      text: 'Hello from Telegram',
      ...overrides,
    },
  }
}

function makePayload(connectors: Record<string, unknown>[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs: connectors }),
    findByID: vi.fn().mockResolvedValue(connectors[0] ?? null),
    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update: vi.fn().mockResolvedValue({}),
  }
}

function makeReq(body: Record<string, unknown>, payload: unknown, secretToken = 'tg-secret-123') {
  const request = new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secretToken,
    },
    body: JSON.stringify(body),
  })

  return Object.assign(request, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────

// The handler uses a module-level botIndex cache with 120s TTL.
// After processing, it deletes the entry (line 336). We advance
// Date.now() past the TTL between tests so the cache rebuilds.
let fakeNow = Date.now()

describe('telegramWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeNow += 200_000 // advance past 120s TTL
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)
  })

  it('returns 200 for valid text message', async () => {
    const connector = {
      id: 'conn-tg-1',
      type: 'telegram',
      enabled: true,
      status: 'active',
      config: { botToken: 'bot123:ABC', webhookSecret: 'tg-secret-123', botUsername: 'test_bot' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeTelegramUpdate(), payload)

    const res = await telegramWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  it('rejects requests with unrecognised secret', async () => {
    const connector = {
      id: 'conn-tg-1',
      type: 'telegram',
      enabled: true,
      config: { botToken: 'bot123:ABC', webhookSecret: 'tg-secret-123' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeTelegramUpdate(), payload, 'wrong-secret')

    const res = await telegramWebhookHandler(req)
    // Handler returns 404 when no connector matches the secret
    expect(res.status).toBe(404)
  })

  it('skips duplicate update_id messages', async () => {
    vi.mocked(isMessageDuplicate).mockResolvedValueOnce(true)

    const connector = {
      id: 'conn-tg-1',
      type: 'telegram',
      enabled: true,
      status: 'active',
      config: { botToken: 'bot123:ABC', webhookSecret: 'tg-secret-123' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeTelegramUpdate(), payload)

    const res = await telegramWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })

  it('handles updates without message field', async () => {
    const connector = {
      id: 'conn-tg-1',
      type: 'telegram',
      enabled: true,
      config: { botToken: 'bot123:ABC', webhookSecret: 'tg-secret-123' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const body = { update_id: 100002 } // No message
    const req = makeReq(body, payload)

    const res = await telegramWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })
})
