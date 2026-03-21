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
      overrideAccess: true, // Tenant resolution must succeed regardless of auth context
    })

    const result = tenants.docs?.[0] ?? null
    if (result) {
      tenantBySlugCache.set(slug, result)
    }
    return result
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    console.error(`[fetchTenantBySlug] Failed for "${slug}": ${errMsg}`)

    // Retry once with depth: 0 — deep population can fail on cold starts
    try {
      const payload = await getPayload({ config: configPromise })
      const retry = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const result = retry.docs?.[0] ?? null
      if (result) {
        console.log(`[fetchTenantBySlug] Retry succeeded for slug="${slug}" (depth=0)`)
        tenantBySlugCache.set(slug, result)
      }
      return result
    } catch (retryErr) {
      console.error(`[fetchTenantBySlug] Retry also failed for "${slug}":`, retryErr instanceof Error ? retryErr.message.slice(0, 200) : String(retryErr).slice(0, 200))
      return null
    }
  }
}
