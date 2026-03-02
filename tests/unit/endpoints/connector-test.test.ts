import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

vi.mock('@/utilities/bridgeHelpers', () => ({
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { connectorTestHandler } from '@/endpoints/connector-test'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'

// ── Helpers ───────────────────────────────────────────────────

function makeReq(body?: Record<string, unknown>, connector?: Record<string, unknown>) {
  const payload = {
    findByID: vi.fn().mockResolvedValue(connector ?? null),
  }

  const request = new Request('http://localhost/api/connectors/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  })

  return Object.assign(request, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────

describe('connectorTestHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if no connectorId', async () => {
    const req = makeReq({})
    const res = await connectorTestHandler(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.message).toContain('connectorId')
  })

  it('returns 404 if connector not found', async () => {
    const req = makeReq({ connectorId: 'missing-123' })
    req.payload.findByID.mockRejectedValue(new Error('Not found'))
    const res = await connectorTestHandler(req)
    expect(res.status).toBe(404)
  })

  it('probes WhatsApp connector successfully', async () => {
    const connector = {
      id: 'wa-1',
      type: 'whatsapp',
      config: { phoneNumberId: '1234', accessToken: 'abc' },
    }
    const req = makeReq({ connectorId: 'wa-1' }, connector)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ verified_name: 'Test Business' }),
    })

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(data.message).toContain('Test Business')
    expect(data.latencyMs).toBeTypeOf('number')
    expect(markConnectorActive).toHaveBeenCalledWith(expect.anything(), 'wa-1')
  })

  it('probes Telegram connector successfully', async () => {
    const connector = {
      id: 'tg-1',
      type: 'telegram',
      config: { botToken: '123:ABC' },
    }
    const req = makeReq({ connectorId: 'tg-1' }, connector)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { username: 'test_bot' } }),
    })

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(data.message).toContain('@test_bot')
  })

  it('probes SMS (Twilio) connector successfully', async () => {
    const connector = {
      id: 'sms-1',
      type: 'sms',
      config: { accountSid: 'AC123', authToken: 'tok' },
    }
    const req = makeReq({ connectorId: 'sms-1' }, connector)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ friendly_name: 'My Account' }),
    })

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(data.message).toContain('My Account')
  })

  it('probes Discord connector successfully', async () => {
    const connector = {
      id: 'dc-1',
      type: 'discord',
      config: { botToken: 'discord-token' },
    }
    const req = makeReq({ connectorId: 'dc-1' }, connector)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ username: 'angel_bot' }),
    })

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(data.message).toContain('angel_bot')
  })

  it('reports error when external API returns non-ok', async () => {
    const connector = {
      id: 'wa-fail',
      type: 'whatsapp',
      config: { phoneNumberId: '1234', accessToken: 'bad-token' },
    }
    const req = makeReq({ connectorId: 'wa-fail' }, connector)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('error')
    expect(data.message).toContain('401')
    expect(markConnectorError).toHaveBeenCalledWith(
      expect.anything(),
      'wa-fail',
      expect.stringContaining('401'),
    )
  })

  it('reports error for missing credentials', async () => {
    const connector = {
      id: 'tg-empty',
      type: 'telegram',
      config: {},
    }
    const req = makeReq({ connectorId: 'tg-empty' }, connector)

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('error')
    expect(data.message).toContain('Missing botToken')
  })

  it('returns ok for unknown connector types', async () => {
    const connector = {
      id: 'other-1',
      type: 'webhook',
      config: {},
    }
    const req = makeReq({ connectorId: 'other-1' }, connector)

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(data.message).toContain('No active probe')
  })

  it('returns ok for email_inbound (not implemented)', async () => {
    const connector = {
      id: 'imap-1',
      type: 'email_inbound',
      config: {},
    }
    const req = makeReq({ connectorId: 'imap-1' }, connector)

    const res = await connectorTestHandler(req)
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(data.message).toContain('IMAP')
  })
})
