/**
 * Google Auth Endpoints — Unit Tests
 *
 * GET /api/auth/google         — authGoogleInitHandler
 * GET /api/auth/google/callback — authGoogleCallbackHandler
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetServerSideURL = vi.hoisted(() => vi.fn().mockReturnValue('https://spacesangels.com'))
const mockSignJWT = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock.jwt.token.google'),
  })),
)

vi.mock('@/utilities/getURL', () => ({ getServerSideURL: mockGetServerSideURL }))
vi.mock('jose', () => ({ SignJWT: mockSignJWT }))
// Sign-in AWAITS guardian-angel provisioning (deliberate: the portal must exist
// by the time the client loads My Portals). Against these mocks that whole
// provisionPortal chain runs for ~10s and intermittently blew the 30s timeout
// under full-suite load. It has its own tests; this file is about the callback.
vi.mock('@/utilities/ensureBaselineMemberships', () => ({
  ensureBaselineMemberships: vi
    .fn()
    .mockResolvedValue({ platformJoined: true, guardianProvisioned: false, joiningTenantJoined: false }),
}))

import { authGoogleInitHandler, authGoogleCallbackHandler } from '@/endpoints/auth-google'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1, email: 'google@test.com', sessions: [] }),
    update: vi.fn().mockResolvedValue({}),
    secret: 'test-hashed-payload-secret',
    ...overrides,
  }
}

function makeReq(
  url: string,
  user: Record<string, unknown> | null = null,
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, string> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = { ...headerOverrides }
  const nativeReq = new Request(url, { method: 'GET', headers })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Helper to build a fake base64-encoded Google id_token ─────────────────────

function makeGoogleIdToken(claims: Record<string, unknown> = {}): string {
  const payload = Buffer.from(JSON.stringify({
    email: 'google-user@gmail.com',
    name: 'Google User',
    sub: 'google-sub-12345',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
    ...claims,
  })).toString('base64url')
  return `header.${payload}.signature`
}

// ── Tests — authGoogleInitHandler ─────────────────────────────────────────────

describe('authGoogleInitHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSideURL.mockReturnValue('https://spacesangels.com')
    process.env.GOOGLE_CLIENT_ID = 'google_client_id_test'
  })

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID
  })

  it('returns 501 when GOOGLE_CLIENT_ID is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const req = makeReq('https://spacesangels.com/api/auth/google')
    const res = await authGoogleInitHandler(req)
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })

  it('redirects 302 to Google OAuth authorize URL', async () => {
    const req = makeReq('https://spacesangels.com/api/auth/google')
    const res = await authGoogleInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    expect(location).toContain('accounts.google.com/o/oauth2/v2/auth')
    expect(location).toContain('client_id=google_client_id_test')
    expect(location).toContain('scope=openid')
  })

  it('includes redirect param in state when provided', async () => {
    const req = makeReq('https://spacesangels.com/api/auth/google?redirect=/dashboard')
    const res = await authGoogleInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    const qs = new URLSearchParams(location.split('?')[1] ?? '')
    const state = JSON.parse(decodeURIComponent(qs.get('state') ?? '{}'))
    expect(state.redirect).toBe('/dashboard')
  })

  it('returns 401 when link mode requested without authenticated user', async () => {
    const req = makeReq('https://spacesangels.com/api/auth/google?mode=link', null)
    const res = await authGoogleInitHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('encodes mode=link and userId in state when user is authenticated', async () => {
    const req = makeReq(
      'https://spacesangels.com/api/auth/google?mode=link',
      { id: 77, email: 'user@test.com' },
    )
    const res = await authGoogleInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    const qs = new URLSearchParams(location.split('?')[1] ?? '')
    const state = JSON.parse(decodeURIComponent(qs.get('state') ?? '{}'))
    expect(state.mode).toBe('link')
    expect(state.userId).toBe(77)
  })

  it('includes origin in state when request is from a different domain', async () => {
    const req = makeReq(
      'https://spacesangels.com/api/auth/google',
      null,
      {},
      { 'x-forwarded-host': 'kendev.co', 'x-forwarded-proto': 'https' },
    )
    const res = await authGoogleInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    const qs = new URLSearchParams(location.split('?')[1] ?? '')
    const state = JSON.parse(decodeURIComponent(qs.get('state') ?? '{}'))
    expect(state.origin).toContain('kendev.co')
  })
})

// ── Tests — authGoogleCallbackHandler ─────────────────────────────────────────

describe('authGoogleCallbackHandler', () => {
  const BASE_URL = 'https://spacesangels.com/api/auth/google/callback'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSideURL.mockReturnValue('https://spacesangels.com')
    process.env.GOOGLE_CLIENT_ID = 'google_client_id_test'
    process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret_test'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  })

  it('returns 400 when authorization code is missing', async () => {
    const req = makeReq(BASE_URL)
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing authorization code/i)
  })

  it('returns 501 when Google credentials are not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const req = makeReq(`${BASE_URL}?code=abc123`)
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(501)
  })

  it('returns 502 when token exchange fails (non-OK response)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('invalid_client'),
    })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=abc123`)
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/failed to exchange code/i)
  })

  it('returns 502 when no id_token in token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ access_token: 'ya29.access' })),
      json: () => Promise.resolve({ access_token: 'ya29.access' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=valid_code`)
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/no id_token/i)
  })

  it('returns 502 when id_token is missing payload segment (no dots)', async () => {
    // A token with no dots has no payload segment → handler returns 502 "Malformed id_token"
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'notajwt' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=valid_code`)
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/malformed id_token/i)
  })

  it('returns 502 when id_token is missing email or sub claims', async () => {
    const idToken = makeGoogleIdToken({ email: undefined, sub: undefined })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: idToken }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=valid_code`)
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/missing required claims/i)
  })

  it('redirects 302 on successful OAuth flow with new user creation', async () => {
    const idToken = makeGoogleIdToken()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: idToken }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const createMock = vi.fn().mockResolvedValue({ id: 55, email: 'google-user@gmail.com', sessions: [] })
    const req = makeReq(`${BASE_URL}?code=valid_code`, null, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      create: createMock,
      update: vi.fn().mockResolvedValue({}),
    })
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    expect(location).toBeTruthy()
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('redirects 302 and reuses existing user when email matches', async () => {
    const idToken = makeGoogleIdToken({ email: 'existing@test.com', sub: 'google-sub-existing' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: idToken }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const existingUser = { id: 20, email: 'existing@test.com', socialProviders: [], sessions: [] }
    const createMock = vi.fn()
    const req = makeReq(`${BASE_URL}?code=valid_code`, null, {
      find: vi.fn().mockResolvedValue({ docs: [existingUser], totalDocs: 1 }),
      create: createMock,
      update: vi.fn().mockResolvedValue(existingUser),
    })
    const res = await authGoogleCallbackHandler(req)
    expect(res.status).toBe(302)
    expect(createMock).not.toHaveBeenCalled()
  })

  // Google only ever redirects to the ONE canonical callback registered in the
  // console. Everything below is how the session still lands on whichever of this
  // node's many hostnames the person actually started from — that is the property
  // that must survive, since registering each new tenant subdomain with Google
  // by hand is exactly the config we refuse to require.
  describe('lands the session back on the originating host', () => {
    function successReq(origin: string) {
      const idToken = makeGoogleIdToken({ email: 'existing@test.com', sub: 'sub-x' })
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id_token: idToken }) }),
      )
      const state = encodeURIComponent(JSON.stringify({ origin }))
      return makeReq(`${BASE_URL}?code=valid_code&state=${state}`, null, {
        // Doubles as the tenants lookup that authorises a custom-domain relay.
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 20, email: 'existing@test.com', socialProviders: [], sessions: [] }],
          totalDocs: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      })
    }

    afterEach(() => {
      delete process.env.COOKIE_DOMAIN
    })

    it('completes on the tenant subdomain when COOKIE_DOMAIN covers it', async () => {
      process.env.COOKIE_DOMAIN = '.spacesangels.com'
      const res = await authGoogleCallbackHandler(successReq('https://kessela.spacesangels.com'))
      expect(res.status).toBe(302)
      expect(res.headers.get('Location') ?? '').toContain(
        'https://kessela.spacesangels.com/api/auth/complete',
      )
    })

    it('relays the token to a known custom domain COOKIE_DOMAIN does not cover', async () => {
      process.env.COOKIE_DOMAIN = '.spacesangels.com'
      const res = await authGoogleCallbackHandler(successReq('https://kendev.co'))
      expect(res.status).toBe(302)
      expect(res.headers.get('Location') ?? '').toContain(
        'https://kendev.co/api/auth/token-relay',
      )
    })
  })
})
