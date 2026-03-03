import { describe, it, expect, vi, beforeEach } from 'vitest'

import { authSocialUnlinkHandler } from '@/endpoints/auth-social-unlink'

// ── Helpers ───────────────────────────────────────────────────────────────────

type SocialProvider = { provider: string; providerId?: string }

function makeReq(
  body: Record<string, unknown> | null,
  socialProviders: SocialProvider[] = [],
  user: Record<string, unknown> | null = { id: 42 },
) {
  const payload = {
    findByID: vi.fn().mockResolvedValue({ id: 42, socialProviders }),
    update: vi.fn().mockResolvedValue({ id: 42 }),
  }

  const req: any = {
    user,
    payload,
    json: body !== null ? vi.fn().mockResolvedValue(body) : vi.fn().mockRejectedValue(new Error('bad json')),
  }
  return req
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authSocialUnlinkHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when no user is authenticated', async () => {
    const req = makeReq({ provider: 'google' }, [], null)
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  // ── Body parsing ──────────────────────────────────────────────────────────

  it('returns 400 when body JSON is invalid', async () => {
    const req = makeReq(null, [], { id: 1 })
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid request body/i)
  })

  // ── Provider validation ───────────────────────────────────────────────────

  it('returns 400 when provider field is missing', async () => {
    const req = makeReq({}, [], { id: 1 })
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing provider/i)
  })

  it('returns 400 for an invalid provider value', async () => {
    const req = makeReq({ provider: 'twitter' }, [], { id: 1 })
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid provider/i)
  })

  it.each(['google', 'github', 'apple', 'discord'])(
    'accepts valid provider: %s',
    async (provider) => {
      const req = makeReq(
        { provider },
        [{ provider, providerId: 'some-id' }],
        { id: 1 },
      )
      const res = await authSocialUnlinkHandler(req)
      // With the provider present, should succeed (not 400)
      expect(res.status).not.toBe(400)
    },
  )

  // ── Provider lookup ───────────────────────────────────────────────────────

  it('returns 404 when the provider is not linked to the account', async () => {
    // User has github linked, but we try to unlink google
    const req = makeReq(
      { provider: 'google' },
      [{ provider: 'github', providerId: 'gh-123' }],
      { id: 1 },
    )
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not linked/i)
  })

  it('returns 404 when socialProviders array is empty', async () => {
    const req = makeReq({ provider: 'google' }, [], { id: 1 })
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(404)
  })

  // ── Successful unlink ─────────────────────────────────────────────────────

  it('returns 200 and success message when provider is removed', async () => {
    const req = makeReq(
      { provider: 'google', providerId: 'g-456' },
      [{ provider: 'google', providerId: 'g-456' }],
      { id: 1 },
    )
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/unlinked successfully/i)
  })

  it('reports remaining provider count after unlink', async () => {
    const req = makeReq(
      { provider: 'github' },
      [
        { provider: 'google', providerId: 'g-1' },
        { provider: 'github', providerId: 'gh-2' },
        { provider: 'discord', providerId: 'd-3' },
      ],
      { id: 1 },
    )
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remainingProviders).toBe(2)
  })

  it('calls payload.update with the filtered provider list', async () => {
    const providers: SocialProvider[] = [
      { provider: 'google', providerId: 'g-1' },
      { provider: 'github', providerId: 'gh-2' },
    ]
    const req = makeReq({ provider: 'google', providerId: 'g-1' }, providers, { id: 1 })
    await authSocialUnlinkHandler(req)
    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 1,
        data: expect.objectContaining({
          socialProviders: [{ provider: 'github', providerId: 'gh-2' }],
        }),
      }),
    )
  })

  it('matches by providerId when provided', async () => {
    // Two discord accounts — only unlink the first by providerId
    const req = makeReq(
      { provider: 'discord', providerId: 'd-OLD' },
      [
        { provider: 'discord', providerId: 'd-OLD' },
        { provider: 'discord', providerId: 'd-NEW' },
      ],
      { id: 1 },
    )
    const res = await authSocialUnlinkHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remainingProviders).toBe(1)
  })
})
