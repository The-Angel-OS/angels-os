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
 */
import type { Access } from 'payload'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'

const MANAGER_ROLES = ['tenant_admin', 'tenant_manager']

/**
 * "Owner / staff" = any authenticated user whose global role set is more than
 * just 'customer'. This matches how the rest of the app defines a business owner
 * (dashboard layout + the Integrations nav item's `adminOrBusinessOwner`
 * visibility), so the nav and the access check never disagree. The multi-tenant
 * plugin still clamps non-super_admins to the tenants they belong to, so this
 * grants management of THEIR tenant's connectors only — not everyone's.
 */
function isOwnerOrStaff(user: unknown): boolean {
  const roles = (user as { roles?: unknown } | null | undefined)?.roles
  return Array.isArray(roles) && roles.some((r) => r !== 'customer')
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
  if (isOwnerOrStaff(user)) return true // plugin clamps to the user's tenant(s)
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
  if (isOwnerOrStaff(user)) return true
  const ids = await managerTenantIds(user as { id?: number | string })
  return ids.length > 0
}
