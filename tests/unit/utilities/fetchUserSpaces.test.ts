/**
 * fetchUserSpaces — Unit Tests
 *
 * fetchUserSpaces now DELEGATES the visibility decision to the canonical
 * PermissionService.resolveVisibleSpaceIds (the same resolver Spaces/Channels/
 * Messages read access uses) so the sidebar list cannot diverge from read access.
 *
 * These tests verify:
 *  - the delegation (the resolver's verdict drives which spaces are hydrated),
 *  - tenant scoping, dedup, isSystem flag, sort order, error → [],
 *  - the resolver's policy itself (role-inherits-non-private + private exclusion)
 *    via the un-mocked resolver in the integration block.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

// Mock the canonical resolver so the unit block can drive its verdict directly.
vi.mock('@/services/PermissionService', () => ({
  resolveVisibleSpaceIds: vi.fn(),
}))

import { fetchUserSpaces } from '@/utilities/fetchUserSpaces'
import { getPayload } from 'payload'
import { resolveVisibleSpaceIds } from '@/services/PermissionService'

const mockGetPayload = vi.mocked(getPayload)
const mockResolve = vi.mocked(resolveVisibleSpaceIds)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSpace(overrides: Record<string, unknown>) {
  return {
    id: 1,
    name: 'Community',
    slug: 'community',
    description: 'Main space',
    visibility: 'invite_only',
    tenant: 1,
    ...overrides,
  }
}

/**
 * Payload mock: findByID returns a user; find('spaces') returns the supplied
 * tenant spaces (already filtered as the real query's `where` would).
 */
function makePayload(tenantSpaces: unknown[] = [], user: unknown = { id: 1, roles: ['user'] }) {
  return {
    findByID: vi.fn().mockResolvedValue(user),
    find: vi.fn().mockResolvedValue({ docs: tenantSpaces }),
  } as any
}

// ── fetchUserSpaces (delegation unit) ───────────────────────────────────────────

describe('fetchUserSpaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolve.mockResolvedValue([10]) // default: resolver allows space 10
  })

  it('returns empty array when the resolver says the user can see nothing', async () => {
    mockResolve.mockResolvedValue(false)
    mockGetPayload.mockResolvedValue(makePayload([]))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toEqual([])
  })

  it('hydrates and serializes the spaces the resolver permits', async () => {
    const space = makeSpace({ id: 10, name: 'The Hub', slug: 'hub', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([space]))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('The Hub')
    expect(result[0].id).toBe('10')
  })

  it('queries with id-set filter when resolver returns a concrete list', async () => {
    const payload = makePayload([makeSpace({ id: 10 })])
    mockGetPayload.mockResolvedValue(payload)
    mockResolve.mockResolvedValue([10, 11])
    await fetchUserSpaces(1, 1)
    const whereArg = payload.find.mock.calls[0][0].where
    expect(JSON.stringify(whereArg)).toContain('"in":[10,11]')
    expect(JSON.stringify(whereArg)).toContain('"tenant"')
  })

  it('always surfaces the AI Bus in the sidebar even when the resolver excludes it', async () => {
    // Regression: the AI Bus is seeded `private` with no per-member grant, so the
    // canonical resolver (correctly) leaves it out of read-access. The sidebar must
    // still show it — fetchUserSpaces widens the query by slug. Asserting the WHERE
    // (not the mocked find result) is what proves the fix, since the mock can't filter.
    const payload = makePayload([
      makeSpace({ id: 10, name: 'Hub', slug: 'hub', tenant: 1 }),
      makeSpace({ id: 3, name: 'AI Bus', slug: 'ai-bus', visibility: 'private', tenant: 1 }),
    ])
    mockGetPayload.mockResolvedValue(payload)
    mockResolve.mockResolvedValue([10]) // resolver does NOT include the private ai-bus
    const result = await fetchUserSpaces(1, 1)
    const whereStr = JSON.stringify(payload.find.mock.calls[0][0].where)
    expect(whereStr).toContain('"or"')
    expect(whereStr).toContain('ai-bus')
    expect(result.some((x) => x.slug === 'ai-bus' && x.isSystem)).toBe(true)
  })

  it('queries by tenant only when resolver says "see everything" (admin)', async () => {
    const payload = makePayload([makeSpace({ id: 10 })])
    mockGetPayload.mockResolvedValue(payload)
    mockResolve.mockResolvedValue(true)
    await fetchUserSpaces(1, 1)
    const whereArg = payload.find.mock.calls[0][0].where
    expect(whereArg).toEqual({ tenant: { equals: 1 } })
  })

  it('deduplicates spaces', async () => {
    const space = makeSpace({ id: 5, tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([space, space]))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(1)
  })

  it('marks ai-bus space as isSystem=true', async () => {
    mockGetPayload.mockResolvedValue(makePayload([makeSpace({ id: 3, slug: 'ai-bus', tenant: 1 })]))
    const result = await fetchUserSpaces(1, 1)
    expect(result[0].isSystem).toBe(true)
  })

  it('marks non-ai-bus spaces as isSystem=false', async () => {
    mockGetPayload.mockResolvedValue(makePayload([makeSpace({ id: 4, slug: 'community', tenant: 1 })]))
    const result = await fetchUserSpaces(1, 1)
    expect(result[0].isSystem).toBe(false)
  })

  it('sorts ai-bus (system) space last', async () => {
    const regular = makeSpace({ id: 1, name: 'Alpha Space', slug: 'alpha', tenant: 1 })
    const aiBus = makeSpace({ id: 2, slug: 'ai-bus', name: 'AI Bus', tenant: 1 })
    mockResolve.mockResolvedValue([1, 2])
    mockGetPayload.mockResolvedValue(makePayload([aiBus, regular]))
    const result = await fetchUserSpaces(1, 1)
    expect(result[result.length - 1].isSystem).toBe(true)
  })

  it('sorts regular spaces alphabetically by name', async () => {
    const charlie = makeSpace({ id: 3, name: 'Charlie', slug: 'charlie', tenant: 1 })
    const alpha = makeSpace({ id: 1, name: 'Alpha', slug: 'alpha', tenant: 1 })
    const bravo = makeSpace({ id: 2, name: 'Bravo', slug: 'bravo', tenant: 1 })
    mockResolve.mockResolvedValue([1, 2, 3])
    mockGetPayload.mockResolvedValue(makePayload([charlie, alpha, bravo]))
    const result = await fetchUserSpaces(1, 1)
    expect(result.map(s => s.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('returns [] when payload throws', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB fail'))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toEqual([])
  })
})
