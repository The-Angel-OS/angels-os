/**
 * fetchTenantByDomain — Unit Tests
 *
 * Tests port stripping, cache hits, exact domain match, subdomain-slug fallback,
 * default-tenant fallback, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/utilities/tenantCache', () => ({
  tenantByDomainCache: { get: vi.fn(), set: vi.fn() },
  tenantBySlugCache: { get: vi.fn(), set: vi.fn() },
}))

import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { getPayload } from 'payload'
import { tenantByDomainCache, tenantBySlugCache } from '@/utilities/tenantCache'

const mockGetPayload = vi.mocked(getPayload)
const mockDomainCache = vi.mocked(tenantByDomainCache)
const mockSlugCache = vi.mocked(tenantBySlugCache)

// ── Helpers ─────────────────────────────────────────────────────────────────

const TENANT = { id: 1, slug: 'acme', name: 'Acme Corp' } as any
const DEFAULT_TENANT = { id: 99, slug: 'default', name: 'Default' } as any

type FindCall = { docs: unknown[] }

function makePayload(findResults: FindCall[]) {
  let callIndex = 0
  return {
    find: vi.fn().mockImplementation(() => {
      const result = findResults[callIndex] ?? { docs: [] }
      callIndex++
      return Promise.resolve(result)
    }),
  } as any
}

// ── fetchTenantByDomain ───────────────────────────────────────────────────────

describe('fetchTenantByDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: cache miss for everything
    mockDomainCache.get.mockReturnValue(undefined)
    mockSlugCache.get.mockReturnValue(undefined)
  })

  // ── Port stripping ───────────────────────────────────────────────────────

  it('strips port from host before looking up', async () => {
    const payload = makePayload([{ docs: [TENANT] }])
    mockGetPayload.mockResolvedValue(payload)
    await fetchTenantByDomain('acme.com:3000')
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain: { equals: 'acme.com' } },
      }),
    )
  })

  it('lowercases the domain', async () => {
    const payload = makePayload([{ docs: [TENANT] }])
    mockGetPayload.mockResolvedValue(payload)
    await fetchTenantByDomain('Acme.COM')
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain: { equals: 'acme.com' } },
      }),
    )
  })

  // ── Cache hit ────────────────────────────────────────────────────────────

  it('returns cached tenant without DB call on domain cache hit', async () => {
    mockDomainCache.get.mockReturnValue(TENANT)
    const result = await fetchTenantByDomain('acme.com')
    expect(result).toEqual(TENANT)
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  // ── Exact domain match ───────────────────────────────────────────────────

  it('returns tenant on exact domain match and caches it', async () => {
    const payload = makePayload([{ docs: [TENANT] }])
    mockGetPayload.mockResolvedValue(payload)
    const result = await fetchTenantByDomain('acme.com')
    expect(result?.id).toBe(1)
    expect(mockDomainCache.set).toHaveBeenCalledWith('acme.com', TENANT)
  })

  // ── Subdomain-slug fallback ──────────────────────────────────────────────

  it('falls back to subdomain slug lookup for 3-part domains', async () => {
    // The resolver makes THREE queries in order: exact `domain`, then alias
    // `domains.domain` (bring-your-own domains, added later), then subdomain
    // slug. The mock queue was written before the alias step existed, so the
    // slug result was being consumed by the alias lookup.
    const payload = makePayload([{ docs: [] }, { docs: [] }, { docs: [TENANT] }])
    mockGetPayload.mockResolvedValue(payload)
    const result = await fetchTenantByDomain('acme.spacesangels.com')
    expect(result?.id).toBe(1)
    expect(mockSlugCache.set).toHaveBeenCalledWith('acme', TENANT)
  })

  it('uses slug cache on subdomain fallback when slug is cached', async () => {
    mockDomainCache.get.mockReturnValue(undefined)
    // slug cache hit for 'acme'
    mockSlugCache.get.mockImplementation((key: string) =>
      key === 'acme' ? TENANT : undefined,
    )
    const payload = makePayload([{ docs: [] }, { docs: [] }]) // exact + alias
    mockGetPayload.mockResolvedValue(payload)
    const result = await fetchTenantByDomain('acme.spacesangels.com')
    expect(result?.id).toBe(1)
    // The slug came from cache — no THIRD query for it.
    expect(payload.find).toHaveBeenCalledTimes(2)
  })

  // ── Default tenant fallback ──────────────────────────────────────────────

  it('falls back to default tenant when no domain or slug match', async () => {
    // domain miss, slug miss, default tenant found
    const payload = makePayload([{ docs: [] }, { docs: [DEFAULT_TENANT] }])
    mockGetPayload.mockResolvedValue(payload)
    const result = await fetchTenantByDomain('unknown.com')
    expect(result?.slug).toBe('default')
  })

  it('returns null when default tenant is also not found', async () => {
    const payload = makePayload([{ docs: [] }, { docs: [] }])
    mockGetPayload.mockResolvedValue(payload)
    const result = await fetchTenantByDomain('unknown.com')
    expect(result).toBeNull()
  })

  // ── Error handling ───────────────────────────────────────────────────────

  it('returns null when payload throws', async () => {
    mockGetPayload.mockRejectedValue(new Error('DB fail'))
    const result = await fetchTenantByDomain('acme.com')
    expect(result).toBeNull()
  })
})
