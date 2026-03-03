/**
 * getTenantCachedDoc — Unit Tests
 *
 * Tests the public API of getTenantCachedDoc, including the null-tenantId
 * fast-path and the Next.js unstable_cache wrapping behaviour.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock Next.js cache so tests don't require a Next.js runtime
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn(
    (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
  ),
}))

// Mock Payload so no DB connection is made
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

// ── null tenantId fast-path ─────────────────────────────────────────────────

describe('getTenantCachedDoc — null tenantId', () => {
  it('returns a function when tenantId is null', () => {
    const fn = getTenantCachedDoc('header', null)
    expect(typeof fn).toBe('function')
  })

  it('returned function resolves to null', async () => {
    const fn = getTenantCachedDoc('header', null)
    const result = await fn()
    expect(result).toBeNull()
  })

  it('does not call unstable_cache when tenantId is null', () => {
    getTenantCachedDoc('footer', null)
    expect(unstable_cache).not.toHaveBeenCalled()
  })

  it('returns null for both header and footer collections', async () => {
    const header = await getTenantCachedDoc('header', null)()
    const footer = await getTenantCachedDoc('footer', null)()
    expect(header).toBeNull()
    expect(footer).toBeNull()
  })
})

// ── non-null tenantId ────────────────────────────────────────────────────────

describe('getTenantCachedDoc — non-null tenantId', () => {
  it('calls unstable_cache when tenantId is provided', () => {
    vi.mocked(unstable_cache).mockClear()
    getTenantCachedDoc('header', 1)
    expect(unstable_cache).toHaveBeenCalledTimes(1)
  })

  it('returns a callable function for non-null tenantId', () => {
    const fn = getTenantCachedDoc('header', 5)
    expect(typeof fn).toBe('function')
  })

  it('includes tenantId in the cache key', () => {
    vi.mocked(unstable_cache).mockClear()
    getTenantCachedDoc('header', 42)
    const [, cacheKey] = vi.mocked(unstable_cache).mock.calls[0]
    expect(cacheKey).toContain('42')
  })

  it('includes collection name in the cache key', () => {
    vi.mocked(unstable_cache).mockClear()
    getTenantCachedDoc('footer', 1)
    const [, cacheKey] = vi.mocked(unstable_cache).mock.calls[0]
    // cacheKey is ['tenant_footer', '1'] — check that 'tenant_footer' is in the array
    expect(cacheKey).toContain('tenant_footer')
  })

  it('passes tags option with tenant-scoped tag', () => {
    vi.mocked(unstable_cache).mockClear()
    getTenantCachedDoc('header', 7)
    const [, , options] = vi.mocked(unstable_cache).mock.calls[0]
    expect((options as any).tags).toContain('tenant_header_7')
  })

  it('invokes payload.find when the cached function is called', async () => {
    const mockPayload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
    }
    vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    vi.mocked(unstable_cache).mockClear()

    const fn = getTenantCachedDoc('header', 3)
    await fn()

    expect(mockPayload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'header',
        where: { tenant: { equals: 3 } },
      }),
    )
  })

  it('returns null when payload.find returns no docs', async () => {
    const mockPayload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
    }
    vi.mocked(getPayload).mockResolvedValue(mockPayload as any)

    const fn = getTenantCachedDoc('header', 3)
    const result = await fn()
    expect(result).toBeNull()
  })

  it('returns the first doc when found', async () => {
    const doc = { id: 99, tenant: 3 }
    const mockPayload = {
      find: vi.fn().mockResolvedValue({ docs: [doc] }),
    }
    vi.mocked(getPayload).mockResolvedValue(mockPayload as any)

    const fn = getTenantCachedDoc('footer', 3)
    const result = await fn()
    expect(result).toEqual(doc)
  })
})
