/**
 * Discord OAuth Endpoint Tests
 *
 * Tests for:
 * - authDiscordInitHandler  — GET /api/auth/discord (redirects to Discord OAuth)
 * - authDiscordCallbackHandler — GET /api/auth/discord/callback (processes callback)
 *
 * Covers:
 * - Init: redirect URL construction, scopes, link-mode state encoding, missing config
 * - Callback: code exchange, profile fetch, user creation, linking, duplicate prevention
 * - State: valid JSON parsing, invalid state resilience, missing state defaults
 * - Cross-domain: token relay for custom domains, same-domain cookie setting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock jsonwebtoken ──────────────────────────────────────────
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
  },
}))

// NOTE: next/server mock removed — auth-discord no longer uses NextResponse.
// Cookie is now set via a plain Response with Set-Cookie header.

// ─── Import handlers after mocks ────────────────────────────────
const { authDiscordInitHandler, authDiscordCallbackHandler } = await import(
  '@/endpoints/auth-discord'
)

// ─── Helpers ────────────────────────────────────────────────────

/** Build a minimal mock Payload request object */
function makeMockReq(overrides: {
  url?: string
  headers?: Record<string, string>
  user?: { id: string | number; email?: string } | null
  payload?: Record<string, unknown>
} = {}) {
  const headerMap = new Map<string, string>(
    Object.entries(overrides.headers || {}),
  )

  return {
    url: overrides.url || 'http://localhost:3000/api/auth/discord',
    headers: {
      get: (key: string) => headerMap.get(key.toLowerCase()) ?? null,
    },
    user: overrides.user ?? null,
    payload: overrides.payload ?? makeMockPayload(),
  }
}

/** Build a mock Payload CMS instance */
function makeMockPayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'new-user-1', email: 'new@test.com', roles: ['customer'] }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

/** Build a mock Discord token response */
function mockTokenResponse(accessToken = 'discord-access-token-123') {
  return new Response(JSON.stringify({ access_token: accessToken, token_type: 'Bearer' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Build a mock Discord user profile response */
function mockProfileResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: '1234567890',
      username: 'testuser',
      global_name: 'Test User',
      email: 'testuser@example.com',
      avatar: 'abc123hash',
      discriminator: '0',
      ...overrides,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ─── Environment setup ──────────────────────────────────────────
const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DISCORD_CLIENT_ID = 'test-client-id'
  process.env.DISCORD_CLIENT_SECRET = 'test-client-secret'
  process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
  process.env.PAYLOAD_SECRET = 'test-payload-secret'
  ;(process.env as any).NODE_ENV = 'test'
  delete process.env.COOKIE_DOMAIN
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

// =====================================================================
// Init handler — authDiscordInitHandler
// =====================================================================
describe('authDiscordInitHandler', () => {
  it('redirects to Discord OAuth URL with 302 status', async () => {
    const req = makeMockReq()
    const res = await authDiscordInitHandler(req as any)

    expect(res.status).toBe(302)

    const location = res.headers.get('Location')
    expect(location).toBeTruthy()
    expect(location).toContain('https://discord.com/oauth2/authorize')
    expect(location).toContain('client_id=test-client-id')
    expect(location).toContain('response_type=code')
  })

  it('includes correct scopes (identify, email, guilds)', async () => {
    const req = makeMockReq()
    const res = await authDiscordInitHandler(req as any)

    const location = res.headers.get('Location')!
    // scope param should contain all three scopes
    expect(location).toContain('scope=identify+email+guilds')
  })

  it('encodes state with redirect, mode, userId when mode=link', async () => {
    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord?mode=link&redirect=/settings',
      user: { id: 'user-42', email: 'linked@example.com' },
    })

    const res = await authDiscordInitHandler(req as any)
    const location = res.headers.get('Location')!

    // Extract the state parameter from the URL
    const locationUrl = new URL(location)
    const stateEncoded = locationUrl.searchParams.get('state')
    expect(stateEncoded).toBeTruthy()

    const stateObj = JSON.parse(decodeURIComponent(stateEncoded!))
    expect(stateObj.mode).toBe('link')
    expect(stateObj.userId).toBe('user-42')
    expect(stateObj.redirect).toBe('/settings')
  })

  it('returns 501 when DISCORD_CLIENT_ID is not set', async () => {
    delete process.env.DISCORD_CLIENT_ID

    const req = makeMockReq()
    const res = await authDiscordInitHandler(req as any)

    expect(res.status).toBe(501)

    const body = await res.json()
    expect(body.error).toContain('not configured')
  })
})

// =====================================================================
// Callback handler — authDiscordCallbackHandler
// =====================================================================
describe('authDiscordCallbackHandler', () => {
  let fetchSpy: any

  beforeEach(() => {
    // Set up global fetch mock for Discord API calls
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('exchanges authorization code for access token (calls Discord token endpoint)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())      // token exchange
      .mockResolvedValueOnce(mockProfileResponse())     // user profile

    const payload = makeMockPayload()
    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=auth-code-abc',
      payload,
    })

    await authDiscordCallbackHandler(req as any)

    // First fetch call should be to Discord's token endpoint
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const [tokenUrl, tokenOptions] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(tokenUrl).toBe('https://discord.com/api/oauth2/token')
    expect(tokenOptions?.method).toBe('POST')
    expect(tokenOptions?.body).toBeInstanceOf(URLSearchParams)

    const bodyParams = tokenOptions.body as URLSearchParams
    expect(bodyParams.get('code')).toBe('auth-code-abc')
    expect(bodyParams.get('client_id')).toBe('test-client-id')
    expect(bodyParams.get('client_secret')).toBe('test-client-secret')
    expect(bodyParams.get('grant_type')).toBe('authorization_code')
  })

  it('fetches user profile from Discord API', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse('my-token'))
      .mockResolvedValueOnce(mockProfileResponse())

    const payload = makeMockPayload()
    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=code123',
      payload,
    })

    await authDiscordCallbackHandler(req as any)

    // Second fetch call should be to Discord's user profile endpoint
    const [profileUrl, profileOptions] = fetchSpy.mock.calls[1] as [string, RequestInit]
    expect(profileUrl).toBe('https://discord.com/api/users/@me')
    expect(profileOptions?.headers).toEqual({ Authorization: 'Bearer my-token' })
  })

  it('links Discord to existing user (mode=link) and updates socialProviders', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(mockProfileResponse({ id: 'discord-999' }))

    const existingUser = {
      id: 'user-42',
      email: 'existing@example.com',
      roles: ['customer'],
      socialProviders: [],
    }

    const payload = makeMockPayload({
      findByID: vi.fn().mockResolvedValue(existingUser),
    })

    const stateObj = { mode: 'link', userId: 'user-42', redirect: '/account' }
    const stateParam = encodeURIComponent(JSON.stringify(stateObj))

    const req = makeMockReq({
      url: `http://localhost:3000/api/auth/discord/callback?code=code123&state=${stateParam}`,
      payload,
    })

    const res = await authDiscordCallbackHandler(req as any)

    // Should have looked up the user by ID
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'user-42',
        overrideAccess: true,
      }),
    )

    // Should have updated the user with the new socialProviders entry
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'user-42',
        data: expect.objectContaining({
          socialProviders: expect.arrayContaining([
            expect.objectContaining({
              provider: 'discord',
              providerId: 'discord-999',
            }),
          ]),
        }),
      }),
    )

    // Should redirect back to /account
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/account')
  })

  it('creates new user when email not found', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({
          id: 'discord-new-1',
          email: 'brandnew@example.com',
          username: 'newplayer',
          global_name: 'New Player',
        }),
      )

    const payload = makeMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({
        id: 'created-user-1',
        email: 'brandnew@example.com',
        roles: ['customer'],
      }),
    })

    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=code123',
      payload,
    })

    await authDiscordCallbackHandler(req as any)

    // Should have attempted to find by email first
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { email: { equals: 'brandnew@example.com' } },
      }),
    )

    // Then find by provider ID
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { 'socialProviders.providerId': { equals: 'discord-new-1' } },
      }),
    )

    // Should have created a new user
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({
          email: 'brandnew@example.com',
          name: 'New Player',
          roles: ['customer'],
          socialProviders: expect.arrayContaining([
            expect.objectContaining({
              provider: 'discord',
              providerId: 'discord-new-1',
            }),
          ]),
        }),
      }),
    )
  })

  it('prevents duplicate provider entries (does not add if already linked)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(mockProfileResponse({ id: 'discord-already' }))

    const existingUser = {
      id: 'user-42',
      email: 'linked@example.com',
      roles: ['customer'],
      socialProviders: [
        { provider: 'discord', providerId: 'discord-already', email: 'linked@example.com' },
      ],
    }

    const payload = makeMockPayload({
      findByID: vi.fn().mockResolvedValue(existingUser),
    })

    const stateObj = { mode: 'link', userId: 'user-42' }
    const stateParam = encodeURIComponent(JSON.stringify(stateObj))

    const req = makeMockReq({
      url: `http://localhost:3000/api/auth/discord/callback?code=code123&state=${stateParam}`,
      payload,
    })

    await authDiscordCallbackHandler(req as any)

    // Should NOT have called update because discord is already linked
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('handles missing email from Discord (uses synthetic email)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({
          id: 'discord-no-email',
          email: null,
          username: 'privateplayer',
          global_name: 'Private Player',
        }),
      )

    const payload = makeMockPayload({
      // No user found by email (no email to search) or by providerId
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({
        id: 'created-user-2',
        email: 'discord-discord-no-email@oauth.angel-os.local',
        roles: ['customer'],
      }),
    })

    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=code123',
      payload,
    })

    await authDiscordCallbackHandler(req as any)

    // Should create user with synthetic email since Discord didn't provide one
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({
          email: 'discord-discord-no-email@oauth.angel-os.local',
          name: 'Private Player',
        }),
      }),
    )
  })
})

// =====================================================================
// State validation
// =====================================================================
describe('state validation', () => {
  let fetchSpy: any

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('valid JSON state parsed correctly (redirect is honored)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({ id: 'discord-state-1', email: 'state@test.com' }),
      )

    const payload = makeMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({
        id: 'user-state-1',
        email: 'state@test.com',
        roles: ['customer'],
      }),
    })

    const stateObj = { redirect: '/my-custom-page' }
    const stateParam = encodeURIComponent(JSON.stringify(stateObj))

    const req = makeMockReq({
      url: `http://localhost:3000/api/auth/discord/callback?code=code123&state=${stateParam}`,
      payload,
    })

    const res = await authDiscordCallbackHandler(req as any)

    // Plain Response with Location header and Set-Cookie
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/my-custom-page')
    expect(res.headers.get('Set-Cookie')).toContain('payload-token=mock-jwt-token')
  })

  it('invalid/tampered state does not crash (gracefully ignored)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({ id: 'discord-bad-state', email: 'bad@test.com' }),
      )

    const payload = makeMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({
        id: 'user-bad-state',
        email: 'bad@test.com',
        roles: ['customer'],
      }),
    })

    // Tampered state: not valid JSON
    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=code123&state=NOT%7BVALID%7DJSON',
      payload,
    })

    // Should not throw
    const res = await authDiscordCallbackHandler(req as any)

    // Should still complete the flow with a redirect (defaults to /dashboard)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/dashboard')
    expect(res.headers.get('Set-Cookie')).toContain('payload-token=')
  })

  it('missing state works (defaults to /dashboard redirect)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({ id: 'discord-no-state', email: 'nostate@test.com' }),
      )

    const payload = makeMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({
        id: 'user-no-state',
        email: 'nostate@test.com',
        roles: ['customer'],
      }),
    })

    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=code123',
      payload,
    })

    const res = await authDiscordCallbackHandler(req as any)

    // With no state, customer user should redirect to /dashboard
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/dashboard')
    expect(res.headers.get('Set-Cookie')).toContain('payload-token=')
  })
})

// =====================================================================
// Cross-domain relay
// =====================================================================
describe('cross-domain relay', () => {
  let fetchSpy: any

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('custom domain origin triggers token relay redirect', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({ id: 'discord-cross-1', email: 'cross@test.com' }),
      )

    // Simulate: user on custom-store.com was sent to canonical for OAuth,
    // and the state carries origin=https://custom-store.com
    const stateObj = { origin: 'https://custom-store.com', redirect: '/shop' }
    const stateParam = encodeURIComponent(JSON.stringify(stateObj))

    const payload = makeMockPayload({
      find: vi.fn()
        .mockResolvedValueOnce({ docs: [] })            // users by email — not found
        .mockResolvedValueOnce({ docs: [] })            // users by providerId — not found
        .mockResolvedValueOnce({ docs: [{ id: 't-1' }] }), // tenants check — found
      create: vi.fn().mockResolvedValue({
        id: 'user-cross-1',
        email: 'cross@test.com',
        roles: ['customer'],
      }),
    })

    const req = makeMockReq({
      url: `http://localhost:3000/api/auth/discord/callback?code=code123&state=${stateParam}`,
      payload,
    })

    const res = await authDiscordCallbackHandler(req as any)

    // Should redirect to the custom domain's token relay endpoint
    expect(res.status).toBe(302)
    const location = res.headers.get('Location')!
    expect(location).toContain('https://custom-store.com/api/auth/token-relay')
    expect(location).toContain('t=')  // token param
    expect(location).toContain('r=')  // redirect param
  })

  it('same domain sets cookie directly (no relay)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(
        mockProfileResponse({ id: 'discord-same-1', email: 'same@test.com' }),
      )

    const payload = makeMockPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({
        id: 'user-same-1',
        email: 'same@test.com',
        roles: ['customer'],
      }),
    })

    // No origin in state — same domain flow
    const req = makeMockReq({
      url: 'http://localhost:3000/api/auth/discord/callback?code=code123',
      payload,
    })

    const res = await authDiscordCallbackHandler(req as any)

    // Plain Response with Location header and Set-Cookie
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/dashboard')

    // Verify cookie was set via Set-Cookie header
    const setCookie = res.headers.get('Set-Cookie')!
    expect(setCookie).toContain('payload-token=mock-jwt-token')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=1209600')
  })
})
