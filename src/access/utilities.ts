import type { User } from '@/payload-types'

/**
 * Canonical list of roles that grant admin-level access.
 * Use this instead of hardcoding ['super_admin', 'admin', 'archangel'].
 */
export const ADMIN_ROLES: NonNullable<User['roles']> = ['super_admin', 'admin', 'archangel']

export const checkRole = (allRoles: User['roles'] = [], user?: unknown): boolean => {
  const u = user as { roles?: unknown[] } | null | undefined
  if (u && allRoles && 'roles' in u && Array.isArray(u.roles)) {
    return allRoles.some((role) => {
      return u.roles?.some((individualRole) => individualRole === role)
    })
  }
  return false
}
