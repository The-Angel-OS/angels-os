import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

const mockLeoProcess = vi.fn().mockResolvedValue({
  text: 'Hi from LEO',
  agentName: 'LEO',
  conversationId: 'sms-15551234567',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: (...args: unknown[]) => mockLeoProcess(...args),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ id: 'ch-1', slug: 'sms-15551234567' }),
  findOrCreateGuestUser: vi.fn().mockResolvedValue({ id: 10, name: '+15551234567', email: 'sms-15551234567@guests.angel-os.local', isNew: false }),
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
  isMessageDuplicate: vi.fn().mockResolvedValue(false),
  SOURCE_ENUM_MAP: { sms: 'sms' },
  MESSAGE_TYPE_MAP: { sms: 'sms_message' },
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue({ id: 'space-1', slug: 'dm' }),
}))

vi.mock('@/utilities/resolveConnector', () => ({
  findAllConnectors: vi.fn().mockResolvedValue([{
    id: 'conn-sms-1',
    config: { phoneNumber: '+15559876543', accountSid: 'AC123', authToken: 'auth-tok' },
  }]),
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logCaughtError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/messageContent', () => ({
  wrapTextContent: vi.fn((text: string) => text),
}))

import { smsWebhookHandler } from '@/endpoints/sms-webhook'
import { isMessageDuplicate } from '@/utilities/bridgeHelpers'

// ── Helpers ───────────────────────────────────────────────────

function makeSmsFormBody(overrides?: Record<string, string>) {
  const params = new URLSearchParams({
    MessageSid: 'SM123abc',
    AccountSid: 'AC123',
    From: '+15551234567',
    To: '+15559876543',
    Body: 'Hello via SMS',
    NumMedia: '0',
    ...overrides,
  })
  return params.toString()
}

function makePayload(connectors: Record<string, unknown>[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs: connectors }),
    findByID: vi.fn().mockResolvedValue(connectors[0] ?? null),
    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update: vi.fn().mockResolvedValue({}),
  }
}

function makeReq(body: string, payload: unknown) {
  // Don't send x-twilio-signature — avoids signature verification
  // in unit tests (separate integration test concern)
  const request = new Request('http://localhost/api/sms/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  return Object.assign(request, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────

describe('smsWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns TwiML response for valid message', async () => {
    const connector = {
      id: 'conn-sms-1',
      type: 'sms',
      enabled: true,
      status: 'active',
      config: { accountSid: 'AC123', authToken: 'auth-tok', phoneNumber: '+15559876543' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeSmsFormBody(), payload)

    const res = await smsWebhookHandler(req)
    expect(res.status).toBe(200)

    const text = await res.text()
    // TwiML response should contain XML
    expect(text).toContain('Response')
  })

  it('processes message and calls leoProcessMessage', async () => {
    const connector = {
      id: 'conn-sms-1',
      type: 'sms',
      enabled: true,
      status: 'active',
      config: { accountSid: 'AC123', authToken: 'auth-tok', phoneNumber: '+15559876543' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeSmsFormBody(), payload)

    await smsWebhookHandler(req)

    // LEO should have been called to process the message
    expect(mockLeoProcess).toHaveBeenCalled()
  })

  it('skips duplicate messages', async () => {
    vi.mocked(isMessageDuplicate).mockResolvedValueOnce(true)

    const connector = {
      id: 'conn-sms-1',
      type: 'sms',
      enabled: true,
      status: 'active',
      config: { accountSid: 'AC123', authToken: 'auth-tok', phoneNumber: '+15559876543' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeSmsFormBody(), payload)

    const res = await smsWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })

  it('handles empty body', async () => {
    const connector = {
      id: 'conn-sms-1',
      type: 'sms',
      enabled: true,
      config: { accountSid: 'AC123', authToken: 'auth-tok', phoneNumber: '+15559876543' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeSmsFormBody({ Body: '' }), payload)

    const res = await smsWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  it('handles media messages', async () => {
    const connector = {
      id: 'conn-sms-1',
      type: 'sms',
      enabled: true,
      status: 'active',
      config: { accountSid: 'AC123', authToken: 'auth-tok', phoneNumber: '+15559876543' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const body = makeSmsFormBody({
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/media/123.jpg',
      MediaContentType0: 'image/jpeg',
      Body: 'Check this photo',
    })
    const req = makeReq(body, payload)

    const res = await smsWebhookHandler(req)
    expect(res.status).toBe(200)
  })
})
