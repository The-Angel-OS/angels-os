/**
 * fetchTenantBySlug — Unit Tests
 *
 * Tests the Payload-backed tenant lookup, cache hit, and error fallback paths.
 * The in-process cache is mocked to provide full control over hit/miss scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/utilities/tenantCache', () => ({
  tenantBySlugCache: { get: vi.fn(), set: vi.fn() },
  tenantByDomainCache: { get: vi.fn(), set: vi.fn() },
}))

import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { getPayload } from 'payload'
import { tenantBySlugCache } from '@/utilities/tenantCache'

const mockGetPayload = vi.mocked(getPayload)
const mockCache = vi.mocked(tenantBySlugCache)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(docs: unknown[]) {
  return { find: vi.fn().mockResolvedValue({ docs }) } as any
}

const TENANT = { id: 1, slug: 'acme', name: 'Acme Corp' } as any

// ── fetchTenantBySlug ─────────────────────────────────────────────────────────

describe('fetchTenantBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCache.get.mockReturnValue(undefined) // default: cache miss
  })

  it('returns null immediately for empty slug', async () => {
    const result = await fetchTenantBySlug('')
    expect(result).toBeNull()
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  it('returns cached value on cache hit (no DB call)', async () => {
    mockCache.get.mockReturnValue(TENANT)
    const result = await fetchTenantBySlug('acme')
    expect(result).toEqual(TENANT)
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  it('queries DB on cache miss and returns tenant', async () => {
    mockCache.get.mockReturnValue(undefined)
    mockGetPayload.mockResolvedValue(makePayload([TENANT]))
    const result = await fetchTenantBySlug('acme')
    expect(result?.id).toBe(1)
  })

  it('stores DB result in cache after successful lookup', async () => {
    mockCache.get.mockReturnValue(undefined)
    mockGetPayload.mockResolvedValue(makePayload([TENANT]))
    await fetchTenantBySlug('acme')
    expect(mockCache.set).toHaveBeenCalledWith('acme', TENANT)
  })

  it('returns null when no tenant found by slug', async () => {
    mockCache.get.mockReturnValue(undefined)
    mockGetPayload.mockResolvedValue(makePayload([]))
    const result = await fetchTenantBySlug('no-such-slug')
    expect(result).toBeNull()
  })

  it('stores null in cache when no tenant found', async () => {
    mockCache.get.mockReturnValue(undefined)
    mockGetPayload.mockResolvedValue(makePayload([]))
    await fetchTenantBySlug('no-such-slug')
    expect(mockCache.set).toHaveBeenCalledWith('no-such-slug', null)
  })

  it('returns null when payload.find throws', async () => {
    mockCache.get.mockReturnValue(undefined)
    mockGetPayload.mockResolvedValue({
      find: vi.fn().mockRejectedValue(new Error('DB fail')),
    } as any)
    const result = await fetchTenantBySlug('acme')
    expect(result).toBeNull()
  })
})
