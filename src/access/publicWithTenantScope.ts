import type { Access } from 'payload'

import { buildTenantWhere } from '@/access/tenantScope'

/**
 * Public read access scoped to the current tenant.
 *
 * - Authenticated users: full access (multiTenantPlugin handles tenant scoping)
 * - Unauthenticated (public REST API): scoped to current tenant
 *
 * Use this instead of `() => true` for tenant-aware collections that should
 * be publicly readable but only within their tenant boundary.
 *
 * Collections that are truly global (Tenants, Users, etc.) should keep
 * using `() => true` or their own access logic.
 */
export const publicWithTenantScope: Access = async ({ req }) => {
  // Authenticated users get full access (multiTenantPlugin handles filtering)
  if (req.user) return true

  // Unauthenticated: scope to current tenant
  const tenantWhere = await buildTenantWhere(req)
  if (tenantWhere) return tenantWhere

  // No tenant context — allow all (fallback for platform-level requests)
  return true
}
