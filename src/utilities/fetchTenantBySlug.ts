import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Tenant } from '@/payload-types'

/**
 * Fetches tenant by slug (e.g. from x-tenant-id header).
 */
export async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!slug) return null

  try {
    const payload = await getPayload({ config: configPromise })

    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    })

    return tenants.docs?.[0] ?? null
  } catch (err) {
    console.error('[fetchTenantBySlug] DB query failed for slug:', slug, err)
    return null
  }
}
