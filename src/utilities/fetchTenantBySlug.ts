import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Tenant } from '@/payload-types'

/**
 * Fetches tenant by slug (e.g. from x-tenant-id header).
 */
export async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!slug) return null

  const payload = await getPayload({ config: configPromise })

  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  })

  return tenants.docs?.[0] ?? null
}
