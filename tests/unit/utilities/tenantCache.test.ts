/**
 * tenantCache — Unit Tests
 *
 * TenantCache: in-memory TTL cache for tenant lookups.
 * Tests get/set/invalidate/invalidateAll behavior.
 */
import { describe, it, expect } from 'vitest'

// Re-export the TenantCache class via a test-only pattern.
// The module exports two singletons — we import them and test the class behaviour.
import { tenantBySlugCache, tenantByDomainCache } from '@/utilities/tenantCache'

describe('tenantBySlugCache', () => {
  it('returns undefined for an unknown key', () => {
    expect(tenantBySlugCache.get('nonexistent-slug')).toBeUndefined()
  })

  it('stores and retrieves a value', () => {
    const slug = `test-slug-${Date.now()}`
    const tenant = { id: 1, name: 'Test Tenant' }
    tenantBySlugCache.set(slug, tenant)
    expect(tenantBySlugCache.get(slug)).toEqual(tenant)
  })

  it('invalidates a specific key', () => {
    const slug = `invalidate-${Date.now()}`
    tenantBySlugCache.set(slug, { id: 2 })
    tenantBySlugCache.invalidate(slug)
    expect(tenantBySlugCache.get(slug)).toBeUndefined()
  })

  it('invalidateAll clears all entries', () => {
    const slug1 = `bulk-a-${Date.now()}`
    const slug2 = `bulk-b-${Date.now()}`
    tenantBySlugCache.set(slug1, { id: 3 })
    tenantBySlugCache.set(slug2, { id: 4 })
    tenantBySlugCache.invalidateAll()
    expect(tenantBySlugCache.get(slug1)).toBeUndefined()
    expect(tenantBySlugCache.get(slug2)).toBeUndefined()
  })

  it('overwrites existing value on second set', () => {
    const slug = `overwrite-${Date.now()}`
    tenantBySlugCache.set(slug, { id: 10 })
    tenantBySlugCache.set(slug, { id: 20 })
    expect((tenantBySlugCache.get(slug) as any)?.id).toBe(20)
  })
})

describe('tenantByDomainCache', () => {
  it('is independent from tenantBySlugCache', () => {
    const key = `domain-${Date.now()}`
    tenantByDomainCache.set(key, { id: 99 })
    // Slug cache should not have this key
    expect(tenantBySlugCache.get(key)).toBeUndefined()
  })

  it('stores and retrieves a domain-keyed value', () => {
    const domain = `myapp-${Date.now()}.example.com`
    const tenant = { id: 5, domain }
    tenantByDomainCache.set(domain, tenant)
    expect(tenantByDomainCache.get(domain)).toEqual(tenant)
    // Cleanup
    tenantByDomainCache.invalidate(domain)
  })
})
