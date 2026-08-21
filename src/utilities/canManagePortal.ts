/**
 * May this viewer manage THIS portal?
 *
 * Platform admins always may. Everyone else may when they hold an active
 * tenant_admin / tenant_manager membership on the tenant they are looking at.
 *
 * This existed three times as "roles.some(r => /admin|editor|owner/)" against
 * the PLATFORM roles array, which gets the answer backwards in both directions:
 * a portal's own tenant_admin — the person whose site it is — was refused on
 * their own site, while a platform editor was offered it on everyone's.
 */
import type { Payload } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

export async function canManagePortal(
  _payload: Payload,
  user: unknown,
  tenantId: string | number | null | undefined,
): Promise<boolean> {
  if (!user) return false
  if (checkRole(ADMIN_ROLES, user as Parameters<typeof checkRole>[1])) return true
  if (!tenantId) return false
  try {
    const roles = await getUserTenantRoles((user as { id: number | string }).id)
    return roles.some((m) => {
      const t = m.tenant as unknown
      const id = t && typeof t === 'object' ? (t as { id: number | string }).id : t
      return (
        String(id) === String(tenantId) &&
        MANAGER_ROLES.has(String(m.role)) &&
        (m as { status?: string }).status === 'active'
      )
    })
  } catch {
    // Denied is the safe side of an unknown: the affordance is hidden, and the
    // resolver endpoint and Payload admin are the real gate either way.
    return false
  }
}
