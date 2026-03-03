/**
 * AI Bus Stream Endpoint — Unit Tests
 *
 * GET /api/ai-bus/stream
 * Auth required. Returns SSE stream (text/event-stream) for real-time AI Bus messages.
 * Also tests broadcastToSubscribers utility function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { aiBusStreamHandler, broadcastToSubscribers } from '@/endpoints/ai-bus-stream'

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    ...overrides,
  }
}

function makeReq(
  url: string = 'http://localhost/api/ai-bus/stream',
  user: Record<string, unknown> | null = { id: 10, tenants: [{ tenant: { id: 5 } }] },
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, string> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...headerOverrides }
  const nativeReq = new Request(url, { method: 'GET', headers })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('aiBusStreamHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const req = makeReq('http://localhost/api/ai-bus/stream', null)
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when tenant cannot be resolved', async () => {
    // User with neither tenants array nor servesTenant
    const req = makeReq('http://localhost/api/ai-bus/stream', { id: 10 })
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns SSE response with correct headers for authenticated user', async () => {
    const req = makeReq()
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/)
    expect(res.headers.get('Cache-Control')).toMatch(/no-cache/)
    expect(res.headers.get('Connection')).toBe('keep-alive')
  })

  it('resolves tenant from servesTenant scalar value', async () => {
    const user = { id: 10, servesTenant: 42 }
    const req = makeReq('http://localhost/api/ai-bus/stream', user)
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(200)
  })

  it('resolves tenant from servesTenant object', async () => {
    const user = { id: 10, servesTenant: { id: 55 } }
    const req = makeReq('http://localhost/api/ai-bus/stream', user)
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(200)
  })

  it('resolves tenant via x-tenant-id header fallback', async () => {
    const user = { id: 10 } // no tenants, no servesTenant
    const findMock = vi.fn().mockResolvedValue({ docs: [{ id: 7 }], totalDocs: 1 })
    const req = makeReq(
      'http://localhost/api/ai-bus/stream',
      user,
      { find: findMock },
      { 'x-tenant-id': 'tenant-slug-abc' },
    )
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(200)
    // Tenant lookup was triggered by header
    expect(findMock).toHaveBeenCalledOnce()
    expect(findMock.mock.calls[0][0].collection).toBe('tenants')
  })

  it('sends connected event as first SSE frame', async () => {
    const req = makeReq()
    const res = await aiBusStreamHandler(req)
    expect(res.body).not.toBeNull()

    // Read first chunk from the stream
    const reader = res.body!.getReader()
    const { value, done } = await reader.read()
    reader.cancel()

    expect(done).toBe(false)
    const text = new TextDecoder().decode(value)
    expect(text).toContain('event: connected')
    expect(text).toContain('tenantId')
  })

  it('accepts spaceId and channel query params', async () => {
    const url = 'http://localhost/api/ai-bus/stream?spaceId=3&channel=announcements'
    const req = makeReq(url)
    const res = await aiBusStreamHandler(req)
    expect(res.status).toBe(200)

    // Read the connected frame to confirm filtering params are passed
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    reader.cancel()

    const text = new TextDecoder().decode(value)
    const data = JSON.parse(text.split('data: ')[1])
    expect(data.spaceId).toBe(3)
    expect(data.channel).toBe('announcements')
  })
})

// ── broadcastToSubscribers ─────────────────────────────────────────────────────

describe('broadcastToSubscribers', () => {
  it('is exported as a function', () => {
    expect(typeof broadcastToSubscribers).toBe('function')
  })

  it('does not throw when no subscribers are connected', () => {
    // Should silently handle empty subscriber set
    expect(() => {
      broadcastToSubscribers({
        id: 99,
        space: 1,
        channel: 'general',
        tenant: 5,
      })
    }).not.toThrow()
  })
})
