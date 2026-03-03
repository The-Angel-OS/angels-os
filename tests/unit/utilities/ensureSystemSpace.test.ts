/**
 * ensureSystemSpace — Unit Tests
 *
 * Tests constants, ensureSystemSpace (create vs. existing space),
 * ensureDMSpace, and ensureDMSpaceMembership.
 *
 * Uses lazy-import dynamic mock pattern for 'payload' and '@payload-config'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import {
  AI_BUS_SPACE_SLUG,
  AI_BUS_SPACE_NAME,
  DM_SPACE_SLUG,
  DM_SPACE_NAME,
  ensureSystemSpace,
  ensureDMSpace,
  ensureDMSpaceMembership,
} from '@/utilities/ensureSystemSpace'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload({
  spaceDocs = [],
  channelDocs = [],
  createSpaceReturn = { id: 'new-space-id' },
}: {
  spaceDocs?: unknown[]
  channelDocs?: unknown[]
  createSpaceReturn?: unknown
} = {}) {
  return {
    find: vi.fn().mockImplementation((opts: { collection: string }) => {
      if (opts.collection === 'spaces') return Promise.resolve({ docs: spaceDocs })
      if (opts.collection === 'channels') return Promise.resolve({ docs: channelDocs })
      if (opts.collection === 'space-memberships') return Promise.resolve({ docs: [] })
      return Promise.resolve({ docs: [] })
    }),
    create: vi.fn().mockResolvedValue(createSpaceReturn),
    update: vi.fn().mockResolvedValue({}),
  } as any
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe('Exported constants', () => {
  it('AI_BUS_SPACE_SLUG is "ai-bus"', () => {
    expect(AI_BUS_SPACE_SLUG).toBe('ai-bus')
  })

  it('AI_BUS_SPACE_NAME is "AI Bus"', () => {
    expect(AI_BUS_SPACE_NAME).toBe('AI Bus')
  })

  it('DM_SPACE_SLUG is "direct-messages"', () => {
    expect(DM_SPACE_SLUG).toBe('direct-messages')
  })

  it('DM_SPACE_NAME is "Direct Messages"', () => {
    expect(DM_SPACE_NAME).toBe('Direct Messages')
  })
})

// ── ensureSystemSpace ─────────────────────────────────────────────────────────

describe('ensureSystemSpace', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns existing space ID without creating a new space', async () => {
    const payload = makePayload({ spaceDocs: [{ id: 'existing-space-42' }] })
    mockGetPayload.mockResolvedValue(payload)
    const result = await ensureSystemSpace(1)
    expect(result).toBe('existing-space-42')
    expect(payload.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'spaces' }),
    )
  })

  it('creates a new AI Bus space when none exists', async () => {
    const payload = makePayload({ spaceDocs: [], createSpaceReturn: { id: 'new-ai-bus' } })
    mockGetPayload.mockResolvedValue(payload)
    const result = await ensureSystemSpace(1)
    expect(result).toBe('new-ai-bus')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'spaces',
        data: expect.objectContaining({ slug: 'ai-bus' }),
      }),
    )
  })

  it('returns space ID as string even when stored as number', async () => {
    const payload = makePayload({ spaceDocs: [{ id: 99 }] })
    mockGetPayload.mockResolvedValue(payload)
    const result = await ensureSystemSpace(1)
    expect(result).toBe('99')
  })

  it('returns undefined when payload throws', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB fail'))
    const result = await ensureSystemSpace(1)
    expect(result).toBeUndefined()
  })

  it('creates missing channels after finding existing space', async () => {
    const payload = makePayload({ spaceDocs: [{ id: 'sp-1' }], channelDocs: [] })
    mockGetPayload.mockResolvedValue(payload)
    await ensureSystemSpace(1)
    // Should create channels (leo, general, support, errors, system-log, email-inbox)
    const channelCreates = payload.create.mock.calls.filter(
      (c: any) => c[0].collection === 'channels',
    )
    expect(channelCreates.length).toBeGreaterThan(0)
  })

  it('backfills tenant on orphaned channels missing tenant', async () => {
    const orphanedChannel = { id: 'ch-1', slug: 'leo', tenant: null }
    const payload = makePayload({
      spaceDocs: [{ id: 'sp-1' }],
      channelDocs: [orphanedChannel],
    })
    mockGetPayload.mockResolvedValue(payload)
    await ensureSystemSpace(1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'channels',
        id: 'ch-1',
        data: expect.objectContaining({ tenant: 1 }),
      }),
    )
  })
})

// ── ensureDMSpace ─────────────────────────────────────────────────────────────

describe('ensureDMSpace', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns existing DM space ID', async () => {
    const payload = makePayload({ spaceDocs: [{ id: 'dm-space-7' }] })
    mockGetPayload.mockResolvedValue(payload)
    const result = await ensureDMSpace(1)
    expect(result).toBe('dm-space-7')
  })

  it('creates DM space when none exists', async () => {
    const payload = makePayload({ spaceDocs: [], createSpaceReturn: { id: 'new-dm' } })
    mockGetPayload.mockResolvedValue(payload)
    const result = await ensureDMSpace(1)
    expect(result).toBe('new-dm')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'direct-messages' }),
      }),
    )
  })

  it('returns undefined when payload throws', async () => {
    mockGetPayload.mockRejectedValue(new Error('fail'))
    const result = await ensureDMSpace(1)
    expect(result).toBeUndefined()
  })
})

// ── ensureDMSpaceMembership ───────────────────────────────────────────────────

describe('ensureDMSpaceMembership', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates membership when none exists', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await ensureDMSpaceMembership(42, 'dm-sp', 1)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'space-memberships',
        data: expect.objectContaining({ user: 42, role: 'member' }),
      }),
    )
  })

  it('does not create membership when one already exists', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'existing-membership' }] }),
      create: vi.fn(),
      update: vi.fn(),
    } as any
    mockGetPayload.mockResolvedValue(payload)
    await ensureDMSpaceMembership(42, 'dm-sp', 1)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('does not throw when payload fails', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB fail'))
    await expect(ensureDMSpaceMembership(42, 'dm-sp', 1)).resolves.not.toThrow()
  })
})
