import { cache } from 'react'
import { headers } from 'next/headers'
import { fetchTenantBySlug } from './fetchTenantBySlug'
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
 * Uses fetchTenantBySlug (60s/120s TTL cache) to avoid per-request DB hits.
 * Wrapped in React.cache() for request-level deduplication — pages that call
 * this from both generateMetadata and the page component only resolve once.
 */
export const resolveTenantFromHeaders = cache(async (): Promise<{
  tenantId: number | undefined
  tenantFilter: Where
}> => {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')

  if (!tenantSlug) {
    return {
      tenantId: undefined,
      tenantFilter: buildTenantFilter(undefined),
    }
  }

  const tenant = await fetchTenantBySlug(tenantSlug)
  const tenantId = tenant?.id

  return {
    tenantId,
    tenantFilter: buildTenantFilter(tenantId),
  }
})
