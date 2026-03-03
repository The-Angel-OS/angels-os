import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findExistingChannel,
  createChannelIfNotExists,
  getEssentialChannels,
  cleanupDuplicateChannels,
} from '@/utilities/channel-deduplication'

// ── Helpers ────────────────────────────────────────────────────────────

function makePayload(docs: any[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs }),
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

// ── findExistingChannel ────────────────────────────────────────────────

describe('findExistingChannel', () => {
  it('returns the first doc if found', async () => {
    const channel = { id: 'ch-1', name: 'main', tenantId: 't1' }
    const payload = makePayload([channel])
    const result = await findExistingChannel(payload as any, { name: 'main', tenantId: 't1' })
    expect(result).toEqual(channel)
  })

  it('returns null when no channel found', async () => {
    const payload = makePayload([])
    const result = await findExistingChannel(payload as any, { name: 'main', tenantId: 't1' })
    expect(result).toBeNull()
  })

  it('includes type filter when provided', async () => {
    const payload = makePayload([])
    await findExistingChannel(payload as any, { name: 'main', tenantId: 't1', type: 'chat' })
    const call = (payload.find as any).mock.calls[0][0]
    const conditions = call.where.and
    expect(conditions).toContainEqual({ channelType: { equals: 'chat' } })
  })

  it('omits type filter when not provided', async () => {
    const payload = makePayload([])
    await findExistingChannel(payload as any, { name: 'main', tenantId: 't1' })
    const call = (payload.find as any).mock.calls[0][0]
    const conditions = call.where.and
    expect(conditions).not.toContainEqual(expect.objectContaining({ channelType: expect.anything() }))
  })

  it('returns null on payload error (fail-open)', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('DB error')) }
    const result = await findExistingChannel(payload as any, { name: 'main', tenantId: 't1' })
    expect(result).toBeNull()
  })
})

// ── createChannelIfNotExists ───────────────────────────────────────────

describe('createChannelIfNotExists', () => {
  it('returns existing channel without creating a new one', async () => {
    const existing = { id: 'ch-1', name: 'main', tenantId: 't1', channelType: 'chat' }
    const payload = makePayload([existing])
    const result = await createChannelIfNotExists(payload as any, {
      name: 'main',
      tenantId: 't1',
      channelType: 'chat',
    })
    expect(result).toEqual(existing)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates a new channel when none exists', async () => {
    const payload = makePayload([]) // no existing channels
    const channelData = { name: 'support', tenantId: 't2', channelType: 'chat' }
    const result = await createChannelIfNotExists(payload as any, channelData)
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'channels',
      data: channelData,
    })
    expect(result).toMatchObject(channelData)
  })
})

// ── getEssentialChannels ───────────────────────────────────────────────

describe('getEssentialChannels', () => {
  it('returns 2 channels for a tenant', () => {
    const channels = getEssentialChannels('tenant-abc')
    expect(channels).toHaveLength(2)
  })

  it('includes main and system channels', () => {
    const channels = getEssentialChannels('t1')
    const names = channels.map((c) => c.name)
    expect(names).toContain('main')
    expect(names).toContain('system')
  })

  it('sets the tenantId on all channels', () => {
    const tenantId = 'tenant-xyz'
    const channels = getEssentialChannels(tenantId)
    for (const ch of channels) {
      expect(ch.tenantId).toBe(tenantId)
    }
  })

  it('marks all channels as system channels', () => {
    const channels = getEssentialChannels('t1')
    for (const ch of channels) {
      expect(ch.isSystem).toBe(true)
    }
  })

  it('sets channelType to chat on all channels', () => {
    const channels = getEssentialChannels('t1')
    for (const ch of channels) {
      expect(ch.channelType).toBe('chat')
    }
  })

  it('accepts optional spaceId without error', () => {
    expect(() => getEssentialChannels('t1', 'space-99')).not.toThrow()
  })
})

// ── cleanupDuplicateChannels ───────────────────────────────────────────

describe('cleanupDuplicateChannels', () => {
  it('does nothing when no duplicates exist', async () => {
    const channels = [
      { id: 'ch-1', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-01' },
      { id: 'ch-2', name: 'system', type: 'chat', tenantId: 't1', createdAt: '2024-01-02' },
    ]
    const payload = makePayload(channels)
    await cleanupDuplicateChannels(payload as any, 't1')
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('deletes newer duplicate channels, keeping the oldest', async () => {
    const channels = [
      { id: 'ch-1', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-01' },
      { id: 'ch-2', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-02' }, // duplicate
      { id: 'ch-3', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-03' }, // duplicate
    ]
    const payload = makePayload(channels)
    await cleanupDuplicateChannels(payload as any, 't1')

    // Should delete 2 duplicates (ch-2 and ch-3), keeping ch-1 (oldest)
    expect(payload.delete).toHaveBeenCalledTimes(2)
    const deletedIds = (payload.delete as any).mock.calls.map((c: any) => c[0].id)
    expect(deletedIds).toContain('ch-2')
    expect(deletedIds).toContain('ch-3')
    expect(deletedIds).not.toContain('ch-1')
  })

  it('keeps one channel when exactly one duplicate exists', async () => {
    const channels = [
      { id: 'ch-1', name: 'main', type: 'general', tenantId: 't1', createdAt: '2024-01-01' },
      { id: 'ch-2', name: 'main', type: 'general', tenantId: 't1', createdAt: '2024-01-02' },
    ]
    const payload = makePayload(channels)
    await cleanupDuplicateChannels(payload as any, 't1')

    expect(payload.delete).toHaveBeenCalledTimes(1)
    const deleted = (payload.delete as any).mock.calls[0][0]
    expect(deleted.id).toBe('ch-2') // newer is deleted
  })

  it('continues cleanup if one delete fails', async () => {
    const channels = [
      { id: 'ch-1', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-01' },
      { id: 'ch-2', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-02' },
      { id: 'ch-3', name: 'main', type: 'chat', tenantId: 't1', createdAt: '2024-01-03' },
    ]
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: channels }),
      delete: vi.fn()
        .mockRejectedValueOnce(new Error('DB failure')) // ch-2 fails
        .mockResolvedValue(undefined),                  // ch-3 succeeds
    }
    // Should not throw — cleanup is best-effort
    await expect(cleanupDuplicateChannels(payload as any, 't1')).resolves.toBeUndefined()
    expect(payload.delete).toHaveBeenCalledTimes(2)
  })
})
