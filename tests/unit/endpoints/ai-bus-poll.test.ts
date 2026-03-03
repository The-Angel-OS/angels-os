/**
 * AI Bus Poll Endpoint — Unit Tests
 *
 * GET /api/ai-bus/poll
 * Auth required. Returns paginated AI Bus messages for the user's tenant.
 * Supports filtering by since, spaceId, channel, visibility, limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { aiBusPollHandler } from '@/endpoints/ai-bus-poll'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_MESSAGE = {
  id: 1,
  content: 'Hello, world!',
  channel: 'general',
  createdAt: '2025-01-01T10:00:00Z',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({
      docs: [DEFAULT_MESSAGE],
      hasNextPage: false,
      totalDocs: 1,
    }),
    ...overrides,
  }
}

function makeReq(
  url: string = 'http://localhost/api/ai-bus/poll',
  user: Record<string, unknown> | null = { id: 10, tenants: [{ tenant: { id: 5 } }] },
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, string> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...headerOverrides }
  const nativeReq = new Request(url, { method: 'GET', headers })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('aiBusPollHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const req = makeReq('http://localhost/api/ai-bus/poll', null)
    const res = await aiBusPollHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/unauthorized/i)
  })

  it('returns 400 when tenant cannot be resolved', async () => {
    // User with no tenants and no servesTenant
    const req = makeReq('http://localhost/api/ai-bus/poll', { id: 10 })
    const res = await aiBusPollHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/could not resolve tenant/i)
  })

  it('returns 200 with messages for user with tenant array', async () => {
    const req = makeReq()
    const res = await aiBusPollHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.hasMore).toBe(false)
    expect(body.lastId).toBe(1)
  })

  it('resolves tenant from servesTenant field', async () => {
    const user = { id: 10, servesTenant: { id: 99 } }
    const findMock = vi.fn().mockResolvedValue({ docs: [], hasNextPage: false, totalDocs: 0 })
    const req = makeReq('http://localhost/api/ai-bus/poll', user, { find: findMock })
    const res = await aiBusPollHandler(req)
    expect(res.status).toBe(200)
    // Verify the find was called with tenant: 99
    const findCall = findMock.mock.calls[0][0]
    expect(JSON.stringify(findCall.where)).toContain('99')
  })

  it('resolves tenant from x-tenant-id header fallback', async () => {
    const user = { id: 10 } // no tenants, no servesTenant
    const findMock = vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants')
        return Promise.resolve({ docs: [{ id: 7 }], totalDocs: 1 })
      return Promise.resolve({ docs: [DEFAULT_MESSAGE], hasNextPage: false, totalDocs: 1 })
    })
    const req = makeReq(
      'http://localhost/api/ai-bus/poll',
      user,
      { find: findMock },
      { 'x-tenant-id': 'tenant-slug-abc' },
    )
    const res = await aiBusPollHandler(req)
    expect(res.status).toBe(200)
  })

  it('forwards since, spaceId, channel, visibility filters', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], hasNextPage: false, totalDocs: 0 })
    const url = 'http://localhost/api/ai-bus/poll?since=2025-01-01T00:00:00Z&spaceId=3&channel=general&visibility=public&limit=5'
    const req = makeReq(url, undefined, { find: findMock })
    await aiBusPollHandler(req)
    const findCall = findMock.mock.calls[0][0]
    const whereStr = JSON.stringify(findCall.where)
    expect(whereStr).toContain('2025-01-01T00:00:00Z')
    expect(whereStr).toContain('3')
    expect(whereStr).toContain('general')
    expect(whereStr).toContain('public')
    expect(findCall.limit).toBe(5)
  })

  it('clamps limit between 1 and 100', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], hasNextPage: false, totalDocs: 0 })
    const url = 'http://localhost/api/ai-bus/poll?limit=999'
    const req = makeReq(url, undefined, { find: findMock })
    await aiBusPollHandler(req)
    expect(findMock.mock.calls[0][0].limit).toBe(100)
  })

  it('returns 500 when payload.find throws', async () => {
    const req = makeReq('http://localhost/api/ai-bus/poll', undefined, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await aiBusPollHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to query/i)
  })

  it('returns lastId null when no messages', async () => {
    const req = makeReq('http://localhost/api/ai-bus/poll', undefined, {
      find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false, totalDocs: 0 }),
    })
    const res = await aiBusPollHandler(req)
    const body = await res.json()
    expect(body.lastId).toBeNull()
    expect(body.messages).toEqual([])
  })
})
