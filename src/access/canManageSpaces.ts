import type { User } from '@/payload-types'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { getUserTenantMembership } from '@/access/getUserTenantRoles'

/**
 * Check if user can create/manage spaces for a tenant.
 * Super admins can manage all. Tenant admins and managers can manage their tenant's spaces.
 */
export async function canManageSpaces(
  user: User | { id?: unknown; email?: string; roles?: unknown[] } | null | undefined,
  tenantId: number | string,
): Promise<boolean> {
  if (!user?.id || !('email' in user)) return false
  const u = user as User
  if (isSuperAdmin(u)) return true

  const membership = await getUserTenantMembership(u.id, tenantId)
  if (!membership) return false

  if (membership.role === 'tenant_admin') return true
  if (membership.role === 'tenant_manager') return true

  const perms = membership.permissions as string[] | undefined
  return Array.isArray(perms) && perms.includes('manage_spaces')
}
