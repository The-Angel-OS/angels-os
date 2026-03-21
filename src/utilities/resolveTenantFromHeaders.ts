import { cache } from 'react'
import { headers } from 'next/headers'
import { fetchTenantBySlug } from './fetchTenantBySlug'
import { fetchTenantByDomain } from './fetchTenantByDomain'
import { buildTenantFilter } from './buildTenantFilter'
import type { Tenant } from '@/payload-types'
import type { Where } from 'payload'

/**
 * Resolve the current tenant from request headers.
 *
 * Resolution chain:
 *   1. x-tenant-id header (slug) → fetchTenantBySlug (60s/120s TTL cache)
 *   2. host header (domain)     → fetchTenantByDomain (domain → subdomain → DEFAULT_TENANT_SLUG)
 *   3. Neither resolves         → buildTenantFilter(undefined) → { tenant: { exists: false } }
 *
 * Returns { tenant, tenantId, tenantFilter } where:
 * - tenant: the full Tenant object (hydrated to depth 2 via fetchTenantBy*), or null
 * - tenantId: the numeric tenant ID, or undefined if truly platform-only context
 * - tenantFilter: a Where clause that enforces tenant isolation
 *
 * TENANT ISOLATION: Step 2 ensures platform domains (e.g. spacesangels.com) still
 * resolve to their host tenant via domain/DEFAULT_TENANT_SLUG lookup — critical
 * because the middleware intentionally returns null for platform domains (no
 * x-tenant-id header), but ALL content in the DB is assigned to a specific tenant.
 * Without this fallback, platform domains see zero content.
 *
 * Wrapped in React.cache() for request-level deduplication — pages that call
 * this from both generateMetadata and the page component only resolve once.
 */
export const resolveTenantFromHeaders = cache(async (): Promise<{
  tenant: Tenant | null
  tenantId: number | undefined
  tenantFilter: Where
}> => {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')

  // 1. Try slug from x-tenant-id header (set by middleware for subdomain tenants)
  if (tenantSlug) {
    const tenant = await fetchTenantBySlug(tenantSlug)
    if (tenant) {
      return { tenant, tenantId: tenant.id, tenantFilter: buildTenantFilter(tenant.id) }
    }
    // Slug lookup failed (DB error or cold start) — fall through to domain lookup
    console.warn(`[resolveTenantFromHeaders] Slug "${tenantSlug}" lookup failed — falling back to domain`)
  }

  // 2. No header — resolve by domain (handles platform domains like spacesangels.com)
  //    fetchTenantByDomain tries: exact domain → subdomain slug → DEFAULT_TENANT_SLUG
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  if (host) {
    const tenant = await fetchTenantByDomain(host)
    const tenantId = tenant?.id
    if (tenantId != null) {
      return { tenant, tenantId, tenantFilter: buildTenantFilter(tenantId) }
    }
  }

  // 3. Neither resolved — true platform-only context (no tenant data)
  return { tenant: null, tenantId: undefined, tenantFilter: buildTenantFilter(undefined) }
})
