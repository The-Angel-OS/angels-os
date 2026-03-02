import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

const mockRunProbe = vi.fn()

vi.mock('@/utilities/connectorProbes', () => ({
  runProbe: (...args: unknown[]) => mockRunProbe(...args),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(),
  logCaughtError: vi.fn(),
}))

import { connectorHealthCronHandler } from '@/endpoints/connector-health-cron'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'

// ── Helpers ───────────────────────────────────────────────────

function makePayload(connectors: Record<string, unknown>[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs: connectors }),
    update: vi.fn().mockResolvedValue({}),
  }
}

function makeReq(payload: unknown, cronSecret?: string) {
  const headers = new Headers()
  if (cronSecret) {
    headers.set('authorization', `Bearer ${cronSecret}`)
  }

  const request = new Request('http://localhost/api/connectors/health', {
    method: 'GET',
    headers,
  })

  return Object.assign(request, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────

describe('connectorHealthCronHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunProbe.mockResolvedValue({ ok: true, message: 'Connected' })
    // Clear any CRON_SECRET from env
    delete process.env.CRON_SECRET
  })

  it('rejects requests without valid CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const payload = makePayload()
    const req = makeReq(payload, 'wrong-secret')

    const res = await connectorHealthCronHandler(req)
    expect(res.status).toBe(401)
  })

  it('allows requests when CRON_SECRET matches', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const connectors = [
      { id: 'c1', name: 'WhatsApp Main', type: 'whatsapp', enabled: true, config: { phoneNumberId: '123' } },
    ]
    const payload = makePayload(connectors)
    const req = makeReq(payload, 'test-secret')

    const res = await connectorHealthCronHandler(req)
    expect(res.status).toBe(200)
  })

  it('allows requests when no CRON_SECRET is configured', async () => {
    const payload = makePayload([])
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    expect(res.status).toBe(200)
  })

  it('probes all enabled connectors and returns summary', async () => {
    const connectors = [
      { id: 'c1', name: 'WhatsApp Main', type: 'whatsapp', enabled: true, config: {} },
      { id: 'c2', name: 'Slack Bot', type: 'slack', enabled: true, config: {} },
      { id: 'c3', name: 'Discord Bot', type: 'discord', enabled: true, config: {} },
    ]
    const payload = makePayload(connectors)
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    const data = await res.json()

    expect(data.checked).toBe(3)
    expect(data.healthy).toBe(3)
    expect(data.failed).toBe(0)
    expect(data.results).toHaveLength(3)
    expect(mockRunProbe).toHaveBeenCalledTimes(3)
  })

  it('marks healthy connectors as active', async () => {
    mockRunProbe.mockResolvedValue({ ok: true, message: 'Connected: @testbot' })

    const connectors = [{ id: 'c1', name: 'Telegram', type: 'telegram', enabled: true, config: {} }]
    const payload = makePayload(connectors)
    const req = makeReq(payload)

    await connectorHealthCronHandler(req)

    expect(markConnectorActive).toHaveBeenCalledWith(payload, 'c1')
    expect(markConnectorError).not.toHaveBeenCalled()
  })

  it('marks failed connectors with error', async () => {
    mockRunProbe.mockResolvedValue({ ok: false, message: 'Missing botToken' })

    const connectors = [{ id: 'c1', name: 'Broken Bot', type: 'discord', enabled: true, config: {} }]
    const payload = makePayload(connectors)
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    const data = await res.json()

    expect(data.failed).toBe(1)
    expect(data.healthy).toBe(0)
    expect(markConnectorError).toHaveBeenCalledWith(payload, 'c1', 'Missing botToken')
  })

  it('handles mixed healthy and unhealthy connectors', async () => {
    mockRunProbe
      .mockResolvedValueOnce({ ok: true, message: 'Connected' })
      .mockResolvedValueOnce({ ok: false, message: 'API error' })
      .mockResolvedValueOnce({ ok: true, message: 'Connected' })

    const connectors = [
      { id: 'c1', name: 'Healthy', type: 'whatsapp', enabled: true, config: {} },
      { id: 'c2', name: 'Broken', type: 'slack', enabled: true, config: {} },
      { id: 'c3', name: 'Also Healthy', type: 'telegram', enabled: true, config: {} },
    ]
    const payload = makePayload(connectors)
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    const data = await res.json()

    expect(data.checked).toBe(3)
    expect(data.healthy).toBe(2)
    expect(data.failed).toBe(1)
  })

  it('handles probe exceptions gracefully', async () => {
    mockRunProbe.mockRejectedValue(new Error('Network timeout'))

    const connectors = [{ id: 'c1', name: 'Flaky', type: 'sms', enabled: true, config: {} }]
    const payload = makePayload(connectors)
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    const data = await res.json()

    expect(data.checked).toBe(1)
    expect(data.failed).toBe(1)
    expect(data.results[0].ok).toBe(false)
    expect(data.results[0].message).toBe('Network timeout')
  })

  it('returns empty results when no connectors exist', async () => {
    const payload = makePayload([])
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    const data = await res.json()

    expect(data.checked).toBe(0)
    expect(data.healthy).toBe(0)
    expect(data.failed).toBe(0)
    expect(data.results).toHaveLength(0)
  })

  it('includes latencyMs in each result', async () => {
    const connectors = [{ id: 'c1', name: 'Test', type: 'whatsapp', enabled: true, config: {} }]
    const payload = makePayload(connectors)
    const req = makeReq(payload)

    const res = await connectorHealthCronHandler(req)
    const data = await res.json()

    expect(data.results[0]).toHaveProperty('latencyMs')
    expect(typeof data.results[0].latencyMs).toBe('number')
  })
})
