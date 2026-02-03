import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Tenant } from '@/payload-types'

/**
 * Fetches tenant by request host/domain.
 * Strip port from host (e.g. localhost:3000 → localhost).
 * Also checks additional domains in tenant.domains array.
 */
export async function fetchTenantByDomain(host: string): Promise<Tenant | null> {
  const domain = host?.split(':')[0]?.toLowerCase() || 'localhost'

  const payload = await getPayload({ config: configPromise })

  const tenants = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: domain } },
    limit: 1,
    depth: 1,
  })

  return tenants.docs?.[0] ?? null
}
