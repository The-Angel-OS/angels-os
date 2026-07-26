import type { Access, Where } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Writes limited to tenants the user actually belongs to.
 *
 * The gap this closes: `({ req: { user } }) => Boolean(user)` reads as a check
 * but is only `authenticated` spelled differently. On a collection the
 * multi-tenant plugin does NOT wrap (it ANDs a tenant filter onto the ones it
 * registers), that means any signed-in customer can edit any tenant's rows —
 * including a service's price, which decides what a deposit charges.
 *
 * Returns a Where rather than a boolean so it works for update and delete as a
 * FILTER, not a gate. Admins are unscoped; guests get nothing.
 *
 * Server-side callers are unaffected: they use the Local API with
 * overrideAccess, which skips access entirely.
 */
export const isTenantMember: Access = async ({ req }) => {
  const user = req.user
  if (!user?.id) return false
  if (checkRole(ADMIN_ROLES, user)) return true

  const memberships = await req.payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    // `req` so this JOINs the request's own connection rather than acquiring a
    // second pooled one. @see docs/FOOTGUNS.md §2.1
    req,
  })

  const tenantIds = (memberships.docs || [])
    .map((m) => {
      const t = (m as { tenant?: unknown }).tenant
      return typeof t === 'object' && t !== null ? (t as { id?: number | string }).id : t
    })
    .filter((v): v is number | string => v != null)

  if (!tenantIds.length) return false
  return { tenant: { in: tenantIds } } as Where
}
