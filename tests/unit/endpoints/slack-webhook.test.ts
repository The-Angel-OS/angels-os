import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ── Mocks ─────────────────────────────────────────────────────

const mockLeoProcess = vi.fn().mockResolvedValue({
  text: 'Hi from LEO',
  agentName: 'LEO',
  conversationId: 'slack-U12345',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: (...args: unknown[]) => mockLeoProcess(...args),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ channelId: 'ch-1', isNew: false }),
  findOrCreateGuestUser: vi.fn().mockResolvedValue({ id: 10, name: 'Alice', email: 'slack-U12345@guests.angel-os.local', isNew: false }),
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
  isMessageDuplicate: vi.fn().mockResolvedValue(false),
  getChannelSource: vi.fn((s: string) => s),
  getMessageType: vi.fn((s: string) => `${s}_message`),
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue('space-1'),
}))

vi.mock('@/utilities/resolveConnector', () => ({
  findAllConnectors: vi.fn().mockResolvedValue([{
    id: 'conn-slack-1',
    type: 'slack',
    tenantId: '1',
    config: { botToken: 'xoxb-test-token', signingSecret: 'test-signing-secret' },
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

import { slackWebhookHandler } from '@/endpoints/slack-webhook'
import { isMessageDuplicate } from '@/utilities/bridgeHelpers'

// ── Helpers ───────────────────────────────────────────────────

const SIGNING_SECRET = 'test-signing-secret'

function signRequest(body: string, timestamp: number): string {
  const sigBasestring = `v0:${timestamp}:${body}`
  return 'v0=' + crypto.createHmac('sha256', SIGNING_SECRET).update(sigBasestring).digest('hex')
}

function makeSlackEvent(overrides?: Record<string, unknown>) {
  return {
    type: 'event_callback',
    event_id: 'Ev1234',
    event: {
      type: 'message',
      user: 'U12345',
      channel: 'C67890',
      text: 'Hello from Slack',
      ts: '1700000000.000100',
      ...overrides,
    },
  }
}

function makePayload() {
  return {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update: vi.fn().mockResolvedValue({}),
  }
}

function makeReq(body: Record<string, unknown>, payload: unknown, signingSecret = SIGNING_SECRET) {
  const rawBody = JSON.stringify(body)
  const timestamp = Math.floor(Date.now() / 1000)
  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const signature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')

  const request = new Request('http://localhost/api/slack/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-slack-request-timestamp': String(timestamp),
      'x-slack-signature': signature,
    },
    body: rawBody,
  })

  return Object.assign(request, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────

describe('slackWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('responds to url_verification challenge', async () => {
    const body = { type: 'url_verification', challenge: 'test-challenge-123' }
    const payload = makePayload()
    const req = makeReq(body, payload)

    const res = await slackWebhookHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.challenge).toBe('test-challenge-123')
  })

  it('returns 200 for valid message event', async () => {
    const payload = makePayload()
    const req = makeReq(makeSlackEvent(), payload)

    const res = await slackWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  it('calls leoProcessMessage for user messages', async () => {
    const payload = makePayload()
    const req = makeReq(makeSlackEvent(), payload)

    await slackWebhookHandler(req)

    expect(mockLeoProcess).toHaveBeenCalled()
  })

  it('rejects requests with invalid signature', async () => {
    const payload = makePayload()
    const req = makeReq(makeSlackEvent(), payload, 'wrong-secret')

    const res = await slackWebhookHandler(req)
    expect(res.status).toBe(401)
  })

  it('skips bot messages', async () => {
    const payload = makePayload()
    const req = makeReq(makeSlackEvent({ bot_id: 'B12345' }), payload)

    const res = await slackWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })

  it('skips duplicate events', async () => {
    vi.mocked(isMessageDuplicate).mockResolvedValueOnce(true)

    const payload = makePayload()
    const req = makeReq(makeSlackEvent(), payload)

    const res = await slackWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })

  it('handles non-message events gracefully', async () => {
    const body = {
      type: 'event_callback',
      event_id: 'Ev5678',
      event: { type: 'reaction_added', user: 'U12345', reaction: 'thumbsup' },
    }
    const payload = makePayload()
    const req = makeReq(body, payload)

    const res = await slackWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })

  it('sends reply via Slack chat.postMessage', async () => {
    const payload = makePayload()
    const req = makeReq(makeSlackEvent(), payload)

    await slackWebhookHandler(req)

    // fetch should be called for chat.postMessage
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer xoxb-test-token',
        }),
      }),
    )
  })
})
