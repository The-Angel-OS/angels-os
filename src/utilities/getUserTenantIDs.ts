import type { User } from '@/payload-types'

/**
 * Returns tenant IDs the user has access to (from tenants array on user).
 * Used by multi-tenant plugin for access control.
 */
export const getUserTenantIDs = (user: User | null | undefined): (string | number)[] => {
  if (!user?.tenants?.length) return []
  return user.tenants
    .map((t) => {
      if (typeof t === 'object' && t?.tenant != null) {
        return typeof t.tenant === 'object' ? (t.tenant as { id?: string | number })?.id : t.tenant
      }
      return null
    })
    .filter((id): id is string | number => id != null)
}
