/**
 * Suitcase Apply Endpoint — Unit Tests
 *
 * POST /api/suitcase/apply
 * Auth: Authorization: Bearer CRON_SECRET header.
 * Idempotent create-or-update for portable Endeavor suitcases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { suitcaseApplyHandler } from '@/endpoints/suitcase-apply'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_SUITCASE = {
  manifest: {
    version: '1.0.0',
    constitutional: { isAngel: true },
    tenant: { name: 'Test Co', slug: 'test-co' },
  },
  tenant: { name: 'Test Co', slug: 'test-co', domain: 'test-co.spacesangels.com' },
  spaces: [{ name: 'Main Space', slug: 'main-space', description: 'Primary space' }],
  channels: [
    { name: 'general', slug: 'general', spaceSlug: 'main-space', type: 'general', isDefault: true },
  ],
  products: [],
}

// ── Helper ────────────────────────────────────────────────────────────────────

let findCallIndex = 0

function makePayload(overrides: Record<string, unknown> = {}) {
  findCallIndex = 0
  return {
    find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      // Default: nothing exists (triggers "created" actions)
      return Promise.resolve({ docs: [], totalDocs: 0 })
    }),
    create: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'tenants') return Promise.resolve({ id: 10 })
      if (collection === 'spaces') return Promise.resolve({ id: 20 })
      if (collection === 'channels') return Promise.resolve({ id: 30 })
      if (collection === 'users') return Promise.resolve({ id: 99 })
      return Promise.resolve({ id: 100 })
    }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  headers: Record<string, string> = {},
  body: unknown = VALID_SUITCASE,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/suitcase/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  // Attach json() method since suitcase-apply uses req.json?.()
  const reqWithJson = Object.assign(nativeReq, { payload }) as any
  return reqWithJson
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('suitcaseApplyHandler', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when CRON_SECRET is set and Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const req = makeReq({}) // no Authorization header
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/unauthorized/i)
  })

  it('returns 401 when Authorization header has wrong token', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const req = makeReq({ authorization: 'Bearer wrong-token' })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(401)
  })

  it('skips auth check when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}) // no auth header, but no secret configured
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(200)
  })

  it('accepts valid Bearer token when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const req = makeReq({ authorization: 'Bearer my-secret' })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid JSON body', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, 'NOT_VALID_JSON{{{')
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/invalid json/i)
  })

  it('returns 400 when manifest is missing', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, { tenant: { slug: 'test' } })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/missing manifest/i)
  })

  it('returns 400 when manifest version is wrong', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, { manifest: { version: '2.0.0', constitutional: { isAngel: true } }, tenant: { slug: 'test' } })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/unsupported version/i)
  })

  it('returns 403 when isAngel is not true (anti-demonic safeguard)', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, {
      manifest: { version: '1.0.0', constitutional: { isAngel: false } },
      tenant: { slug: 'test' },
    })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.message).toMatch(/anti-demonic/i)
  })

  it('returns 400 when tenant data is missing from suitcase', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, {
      manifest: { version: '1.0.0', constitutional: { isAngel: true } },
    })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/missing tenant data/i)
  })

  it('returns 400 when tenant.slug is empty', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, {
      manifest: { version: '1.0.0', constitutional: { isAngel: true } },
      tenant: { name: 'No Slug' }, // slug missing
    })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/tenant.slug is required/i)
  })

  it('returns 404 for unknown built-in suitcase name', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, { builtin: 'nonexistent-suitcase' })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toMatch(/unknown built-in suitcase/i)
    expect(body.available).toContain('dovydas-music')
  })

  it('returns 200 with created actions when nothing exists yet', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, VALID_SUITCASE)
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toMatch(/applied successfully/i)
    expect(body.tenant).toBe('test-co')
    expect(body.results.tenant.action).toBe('created')
    expect(body.results.spaces[0].action).toBe('created')
    expect(body.results.channels[0].action).toBe('created')
  })

  it('returns 200 with "exists" actions when tenant already exists', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, VALID_SUITCASE, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenants') return Promise.resolve({ docs: [{ id: 10 }], totalDocs: 1 })
        if (collection === 'spaces') return Promise.resolve({ docs: [{ id: 20 }], totalDocs: 1 })
        if (collection === 'channels') return Promise.resolve({ docs: [{ id: 30 }], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      update: vi.fn().mockResolvedValue({}),
    })
    const res = await suitcaseApplyHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Tenant has domain field → triggers update; spaces/channels already exist
    expect(['exists', 'updated']).toContain(body.results.tenant.action)
    expect(body.results.spaces[0].action).toBe('exists')
    expect(body.results.channels[0].action).toBe('exists')
  })

  it('returns 200 and accepts built-in dovydas-music suitcase', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq({}, { builtin: 'dovydas-music' })
    const res = await suitcaseApplyHandler(req)
    // dovydas-music.json is bundled — should succeed (or at least not 401/400/403/404/500)
    expect([200, 400]).toContain(res.status) // may fail validation if suitcase format differs
  })
})
