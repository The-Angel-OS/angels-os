import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Tenant, User } from '@/payload-types'
import type { Where } from 'payload'
import { resolveTenantFromHeaders } from './resolveTenantFromHeaders'
import { buildTenantFilter } from './buildTenantFilter'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantMembership } from '@/access/getUserTenantRoles'

/**
 * ACTIVE-ENDEAVOR OVERRIDE — smooth in-app portal switching on ONE host.
 *
 * Angel OS consolidates onto a single node (spacesangels.com). A signed-in user
 * has a personal portal (their guardian angel) AND any endeavors/circles they own
 * or belong to. Switching between them should be an in-app context switch, NOT a
 * cross-origin subdomain reload — that's what makes "provision an endeavor → land
 * standing in it → hop back to your personal portal" feel like one motion (the
 * thing Nimue's Card Stage needs too).
 *
 * The mechanism is a validated cookie override on top of host resolution:
 *
 *   host tenant (subdomain / DEFAULT_TENANT_SLUG)  ← the default, unchanged
 *     └─ overridden by the `active-endeavor` cookie ONLY when the signed-in user
 *        is authorized for that tenant (super_admin, or holds an ACTIVE membership)
 *
 * SECURITY — this cannot leak cross-tenant:
 *   • Anonymous / public traffic has no user → override ignored → host resolution.
 *     (Public app pages call resolveTenantFromHeaders directly and never see this.)
 *   • A user can only switch INTO a tenant they already belong to. A stale or
 *     forged cookie pointing at a tenant they don't hold a membership in is
 *     silently dropped back to host resolution.
 *   • This mirrors the multi-tenant plugin's existing `payload-tenant` cookie,
 *     which likewise scopes REST calls and clamps to the user's accessible tenants.
 *
 * Used by the dashboard layout AFTER auth (it needs the resolved user to
 * authorize the override). The layout feeds the resulting tenant.id into
 * TenantCookieSync, so client REST scoping follows the active endeavor for free.
 */
export const ACTIVE_ENDEAVOR_COOKIE = 'active-endeavor'

export interface ResolvedActiveTenant {
  tenant: Tenant | null
  tenantId: number | undefined
  tenantFilter: Where
  /** true when the active-endeavor override replaced the host tenant */
  overridden: boolean
}

export async function resolveActiveTenant(user: User | null): Promise<ResolvedActiveTenant> {
  const host = await resolveTenantFromHeaders()
  const base: ResolvedActiveTenant = {
    tenant: host.tenant,
    tenantId: host.tenantId,
    tenantFilter: host.tenantFilter,
    overridden: false,
  }

  // Only signed-in users can switch context; everyone else stays on the host tenant.
  if (!user?.id) return base

  const jar = await cookies()
  const raw = jar.get(ACTIVE_ENDEAVOR_COOKIE)?.value
  if (!raw) return base

  const overrideId = Number(raw)
  if (!Number.isFinite(overrideId) || overrideId <= 0) return base
  // Already standing on the requested tenant via host — nothing to override.
  if (host.tenantId != null && overrideId === host.tenantId) return base

  // Authorize the switch: super_admins may enter any tenant; everyone else must
  // hold an ACTIVE membership in the target. A cookie we can't authorize is
  // treated as stale/forged and ignored (fall back to host resolution).
  let allowed = checkRole(ADMIN_ROLES, user as never)
  if (!allowed) {
    const membership = await getUserTenantMembership(user.id, overrideId).catch(() => null)
    allowed = Boolean(membership)
  }
  if (!allowed) return base

  try {
    const payload = await getPayload({ config: configPromise })
    const t = (await payload.findByID({
      collection: 'tenants',
      id: overrideId,
      depth: 2,
      overrideAccess: true,
    })) as Tenant | null
    if (!t?.id) return base
    return {
      tenant: t,
      tenantId: t.id as number,
      tenantFilter: buildTenantFilter(t.id),
      overridden: true,
    }
  } catch {
    // Tenant fetch failed — never fail the page over a switch; stay on host.
    return base
  }
}

/**
 * Authorize an active-endeavor override for a caller that has a raw Cookie
 * header rather than next/headers — Payload custom endpoints (LEO's stream, the
 * ops routes) get `req.headers`, not a cookie jar.
 *
 * This is the SAME gate as resolveActiveTenant: super_admins may enter any
 * tenant, everyone else must hold an ACTIVE membership, and anything we cannot
 * authorize is treated as stale or forged and ignored. Returns undefined to mean
 * "no override — use host resolution".
 *
 * Why LEO needs it: its tools resolved the tenant from the x-tenant-id header
 * alone, so switching your active endeavor in the dashboard changed what you
 * SAW but not what LEO WROTE TO. That mismatch is what forced five separate
 * tools to grow their own `tenantSlug` escape hatch.
 */
export async function resolveActiveTenantFromCookieHeader(
  cookieHeader: string | null | undefined,
  user: { id: number | string; roles?: unknown } | null | undefined,
  hostTenantId?: number,
): Promise<number | undefined> {
  if (!user?.id || !cookieHeader) return undefined
  // Split rather than regex: a template-literal `\s` silently collapses to `s`,
  // so the pattern matched a literal ";s*" and every switch was ignored.
  const raw = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ACTIVE_ENDEAVOR_COOKIE}=`))
    ?.slice(ACTIVE_ENDEAVOR_COOKIE.length + 1)
  if (!raw) return undefined

  const overrideId = Number(decodeURIComponent(raw))
  if (!Number.isFinite(overrideId) || overrideId <= 0) return undefined
  if (hostTenantId != null && overrideId === hostTenantId) return undefined

  if (checkRole(ADMIN_ROLES, user as never)) return overrideId
  const membership = await getUserTenantMembership(user.id, overrideId).catch(() => null)
  return membership ? overrideId : undefined
}
