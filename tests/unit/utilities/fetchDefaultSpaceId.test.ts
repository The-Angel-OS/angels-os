/**
 * fetchDefaultSpaceId — Unit Tests
 *
 * Tests the Payload-backed space lookup and error-return paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(docs: unknown[]) {
  return { find: vi.fn().mockResolvedValue({ docs }) } as any
}

// ── fetchDefaultSpaceId ───────────────────────────────────────────────────────

describe('fetchDefaultSpaceId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the first space id as a string', async () => {
    mockGetPayload.mockResolvedValue(makePayload([{ id: 42 }]))
    const result = await fetchDefaultSpaceId(1)
    expect(result).toBe('42')
  })

  it('converts numeric id to string', async () => {
    mockGetPayload.mockResolvedValue(makePayload([{ id: 7 }]))
    const result = await fetchDefaultSpaceId(1)
    expect(typeof result).toBe('string')
    expect(result).toBe('7')
  })

  it('returns undefined when no spaces found', async () => {
    mockGetPayload.mockResolvedValue(makePayload([]))
    const result = await fetchDefaultSpaceId(1)
    expect(result).toBeUndefined()
  })

  it('returns undefined when payload.find throws', async () => {
    mockGetPayload.mockResolvedValue({
      find: vi.fn().mockRejectedValue(new Error('DB fail')),
    } as any)
    const result = await fetchDefaultSpaceId(1)
    expect(result).toBeUndefined()
  })

  it('accepts tenantId as string', async () => {
    mockGetPayload.mockResolvedValue(makePayload([{ id: 10 }]))
    const result = await fetchDefaultSpaceId('5')
    expect(result).toBe('10')
  })

  it('queries by the provided tenantId', async () => {
    const payload = makePayload([{ id: 1 }])
    mockGetPayload.mockResolvedValue(payload)
    await fetchDefaultSpaceId(99)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant: { equals: 99 } },
      }),
    )
  })

  it('uses sort createdAt to get the oldest (primary) space', async () => {
    const payload = makePayload([{ id: 1 }])
    mockGetPayload.mockResolvedValue(payload)
    await fetchDefaultSpaceId(1)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'createdAt' }),
    )
  })
})
