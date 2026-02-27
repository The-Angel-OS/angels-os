import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Tenant } from '@/payload-types'
import { tenantBySlugCache } from './tenantCache'

/**
 * Fetches tenant by slug (e.g. from x-tenant-id header).
 * Results are cached in-process for 60s (dev) / 120s (prod) to avoid
 * per-request DB hits that can exhaust the connection pool.
 */
export async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!slug) return null

  const cached = tenantBySlugCache.get(slug) as Tenant | undefined
  if (cached !== undefined) return cached

  try {
    const payload = await getPayload({ config: configPromise })

    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    })

    const result = tenants.docs?.[0] ?? null
    tenantBySlugCache.set(slug, result)
    return result
  } catch (err) {
    console.error('[fetchTenantBySlug] DB query failed for slug:', slug, err)
    return null
  }
}
