/**
 * POST /api/capture — the public lead-capture endpoint.
 *
 * This is the only unauthenticated WRITE path in the system, so its defences
 * are the test: a required tenant, a honeypot, length caps, and idempotency by
 * email. The failure that costs money is the opposite one though — dropping a
 * lead — so the happy path is asserted just as hard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetchTenantBySlug = vi.hoisted(() => vi.fn())
vi.mock('@/utilities/fetchTenantBySlug', () => ({ fetchTenantBySlug: mockFetchTenantBySlug }))
vi.mock('@/utilities/logError', () => ({ logError: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: vi.fn().mockReturnValue(null) }))

import { captureHandler } from '@/endpoints/capture'

function makeReq(body: unknown, payloadOverrides: Record<string, unknown> = {}) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    ...payloadOverrides,
  }
  const req = new Request('http://localhost/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return Object.assign(req, { payload, user: null }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchTenantBySlug.mockResolvedValue({ id: 42, slug: 'kessela' })
})

describe('capture — the happy path', () => {
  it('creates a contact and records first-touch attribution', async () => {
    const req = makeReq({
      tenant: 'kessela',
      email: 'Buyer@Example.com',
      utmSource: 'youtube',
      utmMedium: 'cpc',
      utmCampaign: 'clearout',
      landingPage: '/offer',
      referrer: 'https://youtube.com/',
    })
    const res = await captureHandler(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true })

    const created = (req as unknown as { payload: { create: ReturnType<typeof vi.fn> } }).payload
      .create.mock.calls[0]![0]
    expect(created.collection).toBe('contacts')
    expect(created.data.tenant).toBe(42)
    expect(created.data.email).toBe('buyer@example.com') // normalised
    expect(created.data.attribution).toMatchObject({ source: 'youtube', campaign: 'clearout' })
    expect(created.req).toBeDefined() // writes JOIN the request's connection
  })

  it('is idempotent by email — a second submit updates, never duplicates', async () => {
    const req = makeReq(
      { tenant: 'kessela', email: 'buyer@example.com', name: 'Buyer' },
      { find: vi.fn().mockResolvedValue({ docs: [{ id: 7, tags: ['web-capture'] }] }) },
    )
    const res = await captureHandler(req)
    const p = (req as unknown as { payload: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } }).payload
    expect(res.status).toBe(200)
    expect(p.create).not.toHaveBeenCalled()
    expect(p.update).toHaveBeenCalledOnce()
  })
})

describe('capture — the defences', () => {
  it('answers 200 but writes NOTHING when the honeypot is filled', async () => {
    const req = makeReq({ tenant: 'kessela', email: 'bot@example.com', company: 'ACME' })
    const res = await captureHandler(req)
    // 200 on purpose: a bot must learn nothing from the response.
    expect(res.status).toBe(200)
    expect((req as unknown as { payload: { create: ReturnType<typeof vi.fn> } }).payload.create).not.toHaveBeenCalled()
  })

  it('rejects a missing tenant', async () => {
    const res = await captureHandler(makeReq({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
  })

  it('rejects an unknown tenant rather than writing to a guessed one', async () => {
    mockFetchTenantBySlug.mockResolvedValue(null)
    const res = await captureHandler(makeReq({ tenant: 'nope', email: 'a@b.com' }))
    expect(res.status).toBe(404)
  })

  it('requires an email or a phone', async () => {
    const res = await captureHandler(makeReq({ tenant: 'kessela' }))
    expect(res.status).toBe(400)
  })

  it('rejects a malformed email', async () => {
    const res = await captureHandler(makeReq({ tenant: 'kessela', email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('accepts phone-only — voice leads rarely spell out an email', async () => {
    const res = await captureHandler(makeReq({ tenant: 'kessela', phone: '+17275551234' }))
    expect(res.status).toBe(200)
  })

  it('caps field length so a body cannot be used as storage', async () => {
    const req = makeReq({ tenant: 'kessela', email: 'a@b.com', name: 'x'.repeat(5000) })
    await captureHandler(req)
    const created = (req as unknown as { payload: { create: ReturnType<typeof vi.fn> } }).payload
      .create.mock.calls[0]![0]
    expect(created.data.name.length).toBeLessThanOrEqual(200)
  })

  it('returns 400 on invalid JSON instead of throwing', async () => {
    const req = new Request('http://localhost/api/capture', { method: 'POST', body: 'not json{{' })
    const withPayload = Object.assign(req, { payload: {}, user: null }) as never
    const res = await captureHandler(withPayload)
    expect(res.status).toBe(400)
  })

  it('sets CORS headers — the widget calls this cross-origin', async () => {
    const res = await captureHandler(makeReq({ tenant: 'kessela', email: 'a@b.com' }))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
