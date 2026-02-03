import type { User } from '@/payload-types'

/**
 * Platform-level super admin. Very few users.
 * Has access to all tenants via userHasAccessToAllTenants in multi-tenant plugin.
 */
export const isSuperAdmin = (user: User | null | undefined): boolean =>
  Boolean(user?.roles?.includes('super_admin'))
