import type { User } from '@/payload-types'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { getUserTenantMembership } from '@/access/getUserTenantRoles'

/**
 * Check if user can invite other users to a tenant.
 * Super admins can invite to all tenants. Tenant admins can invite to their tenant.
 */
export async function canInviteUsers(
  user: User | null | undefined,
  tenantId: number | string,
): Promise<boolean> {
  if (!user?.id) return false
  if (isSuperAdmin(user)) return true

  const membership = await getUserTenantMembership(user.id, tenantId)
  if (!membership) return false

  if (membership.role === 'tenant_admin') return true

  const perms = membership.permissions as string[] | undefined
  return Array.isArray(perms) && perms.includes('manage_users')
}
