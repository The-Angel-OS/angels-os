import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

const mockLeoProcess = vi.fn().mockResolvedValue({
  text: 'Hi from LEO',
  agentName: 'LEO',
  conversationId: 'webhook-user123',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: (...args: unknown[]) => mockLeoProcess(...args),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ id: 'ch-1', slug: 'webhook-user123' }),
  findOrCreateGuestUser: vi.fn().mockResolvedValue({ id: 10, name: 'User', email: 'webhook-user123@guests.angel-os.local', isNew: false }),
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
  getMessageType: vi.fn((source: string) => source === 'sms' ? 'sms_message' : 'user'),
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue(1),
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logCaughtError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/messageContent', () => ({
  wrapTextContent: vi.fn((text: string) => text),
}))

import { bridgeInboundHandler } from '@/endpoints/bridge-inbound'

// ── Helpers ───────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>, payload: unknown, headers?: Record<string, string>) {
  const request = new Request('http://localhost/api/bridge/inbound', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
  return Object.assign(request, { payload }) as any
}

function makePayload(connector?: Record<string, unknown>) {
  return {
    find: vi.fn().mockResolvedValue({ docs: connector ? [connector] : [] }),
    findByID: vi.fn().mockResolvedValue(connector ?? null),
    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update: vi.fn().mockResolvedValue({}),
  }
}

// ── Tests ─────────────────────────────────────────────────────

describe('bridgeInboundHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/bridge/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })
    const payload = makePayload()
    const req = Object.assign(request, { payload }) as any

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing required fields', async () => {
    const payload = makePayload()
    const req = makeReq({ source: 'sms' }, payload) // Missing externalUserId, message, tenantId

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.message).toContain('Missing required fields')
  })

  it('returns 400 for invalid source enum', async () => {
    const payload = makePayload()
    const req = makeReq({
      source: 'instagram',
      externalUserId: 'user123',
      message: 'hello',
      tenantId: 1,
    }, payload)

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.message).toContain('Invalid source')
  })

  it('processes valid message through LEO', async () => {
    const payload = makePayload()
    const req = makeReq({
      source: 'webhook',
      externalUserId: 'user123',
      externalUserName: 'Test User',
      message: 'Hello from webhook',
      tenantId: 1,
    }, payload)

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.reply).toBe('Hi from LEO')
    expect(data.agentName).toBe('LEO')
    expect(mockLeoProcess).toHaveBeenCalled()
  })

  it('validates connector webhook secret', async () => {
    const connector = {
      id: 'conn-1',
      enabled: true,
      status: 'active',
      config: { webhookSecret: 'correct-secret' },
    }
    const payload = makePayload(connector)
    const req = makeReq({
      source: 'webhook',
      externalUserId: 'user123',
      message: 'hello',
      tenantId: 1,
      connectorId: 'conn-1',
    }, payload, { 'x-bridge-secret': 'wrong-secret' })

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(401)
  })

  it('accepts correct webhook secret and processes', async () => {
    const connector = {
      id: 'conn-1',
      enabled: true,
      status: 'active',
      config: { webhookSecret: 'correct-secret' },
    }
    const payload = makePayload(connector)
    const req = makeReq({
      source: 'webhook',
      externalUserId: 'user123',
      message: 'hello',
      tenantId: 1,
      connectorId: 'conn-1',
    }, payload, { 'x-bridge-secret': 'correct-secret' })

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(200)
    expect(mockLeoProcess).toHaveBeenCalled()
  })

  it('rejects disabled connector with 403', async () => {
    const connector = {
      id: 'conn-1',
      enabled: false,
      status: 'active',
      config: {},
    }
    const payload = makePayload(connector)
    const req = makeReq({
      source: 'webhook',
      externalUserId: 'user123',
      message: 'hello',
      tenantId: 1,
      connectorId: 'conn-1',
    }, payload)

    const res = await bridgeInboundHandler(req)
    expect(res.status).toBe(403)
  })
})
