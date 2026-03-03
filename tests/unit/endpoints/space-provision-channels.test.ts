/**
 * Space Provision Channels Endpoint — Unit Tests
 *
 * POST /api/spaces/provision-channels
 * Auth required (space_admin or global admin). Idempotent channel provisioning.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockSpaceTemplates = vi.hoisted(() => ({}))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/spaceProvisioning', () => ({ SPACE_TEMPLATES: mockSpaceTemplates }))

import { spaceProvisionChannelsHandler } from '@/endpoints/space-provision-channels'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_SPACE = { id: 10, name: 'Main Space', tenant: { id: 5 } }

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(DEFAULT_SPACE),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    create: vi.fn().mockResolvedValue({ id: 100 }),
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, roles: ['admin'] },
  body: Record<string, unknown> | null = { spaceId: 10 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/spaces/provision-channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('spaceProvisionChannelsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    Object.keys(mockSpaceTemplates).forEach((k) => delete (mockSpaceTemplates as any)[k])
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1, roles: ['admin'] }, null)
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when spaceId is missing', async () => {
    const req = makeReq({ id: 1, roles: ['admin'] }, {})
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/spaceId is required/i)
  })

  it('returns 404 when space not found (findByID returns null)', async () => {
    const req = makeReq({ id: 1, roles: ['admin'] }, { spaceId: 99 }, {
      findByID: vi.fn().mockResolvedValue(null),
    })
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/space not found/i)
  })

  it('returns 403 when non-admin user has no space_admin membership', async () => {
    const req = makeReq(
      { id: 1, roles: ['member'] },
      { spaceId: 10 },
      {
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'member' }], totalDocs: 1 }),
      },
    )
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/space admin/i)
  })

  it('allows space_admin membership to provision channels', async () => {
    const req = makeReq(
      { id: 1, roles: ['member'] }, // not global admin
      { spaceId: 10 },
      {
        find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
          if (collection === 'space-memberships')
            return Promise.resolve({ docs: [{ role: 'space_admin' }], totalDocs: 1 })
          return Promise.resolve({ docs: [], totalDocs: 0 }) // no existing channels
        }),
        create: vi.fn().mockResolvedValue({ id: 100 }),
      },
    )
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.created).toContain('general')
    expect(body.created).toContain('announcements')
  })

  it('creates default channels when none exist', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 100 })
    const req = makeReq({ id: 1, roles: ['admin'] }, { spaceId: 10 }, { create: createMock })
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toEqual(['general', 'announcements'])
    expect(body.skipped).toEqual([])
    expect(body.message).toMatch(/created 2 channel/i)
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('skips channels that already exist', async () => {
    const req = makeReq({ id: 1, roles: ['admin'] }, { spaceId: 10 }, {
      find: vi.fn().mockResolvedValue({
        docs: [{ slug: 'general' }, { slug: 'announcements' }],
        totalDocs: 2,
      }),
      create: vi.fn().mockResolvedValue({}),
    })
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toEqual([])
    expect(body.skipped).toEqual(['general', 'announcements'])
    expect(body.message).toMatch(/no new channels needed/i)
  })

  it('partially skips when only some channels exist', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 101 })
    const req = makeReq({ id: 1, roles: ['admin'] }, { spaceId: 10 }, {
      find: vi.fn().mockResolvedValue({ docs: [{ slug: 'general' }], totalDocs: 1 }),
      create: createMock,
    })
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toEqual(['announcements'])
    expect(body.skipped).toEqual(['general'])
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('includes spaceId in response', async () => {
    const req = makeReq()
    const res = await spaceProvisionChannelsHandler(req)
    const body = await res.json()
    expect(body.spaceId).toBe(10)
  })

  it('returns 500 when an unexpected error occurs', async () => {
    const req = makeReq({ id: 1, roles: ['admin'] }, { spaceId: 10 }, {
      findByID: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await spaceProvisionChannelsHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to provision channels/i)
  })
})
