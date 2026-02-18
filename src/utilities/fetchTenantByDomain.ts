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

    // Fallback: return the "default" tenant so the site always works
    // (e.g. when accessed via angels-os.vercel.app but tenant domain is "localhost")
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
