import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Tenant } from '@/payload-types'
import { tenantByDomainCache, tenantBySlugCache } from './tenantCache'

/**
 * Fetches tenant by request host/domain.
 * Strip port from host (e.g. localhost:3000 → localhost).
 * Falls back to the DEFAULT_TENANT_SLUG tenant if no domain match found,
 * ensuring the site always works regardless of access domain.
 *
 * Results are cached in-process for 60s (dev) / 120s (prod) to eliminate
 * per-request DB hits that can exhaust the connection pool.
 */
export async function fetchTenantByDomain(host: string): Promise<Tenant | null> {
  const domain = host?.split(':')[0]?.toLowerCase() || 'localhost'

  const cached = tenantByDomainCache.get(domain) as Tenant | undefined
  if (cached !== undefined) return cached

  try {
    const payload = await getPayload({ config: configPromise })

    // First: try exact domain match
    // depth: 2 ensures nested relations (e.g. branding.logo → Media object) are fully hydrated
    const tenants = await payload.find({
      collection: 'tenants',
      where: { domain: { equals: domain } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (tenants.docs?.[0]) {
      tenantByDomainCache.set(domain, tenants.docs[0])
      return tenants.docs[0]
    }

    // Second: subdomain-slug lookup.
    // Handles the common env-mismatch case where the tenant's domain field was
    // seeded as hays-cactus.angelos.local but we are now serving hays-cactus.spacesangels.com.
    // The middleware already resolved the slug correctly via hostname parsing; this
    // catches the fallback path when the x-tenant-id header wasn't forwarded.
    const hostParts = domain.split('.')
    if (hostParts.length >= 3) {
      const subSlug = hostParts[0]
      const cachedBySlug = tenantBySlugCache.get(subSlug) as Tenant | undefined
      if (cachedBySlug !== undefined) {
        tenantByDomainCache.set(domain, cachedBySlug)
        return cachedBySlug
      }
      const bySlug = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: subSlug } },
        limit: 1,
        depth: 2,
        overrideAccess: true,
      })
      if (bySlug.docs?.[0]) {
        tenantBySlugCache.set(subSlug, bySlug.docs[0])
        tenantByDomainCache.set(domain, bySlug.docs[0])
        return bySlug.docs[0]
      }
    }

    // Final fallback: return the default tenant so the site always has context
    const fallbackSlug = process.env.DEFAULT_TENANT_SLUG || 'default'
    // ⚠️ DO NOT cache this generic fallback under `domain`. Caching the DEFAULT
    // tenant under a real host key (e.g. harpazo.kendev.co) poisons that host for
    // the full TTL: one transient domain miss under load → every later request
    // serves the platform/default home for 120s. We only cache the fallback under
    // its own SLUG key, so a real domain re-attempts its match next request and
    // self-heals. (This was the "harpazo sometimes loads Angel OS default" bug.)
    const cachedFallback = tenantBySlugCache.get(fallbackSlug) as Tenant | undefined
    if (cachedFallback !== undefined) {
      return cachedFallback
    }
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: fallbackSlug } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    const result = defaults.docs?.[0] ?? null
    if (result) tenantBySlugCache.set(fallbackSlug, result) // never cache null
    return result
  } catch (err) {
    console.error('[fetchTenantByDomain] DB query failed for domain:', domain, err)
    return null
  }
}
