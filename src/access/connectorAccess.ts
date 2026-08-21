/**
 * Access control for the Connectors collection.
 *
 * Connectors hold tenant integration secrets (tokens, IMAP passwords, escalation
 * policy), so management is gated to the endeavor's own admins — NOT every
 * authenticated user. Endeavor owners self-serve their tenant's integrations:
 *
 *   - super_admin (and global ADMIN_ROLES) → all tenants (the multi-tenant
 *     plugin still clamps non-super_admins to the tenants they belong to).
 *   - tenant_admin / tenant_manager membership → that membership's tenant only
 *     (returned as a `{ tenant: { in: [...] } }` Where for read/update/delete).
 *   - everyone else → denied.
 *
 * Mirrors the proven pattern in canManageSpaces / canInviteUsers (tenant
 * membership roles), generalized to a Payload `Access` function.
 *
 * Now the shared "portal manager" scope rather than a connectors-only rule — the
 * Site Log reuses it for the same reason (operations data, not customer data).
 * The name is historical; the meaning is general.
 */
import type { Access } from 'payload'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

const MANAGER_ROLES = ['tenant_admin', 'tenant_manager']

/**
 * Global admins — the only users who legitimately see every tenant's rows.
 *
 * This used to be `isOwnerOrStaff`: any user whose roles were more than
 * ['customer'], returning unconstrained `true` on the stated grounds that "the
 * multi-tenant plugin still clamps non-super_admins". That is true for
 * Connectors and site-visits, which ARE registered with the plugin — and false
 * for Services, which is not, and says so in its own access comment. So a
 * business owner on one portal could read every portal's service catalogue,
 * prices and deposits included, straight off /api/services.
 *
 * Access that is only safe because something else clamps it is not access
 * control. This now returns the tenant Where for everyone except real platform
 * admins, so it is correct whether or not the plugin is in front of it.
 */
function isPlatformAdmin(user: unknown): boolean {
  return Boolean(checkRole(ADMIN_ROLES, user as Parameters<typeof checkRole>[1]))
}

/** Tenant IDs this user may manage connectors for (via active membership role). */
export async function managerTenantIds(
  user: { id?: number | string } | null | undefined,
): Promise<Array<number | string>> {
  if (!user?.id) return []
  try {
    const memberships = await getUserTenantRoles(user.id)
    return memberships
      .filter((m) => MANAGER_ROLES.includes(String(m.role)))
      .map((m) => {
        const t = m.tenant as unknown
        return t && typeof t === 'object' ? (t as { id: number | string }).id : (t as number | string)
      })
      .filter((v): v is number | string => v != null)
  } catch {
    return []
  }
}

/**
 * read / update / delete — super_admin & global admins get unconstrained access
 * (plugin clamps to their tenants); tenant managers get a tenant-scoped Where;
 * others are denied.
 */
export const connectorScopedAccess: Access = async ({ req: { user } }) => {
  if (!user) return false
  if (isPlatformAdmin(user)) return true
  const ids = await managerTenantIds(user as { id?: number | string })
  return ids.length ? { tenant: { in: ids } } : false
}

/**
 * create — boolean (Payload create access cannot return a Where). The
 * multi-tenant plugin enforces that the new doc's tenant is one the user belongs
 * to, so we only need to confirm the user holds a manager role somewhere.
 */
export const connectorCreateAccess: Access = async ({ req: { user } }) => {
  if (!user) return false
  if (isPlatformAdmin(user)) return true
  const ids = await managerTenantIds(user as { id?: number | string })
  return ids.length > 0
}
