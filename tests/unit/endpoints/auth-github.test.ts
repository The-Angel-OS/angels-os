/**
 * GitHub Auth Endpoints — Unit Tests
 *
 * GET /api/auth/github         — authGithubInitHandler
 * GET /api/auth/github/callback — authGithubCallbackHandler
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetServerSideURL = vi.hoisted(() => vi.fn().mockReturnValue('https://spacesangels.com'))
const mockSignJWT = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock.jwt.token.github'),
  })),
)

vi.mock('@/utilities/getURL', () => ({ getServerSideURL: mockGetServerSideURL }))
vi.mock('jose', () => ({ SignJWT: mockSignJWT }))

import { authGithubInitHandler, authGithubCallbackHandler } from '@/endpoints/auth-github'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1, email: 'github-123@oauth.angel-os.local', sessions: [] }),
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

// ── Fake fetch response builder ───────────────────────────────────────────────

function fakeTokenResponse(data: Record<string, unknown>, ok = true) {
  return Promise.resolve({
    ok,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  } as Response)
}

function fakeProfileResponse(data: Record<string, unknown>, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  } as Response)
}

// ── Tests — authGithubInitHandler ─────────────────────────────────────────────

describe('authGithubInitHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSideURL.mockReturnValue('https://spacesangels.com')
    process.env.GITHUB_CLIENT_ID = 'gh_client_id_test'
  })

  afterEach(() => {
    delete process.env.GITHUB_CLIENT_ID
  })

  it('returns 501 when GITHUB_CLIENT_ID is not configured', async () => {
    delete process.env.GITHUB_CLIENT_ID
    const req = makeReq('https://spacesangels.com/api/auth/github')
    const res = await authGithubInitHandler(req)
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })

  it('redirects 302 to GitHub authorize URL', async () => {
    const req = makeReq('https://spacesangels.com/api/auth/github')
    const res = await authGithubInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    expect(location).toContain('github.com/login/oauth/authorize')
    expect(location).toContain('client_id=gh_client_id_test')
  })

  it('includes redirect param in state when provided', async () => {
    const req = makeReq('https://spacesangels.com/api/auth/github?redirect=/dashboard')
    const res = await authGithubInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    expect(location).toContain('state=')
    // State is encodeURIComponent(JSON.stringify(...)) and then URL-encoded — use URLSearchParams
    const qs = new URLSearchParams(location.split('?')[1] ?? '')
    const state = JSON.parse(decodeURIComponent(qs.get('state') ?? '{}'))
    expect(state.redirect).toBe('/dashboard')
  })

  it('returns 401 when link mode requested without authenticated user', async () => {
    const req = makeReq('https://spacesangels.com/api/auth/github?mode=link', null)
    const res = await authGithubInitHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('encodes mode=link and userId in state when user is authenticated', async () => {
    const req = makeReq(
      'https://spacesangels.com/api/auth/github?mode=link',
      { id: 42, email: 'user@test.com' },
    )
    const res = await authGithubInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    const qs = new URLSearchParams(location.split('?')[1] ?? '')
    const state = JSON.parse(decodeURIComponent(qs.get('state') ?? '{}'))
    expect(state.mode).toBe('link')
    expect(state.userId).toBe(42)
  })

  it('includes origin in state when request is from a different domain', async () => {
    const req = makeReq(
      'https://spacesangels.com/api/auth/github',
      null,
      {},
      { 'x-forwarded-host': 'kendev.co', 'x-forwarded-proto': 'https' },
    )
    const res = await authGithubInitHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    const qs = new URLSearchParams(location.split('?')[1] ?? '')
    const state = JSON.parse(decodeURIComponent(qs.get('state') ?? '{}'))
    expect(state.origin).toContain('kendev.co')
  })
})

// ── Tests — authGithubCallbackHandler ─────────────────────────────────────────

describe('authGithubCallbackHandler', () => {
  const BASE_URL = 'https://spacesangels.com/api/auth/github/callback'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSideURL.mockReturnValue('https://spacesangels.com')
    process.env.GITHUB_CLIENT_ID = 'gh_client_id_test'
    process.env.GITHUB_CLIENT_SECRET = 'gh_client_secret_test'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_SECRET
  })

  it('returns 400 when authorization code is missing', async () => {
    const req = makeReq(BASE_URL)
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing authorization code/i)
  })

  it('returns 501 when GitHub credentials are not configured', async () => {
    delete process.env.GITHUB_CLIENT_ID
    const req = makeReq(`${BASE_URL}?code=abc123`)
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(501)
  })

  it('returns 502 when token exchange fails (non-OK response)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Bad Request'),
    })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=abc123`)
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/failed to exchange code/i)
  })

  it('returns 502 when GitHub token response has error field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ error: 'bad_verification_code', error_description: 'The code is invalid.' })),
      json: () => Promise.resolve({ error: 'bad_verification_code', error_description: 'The code is invalid.' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=bad_code`)
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/the code is invalid/i)
  })

  it('returns 502 when GitHub profile fetch fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ access_token: 'gho_token123' })),
        json: () => Promise.resolve({ access_token: 'gho_token123' }),
      })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)
    const req = makeReq(`${BASE_URL}?code=valid_code`)
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/failed to fetch.*profile/i)
  })

  it('redirects 302 on successful OAuth flow with new user creation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ access_token: 'gho_token123' })),
        json: () => Promise.resolve({ access_token: 'gho_token123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 99999, login: 'testuser', name: 'Test User', email: 'test@github.com', avatar_url: 'https://avatars.githubusercontent.com/u/99999' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const createMock = vi.fn().mockResolvedValue({ id: 50, email: 'test@github.com', sessions: [] })
    const req = makeReq(`${BASE_URL}?code=valid_code`, null, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      create: createMock,
      update: vi.fn().mockResolvedValue({}),
    })
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('Location') ?? ''
    expect(location).toBeTruthy()
  })

  it('redirects 302 and reuses existing user when email matches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'gho_token123' }),
        text: () => Promise.resolve(JSON.stringify({ access_token: 'gho_token123' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 77777, login: 'existing', name: 'Existing User', email: 'existing@test.com', avatar_url: null }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const existingUser = { id: 10, email: 'existing@test.com', socialProviders: [], sessions: [] }
    const createMock = vi.fn()
    const req = makeReq(`${BASE_URL}?code=valid_code`, null, {
      find: vi.fn().mockResolvedValue({ docs: [existingUser], totalDocs: 1 }),
      create: createMock,
      update: vi.fn().mockResolvedValue(existingUser),
    })
    const res = await authGithubCallbackHandler(req)
    expect(res.status).toBe(302)
    // Existing user — create should not have been called
    expect(createMock).not.toHaveBeenCalled()
  })
})
