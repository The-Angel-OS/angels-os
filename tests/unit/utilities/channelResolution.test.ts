/**
 * channel-resolution — Unit Tests
 *
 * Tests findOrCreateChannel (find existing, create new, channelType mapping)
 * and getSystemChannel (wrapper).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { findOrCreateChannel, getSystemChannel } from '@/utilities/channel-resolution'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(channelDocs: unknown[] = [], createReturn: unknown = { id: 'ch-new' }) {
  return {
    find: vi.fn().mockResolvedValue({ docs: channelDocs }),
    create: vi.fn().mockResolvedValue(createReturn),
  } as any
}

const BASE_OPTS = {
  name: 'Test Channel',
  channelType: 'chat' as const,
  reportType: 'general' as const,
  tenantId: 1,
  spaceId: 10,
}

// ── findOrCreateChannel ───────────────────────────────────────────────────────

describe('findOrCreateChannel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns existing channel without creating a new one', async () => {
    const existing = { id: 'ch-existing', name: 'Test Channel' }
    const payload = makePayload([existing])
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateChannel(BASE_OPTS)
    expect(result).toEqual(existing)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates a new channel when none found', async () => {
    const payload = makePayload([], { id: 'ch-new-123' })
    mockGetPayload.mockResolvedValue(payload)
    const result = await findOrCreateChannel(BASE_OPTS)
    expect(result.id).toBe('ch-new-123')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'channels',
        data: expect.objectContaining({ name: 'Test Channel', space: 10 }),
      }),
    )
  })

  it('maps channelType "chat" to payload type "general"', async () => {
    const payload = makePayload([], { id: 'new' })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateChannel({ ...BASE_OPTS, channelType: 'chat' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'general' }) }),
    )
  })

  it('maps channelType "photo_analysis" to payload type "inventory"', async () => {
    const payload = makePayload([], { id: 'new' })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateChannel({ ...BASE_OPTS, channelType: 'photo_analysis' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'inventory' }) }),
    )
  })

  it('maps channelType "document_processing" to payload type "pdf"', async () => {
    const payload = makePayload([], { id: 'new' })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateChannel({ ...BASE_OPTS, channelType: 'document_processing' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'pdf' }) }),
    )
  })

  it('slugifies the channel name correctly', async () => {
    const payload = makePayload([], { id: 'new' })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateChannel({ ...BASE_OPTS, name: 'My New Channel 123' })
    const createData = payload.create.mock.calls[0][0].data
    expect(createData.slug).toBe('my-new-channel-123')
  })

  it('removes special characters from slug', async () => {
    const payload = makePayload([], { id: 'new' })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateChannel({ ...BASE_OPTS, name: 'Channel!@#$' })
    const createData = payload.create.mock.calls[0][0].data
    expect(createData.slug).toBe('channel')
  })

  it('falls back to "channel" slug when name becomes empty', async () => {
    const payload = makePayload([], { id: 'new' })
    mockGetPayload.mockResolvedValue(payload)
    await findOrCreateChannel({ ...BASE_OPTS, name: '!!!@@@###' })
    const createData = payload.create.mock.calls[0][0].data
    expect(createData.slug).toBe('channel')
  })

  it('throws when payload.find fails', async () => {
    mockGetPayload.mockResolvedValue({
      find: vi.fn().mockRejectedValue(new Error('DB fail')),
    } as any)
    await expect(findOrCreateChannel(BASE_OPTS)).rejects.toThrow('Failed to find or create channel')
  })
})

// ── getSystemChannel ──────────────────────────────────────────────────────────

describe('getSystemChannel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls findOrCreateChannel with name "system"', async () => {
    const payload = makePayload([], { id: 'system-ch' })
    mockGetPayload.mockResolvedValue(payload)
    const result = await getSystemChannel(1, 5)
    expect(result.id).toBe('system-ch')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'system' }),
      }),
    )
  })

  it('uses default tenantId=1 and spaceId=1 when not provided', async () => {
    const payload = makePayload([], { id: 'system-ch' })
    mockGetPayload.mockResolvedValue(payload)
    await getSystemChannel()
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({ space: { equals: 1 } }),
          ]),
        }),
      }),
    )
  })
})
