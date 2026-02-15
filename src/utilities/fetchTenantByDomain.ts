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

  const payload = await getPayload({ config: configPromise })

  // First: try exact domain match
  const tenants = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: domain } },
    limit: 1,
    depth: 1,
  })

  if (tenants.docs?.[0]) return tenants.docs[0]

  // Fallback: return the "default" tenant so the site always works
  // (e.g. when accessed via angels-os.vercel.app but tenant domain is "localhost")
  const defaults = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'default' } },
    limit: 1,
    depth: 1,
  })

  return defaults.docs?.[0] ?? null
}
