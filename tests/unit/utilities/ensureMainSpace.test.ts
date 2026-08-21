/**
 * ensureMainSpace — Unit Tests
 *
 * Tests the main community space provisioning utility:
 * - Creates space + 3 channels when none exists
 * - Returns existing space when isMain=true space already exists (idempotent)
 * - Self-heals missing channels on existing spaces
 * - Handles errors gracefully (non-fatal)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureMainSpace } from '@/utilities/ensureMainSpace'

// ── Helpers ─────────────────────────────────────────────────────────────────

let channelCreateCount = 0

function makePayload({
  spaceDocs = [],
  channelDocs = [],
  tenantDoc = { id: 1, name: 'TestCorp', slug: 'testcorp' },
}: {
  spaceDocs?: unknown[]
  channelDocs?: unknown[]
  tenantDoc?: unknown
} = {}) {
  channelCreateCount = 0
  return {
    find: vi.fn().mockImplementation((opts: { collection: string }) => {
      if (opts.collection === 'spaces') return Promise.resolve({ docs: spaceDocs })
      if (opts.collection === 'channels') return Promise.resolve({ docs: channelDocs })
      return Promise.resolve({ docs: [] })
    }),
    findByID: vi.fn().mockResolvedValue(tenantDoc),
    create: vi.fn().mockImplementation((opts: { collection: string; data: any }) => {
      if (opts.collection === 'spaces') {
        return Promise.resolve({ id: 'new-space-42' })
      }
      if (opts.collection === 'channels') {
        channelCreateCount++
        return Promise.resolve({ id: `ch-${channelCreateCount}` })
      }
      return Promise.resolve({ id: 'generic-id' })
    }),
    update: vi.fn().mockResolvedValue({}),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as any
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ensureMainSpace', () => {
  it('creates a new main space when none exists', async () => {
    const payload = makePayload()

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    expect(result).toBeDefined()
    expect(result!.spaceId).toBe('new-space-42')
    expect(result!.created).toBe(true)
    expect(result!.channelIds).toHaveLength(3) // main, announcements, support
    expect(result!.channelsCreated).toBe(3)
    expect(result!.channelErrors).toEqual([])

    // The space is always named "Community" (the tenant carries the brand name).
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'spaces',
        data: expect.objectContaining({
          name: 'Community',
          slug: 'community',
          visibility: 'community',
          isMain: true,
          tenant: 1,
        }),
      }),
    )
  })

  it('returns existing space without creating (idempotent)', async () => {
    const payload = makePayload({
      spaceDocs: [{ id: 'existing-space-99', isMain: true }],
      channelDocs: [
        { id: 'ch-1', slug: 'general', tenant: 1 },
        { id: 'ch-2', slug: 'announcements', tenant: 1 },
        { id: 'ch-3', slug: 'support', tenant: 1 },
      ],
    })

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    expect(result).toBeDefined()
    expect(result!.spaceId).toBe('existing-space-99')
    expect(result!.created).toBe(false)

    // Should NOT create a new space
    const spaceCreates = (payload.create as any).mock.calls.filter(
      (c: any) => c[0]?.collection === 'spaces',
    )
    expect(spaceCreates).toHaveLength(0)
  })

  it('creates 3 default channels (general, announcements, support)', async () => {
    const payload = makePayload()

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    expect(result!.channelIds).toHaveLength(3)

    // Verify each channel was created
    const channelCreates = (payload.create as any).mock.calls.filter(
      (c: any) => c[0]?.collection === 'channels',
    )
    expect(channelCreates).toHaveLength(3)

    const slugs = channelCreates.map((c: any) => c[0].data.slug)
    expect(slugs).toContain('main')
    expect(slugs).toContain('announcements')
    expect(slugs).toContain('support')

    // 'main' is the landing channel → isDefault=true
    const mainCreate = channelCreates.find((c: any) => c[0].data.slug === 'main')
    expect(mainCreate[0].data.isDefault).toBe(true)
  })

  it('self-heals missing channels on existing space', async () => {
    const payload = makePayload({
      spaceDocs: [{ id: 'existing-space-99', isMain: true, name: 'Community' }],
      channelDocs: [
        // Only has main, missing announcements and support
        { id: 'ch-1', slug: 'main', tenant: 1 },
      ],
    })

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    // Should create the 2 missing channels
    const channelCreates = (payload.create as any).mock.calls.filter(
      (c: any) => c[0]?.collection === 'channels',
    )
    expect(channelCreates).toHaveLength(2)
    expect(result!.channelsCreated).toBe(2)

    const slugs = channelCreates.map((c: any) => c[0].data.slug)
    expect(slugs).toContain('announcements')
    expect(slugs).toContain('support')
  })

  it('backfills missing tenant on existing channels', async () => {
    const payload = makePayload({
      spaceDocs: [{ id: 'existing-space-99', isMain: true, name: 'Community' }],
      channelDocs: [
        { id: 'ch-1', slug: 'main', tenant: null }, // Missing tenant
        { id: 'ch-2', slug: 'announcements', tenant: 1 },
        { id: 'ch-3', slug: 'support', tenant: 1 },
      ],
    })

    await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    // Should update the channel with missing tenant
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'channels',
        id: 'ch-1',
        data: { tenant: 1 },
      }),
    )
  })

  it('submits a NUMERIC space id on channel creates (the real fix)', async () => {
    // THE bug: the multi-tenant relationship validation matches channels.space
    // against numeric space ids in JS, so a STRING id silently fails "invalid:
    // Space". Every channel create must send a number.
    const payload = makePayload({
      spaceDocs: [{ id: '99', isMain: true, name: 'Community' }], // string id from find
      channelDocs: [],
    })

    await ensureMainSpace(payload, '7', 'TestCorp', 'testcorp')

    const channelCreates = (payload.create as any).mock.calls.filter((c: any) => c[0]?.collection === 'channels')
    expect(channelCreates.length).toBeGreaterThan(0)
    for (const call of channelCreates) {
      expect(typeof call[0].data.space).toBe('number')
      expect(call[0].data.space).toBe(99)
      expect(typeof call[0].data.tenant).toBe('number')
      expect(call[0].data.tenant).toBe(7)
      expect(call[0].overrideAccess).toBe(true)
    }
  })

  it('joins the request transaction when one is passed', async () => {
    const payload = makePayload()
    const req = { transactionID: 'tx-abc', user: null, payload }

    await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp', req)

    for (const call of (payload.create as any).mock.calls) {
      expect(call[0].req).toBe(req)
    }
  })

  it('surfaces channel-create errors instead of swallowing them', async () => {
    const payload = makePayload()
    payload.create = vi.fn().mockImplementation((opts: any) => {
      if (opts.collection === 'spaces') return Promise.resolve({ id: 'space-1' })
      if (opts.collection === 'channels' && opts.data.slug === 'support') {
        return Promise.reject(new Error('pool timeout'))
      }
      return Promise.resolve({ id: 'ch-x' })
    })

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    expect(result!.channelsCreated).toBe(2)
    expect(result!.channelErrors).toHaveLength(1)
    expect(result!.channelErrors[0]).toContain('support')
    expect(result!.channelErrors[0]).toContain('pool timeout')
  })

  it('resolves tenant name/slug from DB when not provided', async () => {
    const payload = makePayload({
      tenantDoc: { id: 5, name: 'ResolvedCorp', slug: 'resolved-corp' },
    })

    await ensureMainSpace(payload, 5)

    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        id: 5,
      }),
    )

    // Space name is always 'Community' regardless of tenant name.
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'spaces',
        data: expect.objectContaining({ name: 'Community', slug: 'community' }),
      }),
    )
  })

  it('handles errors gracefully (returns undefined)', async () => {
    const payload = {
      find: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      findByID: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      create: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      logger: { info: vi.fn(), warn: vi.fn() },
    } as any

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    expect(result).toBeUndefined()
    // Should not throw
  })

  it('handles channel creation failure without breaking', async () => {
    let callCount = 0
    const payload = makePayload()
    payload.create = vi.fn().mockImplementation((opts: any) => {
      if (opts.collection === 'spaces') return Promise.resolve({ id: 'space-1' })
      if (opts.collection === 'channels') {
        callCount++
        if (callCount === 2) return Promise.reject(new Error('Channel create failed'))
        return Promise.resolve({ id: `ch-${callCount}` })
      }
      return Promise.resolve({ id: 'x' })
    })

    const result = await ensureMainSpace(payload, 1, 'TestCorp', 'testcorp')

    // Should still return a result even though one channel failed
    expect(result).toBeDefined()
    expect(result!.spaceId).toBe('space-1')
    expect(result!.created).toBe(true)
    // 2 out of 3 channels succeeded
    expect(result!.channelIds).toHaveLength(2)
  })
})
