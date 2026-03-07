import type { Access } from 'payload'

import { checkRole } from '@/access/utilities'
import { buildTenantWhere, mergeWithTenantScope } from '@/access/tenantScope'
import { buildTenantFilter } from '@/utilities/buildTenantFilter'

/**
 * Access control for draft-enabled, tenant-scoped collections (Pages, Posts).
 *
 * - Admin users: full access (multiTenantPlugin handles tenant scoping)
 * - Authenticated non-admin: published docs only (multiTenantPlugin adds tenant filter)
 * - Unauthenticated (public REST API): published docs scoped to current tenant
 *
 * This is the tenant-aware variant of `adminOrPublishedStatus`. Use this for
 * collections that are in multiTenantPlugin's `collections` config and do NOT
 * have join fields referencing collections without a `tenant` field.
 *
 * Do NOT use this for collections shared with the ecommerce plugin
 * (use plain `adminOrPublishedStatus` instead — see that file for details).
 */
export const adminOrPublishedWithTenantScope: Access = async ({ req }) => {
  const { user } = req

  // Admin users get full access — multiTenantPlugin handles their tenant filtering
  if (user && checkRole(['admin'], user)) {
    return true
  }

  const publishedOnly = { _status: { equals: 'published' as const } }

  // For non-admin or unauthenticated requests, scope to current tenant
  const tenantWhere = await buildTenantWhere(req)
  if (tenantWhere) {
    return mergeWithTenantScope(publishedOnly, tenantWhere)
  }

  // No tenant context (e.g. platform-level request) — only return published
  // pages that have no tenant assigned (platform-level content).
  // Without this, unauthenticated requests without x-tenant-id would see
  // pages from ALL tenants, leaking cross-tenant content.
  return {
    and: [publishedOnly, buildTenantFilter(undefined)],
  }
}
