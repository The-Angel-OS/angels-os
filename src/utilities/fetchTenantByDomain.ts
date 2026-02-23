import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Tenant } from '@/payload-types'

/**
 * Fetches tenant by request host/domain.
 * Strip port from host (e.g. localhost:3000 → localhost).
 * Falls back to the "default" tenant if no domain match found,
 * ensuring the site always works regardless of access domain.
 */
export async function fetchTenantByDomain(host: string): Promise<Tenant | null> {
  const domain = host?.split(':')[0]?.toLowerCase() || 'localhost'

  try {
    const payload = await getPayload({ config: configPromise })

    // First: try exact domain match
    // depth: 2 ensures nested relations (e.g. branding.logo → Media object) are fully hydrated
    const tenants = await payload.find({
      collection: 'tenants',
      where: { domain: { equals: domain } },
      limit: 1,
      depth: 2,
    })

    if (tenants.docs?.[0]) return tenants.docs[0]

    // Second: subdomain-slug lookup.
    // Handles the common env-mismatch case where the tenant's `domain` field was
    // seeded as `celersoft.angelos.local` but we're now serving `celersoft.spacesangels.com`.
    // The middleware already resolved the slug correctly via hostname parsing; this
    // catches the fallback path when the x-tenant-id header wasn't forwarded.
    const hostParts = domain.split('.')
    if (hostParts.length >= 3) {
      const subSlug = hostParts[0]
      const bySlug = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: subSlug } },
        limit: 1,
        depth: 2,
      })
      if (bySlug.docs?.[0]) return bySlug.docs[0]
    }

    // Final fallback: return the "default" tenant so the site always has context
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 2,
    })

    return defaults.docs?.[0] ?? null
  } catch (err) {
    console.error('[fetchTenantByDomain] DB query failed for domain:', domain, err)
    return null
  }
}
