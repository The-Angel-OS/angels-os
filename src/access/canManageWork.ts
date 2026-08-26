/**
 * Who may write a Work's content: a platform admin, or a tenant_admin /
 * tenant_manager of the endeavor that OWNS it (`works.owner` is a tenant SLUG,
 * federation-stable, so it resolves through `tenants.slug`).
 *
 * Lifted out of `endpoints/work-content.ts` so the Course Studio's save button
 * and the `work-chapters` collection answer the question the same way.
 */
import type { Payload } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export async function canManageWork(
  payload: Payload,
  user: unknown,
  ownerSlug: string | null | undefined,
): Promise<boolean> {
  const u = user as { id?: number | string } | null
  if (!u?.id) return false
  if (checkRole(ADMIN_ROLES, user as never)) return true
  if (!ownerSlug) return false

  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: String(ownerSlug) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const ownerId = tenants.docs?.[0]?.id
  if (!ownerId) return false

  const m = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: u.id } },
        { tenant: { equals: ownerId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const role = (m.docs?.[0] as { role?: string } | undefined)?.role
  return role === 'tenant_admin' || role === 'tenant_manager'
}
