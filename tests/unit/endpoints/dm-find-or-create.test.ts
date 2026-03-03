/**
 * DM Find or Create Endpoint — Unit Tests
 *
 * POST /api/dm/find-or-create
 * Auth via payload.auth({ headers }). Finds or creates a DM channel between
 * the authenticated user and a target user (or 'leo').
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockFindOrCreateDM = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ channelId: 77, isNew: false }),
)
const mockEnsureDMSpace = vi.hoisted(() => vi.fn().mockResolvedValue('dm-space-id-42'))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/dmChannels', () => ({ findOrCreateDM: mockFindOrCreateDM }))
vi.mock('@/utilities/ensureSystemSpace', () => ({ ensureDMSpace: mockEnsureDMSpace }))

import { dmFindOrCreateHandler } from '@/endpoints/dm-find-or-create'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_CHANNEL = {
  id: 77,
  slug: 'dm-user10-user20',
  name: 'DM: Alice & Bob',
  type: 'dm',
  members: [],
  source: 'direct',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(
  body: Record<string, unknown> | null = { targetUserId: '20', tenantId: 'tenant-abc' },
  payloadOverrides: Record<string, unknown> = {},
) {
  const nativeReq = new Request('http://localhost/api/dm/find-or-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })

  const payload = {
    auth: vi.fn().mockResolvedValue({ user: { id: 10 } }),
    findByID: vi.fn().mockResolvedValue(DEFAULT_CHANNEL),
    ...payloadOverrides,
  }

  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('dmFindOrCreateHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockFindOrCreateDM.mockResolvedValue({ channelId: 77, isNew: false })
    mockEnsureDMSpace.mockResolvedValue('dm-space-id-42')
  })

  it('returns 401 when payload.auth returns no user', async () => {
    const req = makeReq({ targetUserId: '20', tenantId: 'tenant-abc' }, {
      auth: vi.fn().mockResolvedValue({ user: null }),
    })
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/not authenticated/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/invalid json/i)
  })

  it('returns 400 when targetUserId is missing', async () => {
    const req = makeReq({ tenantId: 'tenant-abc' })
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/missing required fields/i)
  })

  it('returns 400 when tenantId is missing', async () => {
    const req = makeReq({ targetUserId: '20' })
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/missing required fields/i)
  })

  it('returns 500 when ensureDMSpace returns null', async () => {
    mockEnsureDMSpace.mockResolvedValue(null)
    const req = makeReq()
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toMatch(/failed to provision/i)
  })

  it('returns 200 with correct channel shape on success', async () => {
    const req = makeReq()
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.channel).toMatchObject({
      id: '77',
      slug: 'dm-user10-user20',
      name: 'DM: Alice & Bob',
      type: 'dm',
    })
    expect(body.dmSpaceId).toBe('dm-space-id-42')
  })

  it('reflects isNew: true when findOrCreateDM returns isNew: true', async () => {
    mockFindOrCreateDM.mockResolvedValue({ channelId: 77, isNew: true })
    const req = makeReq()
    const res = await dmFindOrCreateHandler(req)
    const body = await res.json()
    expect(body.isNew).toBe(true)
  })

  it('reflects isNew: false when channel already existed', async () => {
    mockFindOrCreateDM.mockResolvedValue({ channelId: 77, isNew: false })
    const req = makeReq()
    const res = await dmFindOrCreateHandler(req)
    const body = await res.json()
    expect(body.isNew).toBe(false)
  })

  it('returns 500 with error message propagated from findOrCreateDM throwing', async () => {
    mockFindOrCreateDM.mockRejectedValue(new Error('DM channel conflict'))
    const req = makeReq()
    const res = await dmFindOrCreateHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toBe('DM channel conflict')
  })
})
