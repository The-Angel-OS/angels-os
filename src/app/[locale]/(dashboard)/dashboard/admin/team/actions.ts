'use server'

/**
 * Team Management — Server Actions
 *
 * CRUD operations for tenant memberships (role changes, permission updates,
 * suspend/revoke/reactivate). All actions verify the calling user has
 * manage_users permission before proceeding.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

// Re-export sendQuickInvite so the Team page can use a single import
export { sendQuickInvite } from '../invitations/actions'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean
  error?: string
}

// ── Auth Helper ──────────────────────────────────────────────────────────────

async function getAuthorizedUser() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenantId: null, error: 'Not authenticated' }
  }

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return { payload, user, tenantId: null, error: 'No tenant context' }
  }

  // Check platform-level admin OR tenant-level manage_users permission
  const roles = (user as any).roles as string[] | undefined
  const isPlatformAdmin = Boolean(
    roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
  )

  if (!isPlatformAdmin) {
    // Check tenant membership for manage_users permission
    const membership = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: user.id } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const doc = membership.docs[0] as any
    const isTA = doc?.role === 'tenant_admin'
    const hasPermission = Array.isArray(doc?.permissions) && doc.permissions.includes('manage_users')

    if (!isTA && !hasPermission) {
      return { payload, user, tenantId, error: 'Insufficient permissions' }
    }
  }

  return { payload, user, tenantId, error: null }
}

// ── Update Role ──────────────────────────────────────────────────────────────

export async function updateMemberRole(
  membershipId: number | string,
  newRole: string,
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  const validRoles = ['tenant_admin', 'tenant_manager', 'tenant_member']
  if (!validRoles.includes(newRole)) {
    return { success: false, error: 'Invalid role' }
  }

  try {
    // Verify the membership belongs to this tenant
    const existing = await payload.findByID({
      collection: 'tenant-memberships',
      id: membershipId,
      depth: 0,
      overrideAccess: true,
    })
    const existingTenant =
      typeof (existing as any).tenant === 'object'
        ? (existing as any).tenant?.id
        : (existing as any).tenant
    if (String(existingTenant) !== String(tenantId)) {
      return { success: false, error: 'Membership not found in this tenant' }
    }

    await payload.update({
      collection: 'tenant-memberships',
      id: membershipId,
      data: { role: newRole } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update role' }
  }
}

// ── Update Permissions ───────────────────────────────────────────────────────

export async function updateMemberPermissions(
  membershipId: number | string,
  permissions: string[],
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  const validPermissions = [
    'manage_users',
    'manage_spaces',
    'manage_content',
    'manage_products',
    'manage_orders',
    'view_analytics',
    'manage_settings',
    'manage_billing',
    'export_data',
  ]
  const filtered = permissions.filter((p) => validPermissions.includes(p))

  try {
    const existing = await payload.findByID({
      collection: 'tenant-memberships',
      id: membershipId,
      depth: 0,
      overrideAccess: true,
    })
    const existingTenant =
      typeof (existing as any).tenant === 'object'
        ? (existing as any).tenant?.id
        : (existing as any).tenant
    if (String(existingTenant) !== String(tenantId)) {
      return { success: false, error: 'Membership not found in this tenant' }
    }

    await payload.update({
      collection: 'tenant-memberships',
      id: membershipId,
      data: { permissions: filtered } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update permissions' }
  }
}

// ── Suspend / Revoke / Reactivate ────────────────────────────────────────────

async function changeStatus(
  membershipId: number | string,
  newStatus: string,
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  try {
    const existing = await payload.findByID({
      collection: 'tenant-memberships',
      id: membershipId,
      depth: 0,
      overrideAccess: true,
    })
    const existingTenant =
      typeof (existing as any).tenant === 'object'
        ? (existing as any).tenant?.id
        : (existing as any).tenant
    if (String(existingTenant) !== String(tenantId)) {
      return { success: false, error: 'Membership not found in this tenant' }
    }

    await payload.update({
      collection: 'tenant-memberships',
      id: membershipId,
      data: { status: newStatus } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update status' }
  }
}

export async function suspendMember(membershipId: number | string): Promise<ActionResult> {
  return changeStatus(membershipId, 'suspended')
}

export async function revokeMember(membershipId: number | string): Promise<ActionResult> {
  return changeStatus(membershipId, 'revoked')
}

export async function reactivateMember(membershipId: number | string): Promise<ActionResult> {
  return changeStatus(membershipId, 'active')
}
