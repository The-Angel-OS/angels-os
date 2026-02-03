import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { TenantMembership, User } from '@/payload-types'

export type TenantRole = 'tenant_admin' | 'tenant_manager' | 'tenant_member'

export type TenantMembershipWithRole = Pick<
  TenantMembership,
  'id' | 'tenant' | 'role' | 'status' | 'permissions'
>

/**
 * Get all tenant memberships for a user.
 * Returns memberships with role and permissions for access checks.
 */
export async function getUserTenantRoles(
  userId: number | string,
): Promise<TenantMembershipWithRole[]> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'tenant-memberships',
    where: {
      user: { equals: userId },
      status: { equals: 'active' },
    },
    depth: 0,
    limit: 500,
  })

  return (result.docs || []) as TenantMembershipWithRole[]
}

/**
 * Get tenant membership for a specific user+tenant pair.
 */
export async function getUserTenantMembership(
  userId: number | string,
  tenantId: number | string,
): Promise<TenantMembershipWithRole | null> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: userId } },
        { tenant: { equals: tenantId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  return (result.docs?.[0] as TenantMembershipWithRole) ?? null
}
