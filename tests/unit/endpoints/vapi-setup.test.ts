import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Global fetch mock ─────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Module under test ─────────────────────────────────────────────────────────

import { vapiSetupHandler } from '@/endpoints/vapi-setup'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(user: Record<string, unknown> | null = { id: 1, roles: ['super_admin'] }) {
  return { user, payload: {} } as any
}

function vapiSuccessResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'phone-123',
    number: '+17274408797',
    provider: 'twilio',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('vapiSetupHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: all env vars set
    vi.stubEnv('VAPI_PRIVATE_KEY', 'test-vapi-key')
    vi.stubEnv('VAPI_PHONE_NUMBER_ID', 'phone-id-123')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://spacesangels.com')
  })

  // ── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when no user is authenticated', async () => {
    const res = await vapiSetupHandler(makeReq(null))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 403 when user lacks super_admin role', async () => {
    const res = await vapiSetupHandler(makeReq({ id: 1, roles: ['tenant_admin'] }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/super admin/i)
  })

  it('returns 403 for a user with no roles', async () => {
    const res = await vapiSetupHandler(makeReq({ id: 1, roles: [] }))
    expect(res.status).toBe(403)
  })

  // ── Environment variable checks ───────────────────────────────────────────

  it('returns 500 when VAPI_PRIVATE_KEY is not set', async () => {
    vi.stubEnv('VAPI_PRIVATE_KEY', '')
    const res = await vapiSetupHandler(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/VAPI_PRIVATE_KEY/i)
  })

  it('returns 500 when VAPI_PHONE_NUMBER_ID is not set', async () => {
    vi.stubEnv('VAPI_PHONE_NUMBER_ID', '')
    const res = await vapiSetupHandler(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/VAPI_PHONE_NUMBER_ID/i)
  })

  // ── Vapi API interaction ──────────────────────────────────────────────────

  it('returns 502 when Vapi API returns a non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('{"error": "invalid phone number id"}'),
    })
    const res = await vapiSetupHandler(makeReq())
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/422/i)
  })

  it('returns 200 with success payload on successful Vapi API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse()),
    })
    const res = await vapiSetupHandler(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.phoneNumberId).toBe('phone-id-123')
    expect(body.webhookUrl).toContain('/api/vapi/webhook')
    expect(body.webhookUrl).toContain('spacesangels.com')
  })

  it('includes the Vapi response fields in the success payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse({ id: 'pn-abc', number: '+10001112222', provider: 'vonage' })),
    })
    const res = await vapiSetupHandler(makeReq())
    const body = await res.json()
    expect(body.vapiResponse.id).toBe('pn-abc')
    expect(body.vapiResponse.number).toBe('+10001112222')
    expect(body.vapiResponse.provider).toBe('vonage')
  })

  it('sends a PATCH request to the correct Vapi endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse()),
    })
    await vapiSetupHandler(makeReq())
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('api.vapi.ai/phone-number/phone-id-123')
    expect(options.method).toBe('PATCH')
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-vapi-key',
    })
  })

  it('includes null assistant/squad overrides in the PATCH body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse()),
    })
    await vapiSetupHandler(makeReq())
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const patchBody = JSON.parse(options.body as string)
    expect(patchBody.assistantId).toBeNull()
    expect(patchBody.squadId).toBeNull()
  })

  it('does not include secret when VAPI_WEBHOOK_SECRET is not set', async () => {
    vi.stubEnv('VAPI_WEBHOOK_SECRET', '')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse()),
    })
    const res = await vapiSetupHandler(makeReq())
    const body = await res.json()
    expect(body.hasSecret).toBe(false)
    // Check the PATCH body also has no secret
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const patchBody = JSON.parse(options.body as string)
    expect(patchBody.server.secret).toBeUndefined()
  })

  it('includes secret in the server config when VAPI_WEBHOOK_SECRET is set', async () => {
    vi.stubEnv('VAPI_WEBHOOK_SECRET', 'my-webhook-secret')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse()),
    })
    const res = await vapiSetupHandler(makeReq())
    const body = await res.json()
    expect(body.hasSecret).toBe(true)
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const patchBody = JSON.parse(options.body as string)
    expect(patchBody.server.secret).toBe('my-webhook-secret')
  })

  it('falls back to localhost URL when no server URL env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(vapiSuccessResponse()),
    })
    const res = await vapiSetupHandler(makeReq())
    const body = await res.json()
    expect(body.webhookUrl).toContain('localhost:3000')
  })

  it('returns 500 when the Vapi API fetch itself throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const res = await vapiSetupHandler(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/network error/i)
  })
})
