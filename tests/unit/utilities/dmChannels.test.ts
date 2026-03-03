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

import { findOrCreateDM } from '@/utilities/dmChannels'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload({
  existingChannels = [],
  createReturn = { id: 'new-dm-ch' },
  userAReturn = { id: 1, name: 'Alice' },
  userBReturn = { id: 2, name: 'Bob' },
}: {
  existingChannels?: unknown[]
  createReturn?: unknown
  userAReturn?: unknown
  userBReturn?: unknown
} = {}) {
  let findByIDCallCount = 0
  return {
    find: vi.fn().mockResolvedValue({ docs: existingChannels }),
    findByID: vi.fn().mockImplementation(() => {
      findByIDCallCount++
      return Promise.resolve(findByIDCallCount === 1 ? userAReturn : userBReturn)
    }),
    create: vi.fn().mockResolvedValue(createReturn),
    delete: vi.fn().mockResolvedValue({}),
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

  it('deletes duplicate channels and returns the canonical one', async () => {
    const payload = makePayload({
      existingChannels: [
        { id: 'dm-canonical' },
        { id: 'dm-duplicate-1' },
        { id: 'dm-duplicate-2' },
      ],
    })
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateDM(1, 'dm-sp', 1, 2)
    expect(result.channelId).toBe('dm-canonical')
    expect(payload.delete).toHaveBeenCalledTimes(2)
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
