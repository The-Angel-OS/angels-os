import type { PayloadRequest, Where } from 'payload'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

/**
 * Resolve the current tenant ID from the request's x-tenant-id header.
 *
 * The middleware injects x-tenant-id as a **slug** (e.g. "hays-cactus"),
 * but the `tenant` relationship field on collections stores the tenant
 * document's numeric ID. This function resolves slug → ID using the
 * cached fetchTenantBySlug (60s TTL, so usually a cache hit).
 *
 * Returns the tenant document ID, or null if no tenant context exists.
 */
export async function resolveTenantIdFromRequest(
  req: PayloadRequest,
): Promise<string | number | null> {
  const tenantSlug = req.headers.get('x-tenant-id')
  if (!tenantSlug) return null

  const tenant = await fetchTenantBySlug(tenantSlug)
  return tenant?.id ?? null
}

/**
 * Build a Where clause that scopes results to the current tenant.
 *
 * If the request has a valid x-tenant-id header, returns
 * `{ tenant: { equals: <tenantDocId> } }`. Otherwise returns null
 * (meaning no tenant scoping can be applied).
 */
export async function buildTenantWhere(
  req: PayloadRequest,
): Promise<Where | null> {
  const tenantId = await resolveTenantIdFromRequest(req)
  if (!tenantId) return null

  return { tenant: { equals: tenantId } }
}

/**
 * Merge a base Where clause with tenant scoping.
 *
 * Used by access control functions that already return a Where object
 * (e.g. `{ _status: { equals: 'published' } }`) and need to add
 * tenant filtering for unauthenticated API requests.
 *
 * @param baseWhere - The existing access control Where clause
 * @param tenantWhere - Tenant scoping Where clause from buildTenantWhere
 * @returns Combined Where clause with AND logic
 */
export function mergeWithTenantScope(
  baseWhere: Where,
  tenantWhere: Where,
): Where {
  return {
    and: [baseWhere, tenantWhere],
  }
}
