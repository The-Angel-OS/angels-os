import { describe, it, expect, vi } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: () => 'https://spacesangels.com',
  getClientSideURL: () => 'https://spacesangels.com',
}))

// Mock jose — jwtVerify resolves for VALID_TOKEN and throws for INVALID_TOKEN
const VALID_TOKEN = 'valid.test.jwt'
const INVALID_TOKEN = 'bad.token.here'
const EXPIRED_TOKEN = 'expired.jwt.token'

vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockImplementation(async (token: string) => {
    if (token === VALID_TOKEN) return { payload: { sub: 'user-1' } }
    throw new Error('invalid or expired token')
  }),
}))

import { authTokenRelayHandler } from '@/endpoints/auth-token-relay'

// ── Helpers ─────────────────────────────────────────────────────────

function makeReq(params: Record<string, string> = {}, extraHeaders: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/auth/token-relay')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const headersMap = new Map(Object.entries(extraHeaders))
  return {
    url: url.toString(),
    payload: { secret: 'test-secret' },
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
    },
  } as any
}

// ── Tests ────────────────────────────────────────────────────────────

describe('authTokenRelayHandler', () => {
  it('returns 400 when token parameter is missing', async () => {
    const req = makeReq({ r: '/dashboard' })
    const res = await authTokenRelayHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing token/i)
  })

  it('returns 401 for an invalid JWT', async () => {
    const req = makeReq({ t: INVALID_TOKEN })
    const res = await authTokenRelayHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/invalid or expired/i)
  })

  it('redirects (302) for a valid JWT', async () => {
    const req = makeReq({ t: VALID_TOKEN, r: '/dashboard' })
    const res = await authTokenRelayHandler(req)
    expect(res.status).toBe(302)
  })

  it('redirects to /api/auth/complete with token and redirect params', async () => {
    const req = makeReq({ t: VALID_TOKEN, r: '/settings' })
    const res = await authTokenRelayHandler(req)
    const location = res.headers.get('Location')
    expect(location).toBeTruthy()
    const url = new URL(location!)
    expect(url.pathname).toBe('/api/auth/complete')
    expect(url.searchParams.get('token')).toBe(VALID_TOKEN)
    expect(url.searchParams.get('redirect')).toBe('/settings')
  })

  it('defaults redirect to /dashboard when r param is missing', async () => {
    const req = makeReq({ t: VALID_TOKEN })
    const res = await authTokenRelayHandler(req)
    const location = res.headers.get('Location')!
    const url = new URL(location)
    expect(url.searchParams.get('redirect')).toBe('/dashboard')
  })

  it('uses /dashboard for non-relative redirect paths (open redirect prevention)', async () => {
    const req = makeReq({ t: VALID_TOKEN, r: 'https://evil.com/steal' })
    const res = await authTokenRelayHandler(req)
    const location = res.headers.get('Location')!
    const url = new URL(location)
    expect(url.searchParams.get('redirect')).toBe('/dashboard')
  })

  it('uses x-forwarded-host and x-forwarded-proto for the base URL', async () => {
    const req = makeReq(
      { t: VALID_TOKEN, r: '/settings' },
      { 'x-forwarded-host': 'kendev.co', 'x-forwarded-proto': 'https' }
    )
    const res = await authTokenRelayHandler(req)
    const location = res.headers.get('Location')!
    expect(location).toContain('kendev.co')
    expect(location).toContain('/api/auth/complete')
  })

  it('falls back to getServerSideURL when no host header is present', async () => {
    const req = makeReq({ t: VALID_TOKEN })
    const res = await authTokenRelayHandler(req)
    const location = res.headers.get('Location')!
    expect(location).toContain('spacesangels.com')
  })

  it('the complete URL includes both token and redirect query params', async () => {
    const req = makeReq({ t: VALID_TOKEN, r: '/onboarding' })
    const res = await authTokenRelayHandler(req)
    const location = new URL(res.headers.get('Location')!)
    expect(location.searchParams.get('token')).toBe(VALID_TOKEN)
    expect(location.searchParams.get('redirect')).toBe('/onboarding')
  })
})
