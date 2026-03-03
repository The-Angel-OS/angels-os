/**
 * fetchUserSpaces — Unit Tests
 *
 * Tests membership filtering, tenant scoping, deduplication,
 * public/ai-bus fallback inclusion, and sort order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { fetchUserSpaces } from '@/utilities/fetchUserSpaces'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

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

function makeMembership(space: unknown) {
  return { id: 'm1', status: 'active', space }
}

function makePayload(memberships: unknown[] = [], tenantSpaces: unknown[] = []) {
  let callIndex = 0
  return {
    find: vi.fn().mockImplementation(() => {
      callIndex++
      if (callIndex === 1) return Promise.resolve({ docs: memberships })
      return Promise.resolve({ docs: tenantSpaces })
    }),
  } as any
}

// ── fetchUserSpaces ───────────────────────────────────────────────────────────

describe('fetchUserSpaces', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array when user has no memberships', async () => {
    mockGetPayload.mockResolvedValue(makePayload([], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toEqual([])
  })

  it('returns serialized spaces from active memberships', async () => {
    const space = makeSpace({ id: 10, name: 'The Hub', slug: 'hub', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([makeMembership(space)], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('The Hub')
    expect(result[0].id).toBe('10')
  })

  it('filters out spaces that belong to a different tenant', async () => {
    const space = makeSpace({ id: 10, name: 'Other Tenant Space', slug: 'other', tenant: 99 })
    mockGetPayload.mockResolvedValue(makePayload([makeMembership(space)], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(0)
  })

  it('deduplicates spaces when user has multiple memberships to same space', async () => {
    const space = makeSpace({ id: 5, tenant: 1 })
    mockGetPayload.mockResolvedValue(
      makePayload([makeMembership(space), makeMembership(space)], []),
    )
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(1)
  })

  it('skips membership docs where space is not populated (primitive)', async () => {
    // space is a number, not a populated object
    mockGetPayload.mockResolvedValue(makePayload([{ id: 'm1', space: 42 }], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(0)
  })

  it('marks ai-bus space as isSystem=true', async () => {
    const space = makeSpace({ id: 3, slug: 'ai-bus', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([makeMembership(space)], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result[0].isSystem).toBe(true)
  })

  it('marks non-ai-bus spaces as isSystem=false', async () => {
    const space = makeSpace({ id: 4, slug: 'community', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([makeMembership(space)], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result[0].isSystem).toBe(false)
  })

  it('adds public tenant spaces not in memberships', async () => {
    const publicSpace = makeSpace({ id: 20, name: 'Public Hub', slug: 'public-hub', visibility: 'public', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([], [publicSpace]))
    const result = await fetchUserSpaces(1, 1)
    expect(result.some(s => s.id === '20')).toBe(true)
  })

  it('adds ai-bus tenant space even if visibility is invite_only', async () => {
    const aiBusSpace = makeSpace({ id: 21, slug: 'ai-bus', visibility: 'invite_only', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([], [aiBusSpace]))
    const result = await fetchUserSpaces(1, 1)
    expect(result.some(s => s.slug === 'ai-bus')).toBe(true)
  })

  it('does not add invite-only non-ai-bus tenant spaces', async () => {
    const privateSpace = makeSpace({ id: 22, slug: 'private-club', visibility: 'invite_only', tenant: 1 })
    mockGetPayload.mockResolvedValue(makePayload([], [privateSpace]))
    const result = await fetchUserSpaces(1, 1)
    expect(result.some(s => s.id === '22')).toBe(false)
  })

  it('sorts ai-bus (system) space last', async () => {
    const regular = makeSpace({ id: 1, name: 'Alpha Space', slug: 'alpha', tenant: 1 })
    const aiBus = makeSpace({ id: 2, slug: 'ai-bus', name: 'AI Bus', tenant: 1 })
    mockGetPayload.mockResolvedValue(
      makePayload([makeMembership(aiBus), makeMembership(regular)], []),
    )
    const result = await fetchUserSpaces(1, 1)
    expect(result[result.length - 1].isSystem).toBe(true)
  })

  it('sorts regular spaces alphabetically by name', async () => {
    const charlie = makeSpace({ id: 3, name: 'Charlie', slug: 'charlie', tenant: 1 })
    const alpha = makeSpace({ id: 1, name: 'Alpha', slug: 'alpha', tenant: 1 })
    const bravo = makeSpace({ id: 2, name: 'Bravo', slug: 'bravo', tenant: 1 })
    mockGetPayload.mockResolvedValue(
      makePayload([makeMembership(charlie), makeMembership(alpha), makeMembership(bravo)], []),
    )
    const result = await fetchUserSpaces(1, 1)
    expect(result.map(s => s.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('returns [] when payload throws', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB fail'))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toEqual([])
  })

  it('handles tenant stored as object with id property', async () => {
    const space = makeSpace({ id: 10, name: 'The Hub', slug: 'hub', tenant: { id: 1 } })
    mockGetPayload.mockResolvedValue(makePayload([makeMembership(space)], []))
    const result = await fetchUserSpaces(1, 1)
    expect(result).toHaveLength(1)
  })
})
