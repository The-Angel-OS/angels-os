import type { Access } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Access control for draft-enabled collections.
 *
 * - Admin users: full access (can see drafts)
 * - Everyone else: published docs only
 *
 * IMPORTANT: This function is shared via the ecommerce plugin with internally-
 * created collections (variants, variantTypes, variantOptions) that do NOT have
 * a `tenant` field. Do NOT add tenant scoping here — it would cause 500 errors
 * when Payload processes join sub-queries on those collections.
 *
 * For tenant-scoped published access, use `adminOrPublishedWithTenantScope` instead.
 */
export const adminOrPublishedStatus: Access = ({ req }) => {
  const { user } = req

  if (user && checkRole(ADMIN_ROLES, user)) {
    return true
  }

  return { _status: { equals: 'published' as const } }
}
