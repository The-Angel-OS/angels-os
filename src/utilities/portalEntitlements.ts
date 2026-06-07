import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Pure entitlement policy for the PortalContext (no payload/headers/IO) — the
 * single definition of "admin" / "owner" / "may manage X for the current portal",
 * so every dashboard surface answers those questions the same way.
 *
 * See docs/architecture/AUTH_CONTEXT_REFACTOR.md. Consumed by
 * src/utilities/portalContext.ts (resolvePortalContext).
 */

export type PortalCapability = 'manageConnectors' | 'manageSpaces' | 'adminPortal'

export interface PortalEntitlements {
  isAuthenticated: boolean
  /** Platform (Host) admin: super_admin / admin / archangel — matches the layout. */
  isPlatformAdmin: boolean
  /** Any authenticated non-customer role (owner/staff) — matches nav isBusinessOwner. */
  isBusinessOwner: boolean
  /** Tenants the user belongs to (multi-tenant plugin user.tenants array). */
  memberTenantIds: Array<number | string>
  /** Tenants the user is tenant_admin / tenant_manager of (memberships). */
  managedTenantIds: Array<number | string>
  /** Is the user entitled to the CURRENT portal at all (admin / member / manager)? */
  isMemberOfPortal: boolean
  /** Per-capability checks for the CURRENT portal. */
  can: Record<PortalCapability, boolean>
}

const idEq = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)

export function computePortalEntitlements(input: {
  user: { roles?: unknown; tenants?: unknown } | null
  tenantId: number | string | null | undefined
  managedTenantIds: Array<number | string>
}): PortalEntitlements {
  const { user, tenantId, managedTenantIds } = input
  const roles = Array.isArray(user?.roles) ? (user!.roles as unknown[]) : []
  const isAuthenticated = Boolean(user)
  const isPlatformAdmin = checkRole(ADMIN_ROLES, user as never)
  const isBusinessOwner = isPlatformAdmin || roles.some((r) => r !== 'customer')

  const memberTenantIds = (Array.isArray((user as { tenants?: unknown[] } | null)?.tenants)
    ? (user as { tenants: unknown[] }).tenants
    : []
  ).map((t) => {
    const tt = (t as { tenant?: unknown }).tenant
    return tt && typeof tt === 'object' ? (tt as { id: number | string }).id : (tt as number | string)
  })

  const entitledToCurrent =
    isPlatformAdmin ||
    (tenantId != null &&
      (memberTenantIds.some((id) => idEq(id, tenantId)) ||
        managedTenantIds.some((id) => idEq(id, tenantId))))

  const managesCurrent =
    isPlatformAdmin || (tenantId != null && managedTenantIds.some((id) => idEq(id, tenantId)))

  return {
    isAuthenticated,
    isPlatformAdmin,
    isBusinessOwner,
    memberTenantIds,
    managedTenantIds,
    isMemberOfPortal: entitledToCurrent,
    can: {
      // Connectors hold secrets: admin, a manager of this portal, or an
      // owner/staff member of it. (Mirrors connectorAccess + the page guard.)
      manageConnectors: entitledToCurrent && (isBusinessOwner || managesCurrent),
      manageSpaces: managesCurrent,
      adminPortal: isPlatformAdmin,
    },
  }
}
