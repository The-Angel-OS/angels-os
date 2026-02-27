import type { Access } from 'payload'

import { buildTenantWhere, mergeWithTenantScope } from '@/access/tenantScope'

/**
 * Allow read if user is logged in, or if doc is published (_status === 'published').
 *
 * For unauthenticated requests, also scopes to the current tenant
 * (resolved from x-tenant-id header) to prevent cross-tenant data leaks.
 *
 * For authenticated users, the multiTenantPlugin handles tenant filtering.
 */
export const authenticatedOrPublished: Access = async ({ req }) => {
  const { user } = req

  // Authenticated users: full access (multiTenantPlugin handles tenant scoping)
  if (user) return true

  const publishedOnly = { _status: { equals: 'published' as const } }

  // Unauthenticated: published docs scoped to current tenant
  const tenantWhere = await buildTenantWhere(req)
  if (tenantWhere) {
    return mergeWithTenantScope(publishedOnly, tenantWhere)
  }

  return publishedOnly
}
