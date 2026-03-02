import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ── Mocks ─────────────────────────────────────────────────────

const mockLeoProcess = vi.fn().mockResolvedValue({
  text: 'Hi from LEO',
  agentName: 'LEO',
  conversationId: 'wa-15551234567',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: (...args: unknown[]) => mockLeoProcess(...args),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ id: 'ch-1', slug: 'wa-15551234567' }),
  findOrCreateGuestUser: vi.fn().mockResolvedValue({ id: 10, name: 'John', email: 'wa-15551234567@guests.angel-os.local', isNew: false }),
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
  isMessageDuplicate: vi.fn().mockResolvedValue(false),
  SOURCE_ENUM_MAP: { whatsapp: 'whatsapp' },
  MESSAGE_TYPE_MAP: { whatsapp: 'whatsapp_message' },
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue({ id: 'space-1', slug: 'dm' }),
}))

const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ messages: [{ id: 'wamid-123' }] }) })
vi.stubGlobal('fetch', mockFetch)

import { whatsappWebhookHandler } from '@/endpoints/whatsapp-webhook'
import { isMessageDuplicate } from '@/utilities/bridgeHelpers'

// ── Helpers ───────────────────────────────────────────────────

const APP_SECRET = 'test_whatsapp_secret'

function makeWhatsAppBody(overrides?: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: 'pn-123', display_phone_number: '+15550001234' },
          messages: [{
            id: 'wamid-abc',
            from: '15551234567',
            timestamp: '1700000000',
            type: 'text',
            text: { body: 'Hello from WhatsApp' },
            ...overrides,
          }],
          contacts: [{ profile: { name: 'John Doe' }, wa_id: '15551234567' }],
        },
        field: 'messages',
      }],
    }],
  }
}

function signBody(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

function makePayload(connectors: Record<string, unknown>[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs: connectors }),
    findByID: vi.fn().mockResolvedValue(connectors[0] ?? null),
    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update: vi.fn().mockResolvedValue({}),
  }
}

function makeReq(body: Record<string, unknown>, payload: unknown, secret = APP_SECRET) {
  const rawBody = JSON.stringify(body)
  const signature = signBody(rawBody, secret)

  const request = new Request('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body: rawBody,
  })

  return Object.assign(request, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────

describe('whatsappWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WHATSAPP_APP_SECRET = APP_SECRET
  })

  it('returns 200 for valid message with correct signature', async () => {
    const connector = {
      id: 'conn-wa-1',
      type: 'whatsapp',
      enabled: true,
      status: 'active',
      config: { phoneNumberId: 'pn-123', accessToken: 'token-abc' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeWhatsAppBody(), payload)

    const res = await whatsappWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  it('always returns 200 (Meta requires it)', async () => {
    // Even with no matching connector, Meta expects 200
    const payload = makePayload([])
    const body = makeWhatsAppBody()
    const req = makeReq(body, payload)

    const res = await whatsappWebhookHandler(req)
    expect(res.status).toBe(200)
  })

  it('skips duplicate messages', async () => {
    vi.mocked(isMessageDuplicate).mockResolvedValueOnce(true)

    const connector = {
      id: 'conn-wa-1',
      type: 'whatsapp',
      enabled: true,
      status: 'active',
      config: { phoneNumberId: 'pn-123', accessToken: 'token-abc' },
      tenant: 1,
    }
    const payload = makePayload([connector])
    const req = makeReq(makeWhatsAppBody(), payload)

    const res = await whatsappWebhookHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })

  it('handles non-message changes gracefully', async () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'pn-123' },
            statuses: [{ id: 'status-1', status: 'delivered' }],
          },
          field: 'messages',
        }],
      }],
    }
    const payload = makePayload([])
    const req = makeReq(body, payload)

    const res = await whatsappWebhookHandler(req)
    expect(res.status).toBe(200)
  })
})
