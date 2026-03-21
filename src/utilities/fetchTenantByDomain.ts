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
    // seeded as celersoft.angelos.local but we are now serving celersoft.spacesangels.com.
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
    const cachedFallback = tenantBySlugCache.get(fallbackSlug) as Tenant | undefined
    if (cachedFallback !== undefined) {
      tenantByDomainCache.set(domain, cachedFallback)
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
    tenantBySlugCache.set(fallbackSlug, result)
    tenantByDomainCache.set(domain, result)
    return result
  } catch (err) {
    console.error('[fetchTenantByDomain] DB query failed for domain:', domain, err)
    return null
  }
}
