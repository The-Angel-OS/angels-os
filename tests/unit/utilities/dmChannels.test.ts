/**
 * dmChannels (findOrCreateDM) — Unit Tests
 *
 * Tests deterministic slug generation, find-existing, create-new,
 * duplicate cleanup, and race-condition retry paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpaceMembership: vi.fn().mockResolvedValue(undefined),
}))

import { findOrCreateDM, mergeDmChannelGroup } from '@/utilities/dmChannels'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload({
  existingChannels = [],
  createReturn = { id: 'new-dm-ch' },
  userAReturn = { id: 1, name: 'Alice' },
  userBReturn = { id: 2, name: 'Bob' },
  messageCounts = {},
}: {
  existingChannels?: unknown[]
  createReturn?: unknown
  userAReturn?: unknown
  userBReturn?: unknown
  /** channelId → message count, consumed by the merge's payload.count */
  messageCounts?: Record<string, number>
} = {}) {
  let findByIDCallCount = 0
  return {
    find: vi.fn().mockImplementation(({ collection, where }: any) => {
      if (collection === 'messages') {
        // The merge's target query: synthesize one message id per counted message
        const refEq = where?.channelRef?.equals ?? where?.or?.[0]?.channelRef?.equals
        const n = messageCounts[String(refEq)] ?? 0
        return Promise.resolve({
          docs: Array.from({ length: n }, (_, i) => ({ id: `msg-${refEq}-${i}` })),
        })
      }
      return Promise.resolve({ docs: existingChannels })
    }),
    findByID: vi.fn().mockImplementation(() => {
      findByIDCallCount++
      return Promise.resolve(findByIDCallCount === 1 ? userAReturn : userBReturn)
    }),
    create: vi.fn().mockResolvedValue(createReturn),
    delete: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({ docs: [] }),
    count: vi.fn().mockImplementation(({ where }: any) =>
      Promise.resolve({ totalDocs: messageCounts[String(where?.channelRef?.equals)] ?? 0 }),
    ),
  } as any
}

// ── Slug generation ────────────────────────────────────────────────────────────

describe('findOrCreateDM — slug generation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('generates "dm-{userId}-leo" for LEO DMs', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateDM(1, 'dm-sp', 42, 'leo')
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ slug: { equals: 'dm-42-leo' } }]),
        }),
      }),
    )
  })

  it('generates sorted slug for user-to-user DMs (lower id first)', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateDM(1, 'dm-sp', 5, 3)
    // 3 < 5 so slug should be dm-3-5
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ slug: { equals: 'dm-3-5' } }]),
        }),
      }),
    )
  })

  it('produces same slug regardless of argument order', async () => {
    const p1 = makePayload()
    const p2 = makePayload()
    mockGetPayload.mockResolvedValueOnce(p1).mockResolvedValueOnce(p2)
    await findOrCreateDM(1, 'dm-sp', 5, 3)
    await findOrCreateDM(1, 'dm-sp', 3, 5)
    const slug1 = p1.find.mock.calls[0][0].where.and.find(
      (c: any) => c.slug,
    )?.slug?.equals
    const slug2 = p2.find.mock.calls[0][0].where.and.find(
      (c: any) => c.slug,
    )?.slug?.equals
    expect(slug1).toBe(slug2)
  })
})

// ── find existing ─────────────────────────────────────────────────────────────

describe('findOrCreateDM — existing channel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns existing channel without creating a new one', async () => {
    const payload = makePayload({ existingChannels: [{ id: 'existing-dm' }] })
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateDM(1, 'dm-sp', 1, 2)
    expect(result.channelId).toBe('existing-dm')
    expect(result.isNew).toBe(false)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('merges duplicate channels into the one with the most messages', async () => {
    // Per-tenant legacy dupes: the richest thread wins; the others' messages
    // are repointed onto it BEFORE their rows are deleted.
    const payload = makePayload({
      existingChannels: [
        { id: 'dm-t1', slug: 'dm-1-2', space: 30, members: [1, 2], createdAt: '2026-01-01' },
        { id: 'dm-t5', slug: 'dm-1-2', space: 18, members: [1, 2], createdAt: '2026-02-01' },
        { id: 'dm-t7', slug: 'dm-1-2', space: 19, members: [1, 2], createdAt: '2026-03-01' },
      ],
      messageCounts: { 'dm-t5': 94, 'dm-t1': 37, 'dm-t7': 0 },
    })
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateDM(1, 'dm-sp', 1, 2)
    expect(result.channelId).toBe('dm-t5')
    expect(payload.delete).toHaveBeenCalledTimes(2)
    // Messages repointed BY ID to the canonical thread (channelRef + space) —
    // never by a relationship-field where (Payload bulk update matches nothing).
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'messages',
        id: 'msg-dm-t1-0',
        data: expect.objectContaining({ channelRef: 'dm-t5', space: 18 }),
      }),
    )
    const messageUpdates = payload.update.mock.calls.filter(
      (c: any) => c[0].collection === 'messages',
    )
    expect(messageUpdates).toHaveLength(37) // every dm-t1 message moved (dm-t7 had none)
  })

  it('looks up the DM globally — no tenant constraint in the where', async () => {
    const payload = makePayload({ existingChannels: [{ id: 'existing-dm' }] })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateDM(1, 'dm-sp', 1, 2)
    const where = payload.find.mock.calls[0][0].where
    expect(JSON.stringify(where)).not.toContain('tenant')
  })
})

// ── mergeDmChannelGroup ────────────────────────────────────────────────────────

describe('mergeDmChannelGroup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('ties break to the oldest channel', async () => {
    const payload = makePayload({ messageCounts: {} })
    const report = await mergeDmChannelGroup(
      payload,
      [
        { id: 'newer', slug: 'dm-9-leo', space: 2, members: [9], createdAt: '2026-06-01' },
        { id: 'older', slug: 'dm-9-leo', space: 1, members: [9], createdAt: '2026-01-01' },
      ],
      true,
    )
    expect(report?.canonicalId).toBe('older')
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'channels', id: 'newer' }),
    )
  })

  it('dry-run reports without writing', async () => {
    const payload = makePayload({ messageCounts: { a: 5, b: 1 } })
    const report = await mergeDmChannelGroup(
      payload,
      [
        { id: 'a', slug: 'dm-1-leo', space: 1, members: [1], createdAt: '2026-01-01' },
        { id: 'b', slug: 'dm-1-leo', space: 2, members: [1], createdAt: '2026-02-01' },
      ],
      false,
    )
    expect(report?.canonicalId).toBe('a')
    expect(report?.merged).toEqual([{ channelId: 'b', messagesMoved: 1 }])
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('unions members from merged dupes onto the canonical', async () => {
    const payload = makePayload({ messageCounts: { keep: 3 } })
    await mergeDmChannelGroup(
      payload,
      [
        { id: 'keep', slug: 'dm-1-2', space: 1, members: [1], createdAt: '2026-01-01' },
        { id: 'drop', slug: 'dm-1-2', space: 2, members: [1, 2], createdAt: '2026-02-01' },
      ],
      true,
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'channels',
        id: 'keep',
        data: expect.objectContaining({ members: expect.arrayContaining([1, 2]) }),
      }),
    )
  })
})

// ── create new ────────────────────────────────────────────────────────────────

describe('findOrCreateDM — create new', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates DM channel with correct type and returns isNew=true', async () => {
    const payload = makePayload({ existingChannels: [] })
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateDM(1, 'dm-sp', 1, 'leo')
    expect(result.isNew).toBe(true)
    expect(result.channelId).toBe('new-dm-ch')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'dm' }),
      }),
    )
  })

  it('includes only the human user in members for LEO DMs', async () => {
    const payload = makePayload({ existingChannels: [] })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateDM(1, 'dm-sp', 7, 'leo')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ members: [7] }),
      }),
    )
  })

  it('includes both users in members for user-to-user DMs', async () => {
    const payload = makePayload({ existingChannels: [] })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateDM(1, 'dm-sp', 3, 5)
    const created = payload.create.mock.calls[0][0].data
    expect(created.members).toContain(3)
    expect(created.members).toContain(5)
  })

  it('returns existing channel if create fails due to race condition', async () => {
    let findCallCount = 0
    const payload = {
      find: vi.fn().mockImplementation(() => {
        findCallCount++
        // First call: no existing; second call (retry): channel exists
        return Promise.resolve({ docs: findCallCount > 1 ? [{ id: 'race-winner' }] : [] })
      }),
      findByID: vi.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
      create: vi.fn().mockRejectedValue(new Error('duplicate key')),
      delete: vi.fn(),
    } as any
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateDM(1, 'dm-sp', 1, 'leo')
    expect(result.channelId).toBe('race-winner')
    expect(result.isNew).toBe(false)
  })
})
