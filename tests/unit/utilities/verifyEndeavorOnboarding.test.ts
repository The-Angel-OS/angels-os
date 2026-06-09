/**
 * verifyEndeavorOnboarding — focus on the member-backfill orchestration.
 * The heavy space-creation helpers (which boot Payload internally) are mocked;
 * we assert the verifier joins every active member to every space it's missing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/ensureTenantDefaults', () => ({
  ensureTenantDefaults: vi.fn(async () => ({
    aiBusSpaceId: 'ai',
    mainSpaceId: 'main',
    dmSpaceId: 'dm',
    errors: [],
  })),
}))
vi.mock('@/utilities/ensureSystemSpace', () => ({
  resolveAiBusSpaceId: vi.fn(async () => 'ai'),
}))
vi.mock('@/utilities/ensurePageChannel', () => ({
  reparentPageChannelsToAiBus: vi.fn(async () => 2),
}))

import { verifyEndeavorOnboarding } from '@/utilities/verifyEndeavorOnboarding'

/**
 * Mock payload:
 *  - spaces query → `spaces`
 *  - tenant-memberships query → `members` (active)
 *  - space-memberships query → the memberships `existingBySpace[userId]` already has
 *  - create(space-memberships) → recorded
 */
function makePayload(opts: {
  spaces: Array<{ id: number | string }>
  members: Array<{ user: unknown }>
  existingByUser: Record<string, Array<number | string>>
}) {
  const created: Array<{ user: unknown; space: unknown }> = []
  const payload: any = {
    created,
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'spaces') return { docs: opts.spaces }
      if (collection === 'tenant-memberships') return { docs: opts.members }
      if (collection === 'space-memberships') {
        const userId = where?.and?.find((c: any) => c.user?.equals)?.user?.equals
        const joined = opts.existingByUser[String(userId)] || []
        return { docs: joined.map((space) => ({ space })) }
      }
      return { docs: [] }
    }),
    create: vi.fn(async ({ data }: any) => {
      created.push({ user: data.user, space: data.space })
      return { id: created.length }
    }),
  }
  return payload
}

describe('verifyEndeavorOnboarding — member backfill', () => {
  beforeEach(() => vi.clearAllMocks())

  it('joins each active member only to spaces they are missing', async () => {
    const payload = makePayload({
      spaces: [{ id: 1 }, { id: 2 }, { id: 3 }],
      members: [{ user: 10 }, { user: 20 }],
      existingByUser: { '10': [1], '20': [] }, // user 10 in space 1; user 20 in none
    })

    const r = await verifyEndeavorOnboarding(payload, 99)

    // user 10 missing 2,3 (2 creates); user 20 missing 1,2,3 (3 creates) = 5
    expect(r.membersBackfilled).toBe(5)
    expect(r.spacesCount).toBe(3)
    expect(r.membersCount).toBe(2)
    expect(r.pageChannelsReparented).toBe(2)
    expect(r.errors).toEqual([])
    expect(payload.created).toContainEqual({ user: 10, space: 2 })
    expect(payload.created).toContainEqual({ user: 20, space: 1 })
    expect(payload.created).not.toContainEqual({ user: 10, space: 1 }) // already joined
  })

  it('backfills nothing when every member is already in every space', async () => {
    const payload = makePayload({
      spaces: [{ id: 1 }, { id: 2 }],
      members: [{ user: 10 }],
      existingByUser: { '10': [1, 2] },
    })
    const r = await verifyEndeavorOnboarding(payload, 99)
    expect(r.membersBackfilled).toBe(0)
    expect(payload.created.length).toBe(0)
  })

  it('resolves a populated (object) member.user relationship', async () => {
    const payload = makePayload({
      spaces: [{ id: 1 }],
      members: [{ user: { id: 42 } }],
      existingByUser: { '42': [] },
    })
    const r = await verifyEndeavorOnboarding(payload, 99)
    expect(r.membersBackfilled).toBe(1)
    expect(payload.created).toContainEqual({ user: 42, space: 1 })
  })
})
