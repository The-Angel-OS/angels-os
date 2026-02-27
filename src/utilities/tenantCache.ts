/**
 * Lightweight in-process TTL cache for tenant lookups.
 *
 * Tenant data changes infrequently; caching for 60s eliminates the per-request
 * DB hits from fetchTenantBySlug / fetchTenantByDomain that can exhaust the
 * connection pool under dev load or cold-start bursts.
 *
 * TTL is intentionally short (60s dev / 120s prod) so tenant updates propagate
 * quickly. The cache is module-level (singleton per Node process), which is
 * correct for Next.js App Router server components running in the same process.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const CACHE_TTL_MS = process.env.NODE_ENV === 'production' ? 120_000 : 60_000

class TenantCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  }

  /** Explicitly invalidate a cached tenant (e.g. after admin update) */
  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidateAll(): void {
    this.store.clear()
  }
}

export const tenantBySlugCache = new TenantCache<unknown>()
export const tenantByDomainCache = new TenantCache<unknown>()
