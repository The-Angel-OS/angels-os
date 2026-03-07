import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { buildTenantFilter } from './buildTenantFilter'
import type { Where } from 'payload'

/**
 * Resolve the current tenant from the x-tenant-id header (set by middleware).
 *
 * Returns { tenantId, tenantFilter } where:
 * - tenantId: the numeric tenant ID, or undefined if platform context
 * - tenantFilter: a Where clause that enforces tenant isolation
 *
 * TENANT ISOLATION: When x-tenant-id is absent (platform domain), tenantFilter
 * returns `{ tenant: { exists: false } }` so queries only return platform-level
 * content. This prevents cross-tenant data leakage.
 *
 * This replaces the repeated pattern across page routes of:
 *   1. Reading x-tenant-id from headers
 *   2. Looking up tenant by slug
 *   3. Falling back to "default" tenant (which was a leakage vector!)
 */
export async function resolveTenantFromHeaders(): Promise<{
  tenantId: number | undefined
  tenantFilter: Where
}> {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')

  if (!tenantSlug) {
    // Platform context — no tenant header means we're on a platform domain.
    // Return undefined tenantId and a filter that only shows platform-level content.
    return {
      tenantId: undefined,
      tenantFilter: buildTenantFilter(undefined),
    }
  }

  const payload = await getPayload({ config: configPromise })

  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
  })

  const tenantId = tenants.docs?.[0]?.id

  return {
    tenantId,
    tenantFilter: buildTenantFilter(tenantId),
  }
}
