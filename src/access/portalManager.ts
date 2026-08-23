import type { Access, FieldAccess, PayloadRequest } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Portal-manager access — the owner of a site may run their own site.
 *
 * Until 260822 every content write was `adminOnly`, i.e. a PLATFORM role. A
 * portal's own tenant_admin — the person whose site it is — could not create or
 * edit a single post, and the nine dashboard screens that link into
 * /admin/collections/... all dead-ended on "You are not allowed to access this
 * page". We were selling sites their owners could not edit.
 *
 * ⚠️ THE TENANT PLUGIN'S CLAMP IS NOT ENOUGH ON ITS OWN. `users.tenants` records
 * which tenants a user BELONGS to, with no role: Tyler is tenant_admin on
 * Clearwater and tenant_member on six other portals, and all seven sit in that
 * array. Widening the base check and letting the plugin narrow would have handed
 * her write access to other people's sites. Every check here therefore resolves
 * the role itself, from tenant-memberships.
 */

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

/** Per-request memo — Payload calls access many times while rendering one view. */
const cache = new WeakMap<PayloadRequest, Promise<number[]>>()

export const isPlatformAdmin = (user: unknown): boolean =>
  Boolean(user) && checkRole(ADMIN_ROLES, user as Parameters<typeof checkRole>[1])

/**
 * Tenant ids this user actively manages. Empty for everyone else, including
 * platform admins — callers short-circuit on those first.
 */
export async function managedTenantIds(req: PayloadRequest): Promise<number[]> {
  const user = req.user as { id?: number | string } | undefined
  if (!user?.id) return []

  const hit = cache.get(req)
  if (hit) return hit

  const promise = (async () => {
    try {
      const res = await req.payload.find({
        collection: 'tenant-memberships',
        where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
        depth: 0,
        limit: 500,
        overrideAccess: true,
      })
      const ids: number[] = []
      for (const doc of res.docs as Array<{ tenant?: unknown; role?: string }>) {
        if (!MANAGER_ROLES.has(String(doc.role))) continue
        const t = doc.tenant
        const id = Number(t && typeof t === 'object' ? (t as { id: unknown }).id : t)
        if (Number.isFinite(id)) ids.push(id)
      }
      return ids
    } catch {
      // Denied is the safe side of an unknown for a WRITE check.
      return []
    }
  })()

  cache.set(req, promise)
  return promise
}

/**
 * Read/update/delete: platform admins unrestricted, portal managers narrowed to
 * the tenants they manage, everyone else refused.
 */
export const adminOrPortalManager: Access = async ({ req }) => {
  if (!req.user) return false
  if (isPlatformAdmin(req.user)) return true
  const ids = await managedTenantIds(req)
  if (!ids.length) return false
  return { tenant: { in: ids } }
}

/**
 * Create must answer boolean — a Where cannot constrain a document that does not
 * exist yet. Being a manager somewhere earns the right to create; WHICH tenant
 * the new document lands on is enforced by `enforceManagedTenant`.
 */
export const adminOrPortalManagerCreate: Access = async ({ req }) => {
  if (!req.user) return false
  if (isPlatformAdmin(req.user)) return true
  return (await managedTenantIds(req)).length > 0
}

/** Field-level twin, for fields only the platform may set. */
export const platformAdminFieldAccess: FieldAccess = ({ req }) => isPlatformAdmin(req.user)
