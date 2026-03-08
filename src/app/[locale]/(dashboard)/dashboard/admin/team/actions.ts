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
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { ALL_PERMISSION_KEYS } from '@/constants/permissions'
import type { TenantRole } from '@/constants/permissions'

// NOTE: sendQuickInvite lives in ../invitations/actions — import directly from there.
// Re-exports are NOT allowed in 'use server' files (Turbopack treats them as non-async).

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
  const isPlatformAdmin = checkRole(ADMIN_ROLES, user)

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
    const hasPermission =
      Array.isArray(doc?.permissions) && doc.permissions.includes('manage_users')

    if (!isTA && !hasPermission) {
      return { payload, user, tenantId, error: 'Insufficient permissions' }
    }
  }

  return { payload, user, tenantId, error: null }
}

// ── Shared: verify membership belongs to tenant ──────────────────────────────

async function verifyMembershipTenant(
  payload: Awaited<ReturnType<typeof getPayload>>,
  membershipId: number | string,
  tenantId: number | string,
) {
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
    return { verified: false as const, error: 'Membership not found in this tenant' }
  }
  return { verified: true as const }
}

// ── Update Member (role + permissions in one call) ───────────────────────────

const VALID_ROLES: TenantRole[] = ['tenant_admin', 'tenant_manager', 'tenant_member']

export async function updateMember(
  membershipId: number | string,
  data: { role?: string; permissions?: string[] },
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  // Validate inputs
  if (data.role && !VALID_ROLES.includes(data.role as TenantRole)) {
    return { success: false, error: 'Invalid role' }
  }

  try {
    const check = await verifyMembershipTenant(payload, membershipId, tenantId)
    if (!check.verified) return { success: false, error: check.error }

    // Build update payload — only include changed fields
    const updateData: Record<string, unknown> = {}
    if (data.role) updateData.role = data.role
    if (data.permissions) {
      updateData.permissions = data.permissions.filter((p) =>
        ALL_PERMISSION_KEYS.includes(p as any),
      )
    }

    if (Object.keys(updateData).length > 0) {
      await payload.update({
        collection: 'tenant-memberships',
        id: membershipId,
        data: updateData as any,
        overrideAccess: true,
      })
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update member' }
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
    const check = await verifyMembershipTenant(payload, membershipId, tenantId)
    if (!check.verified) return { success: false, error: check.error }

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

// ── Space Membership Actions ─────────────────────────────────────────────────

/**
 * Fetch all spaces and space-memberships for a given user within the current tenant.
 * Returns space names + membership IDs for display in TeamManager.
 */
export async function fetchMemberSpaces(
  userId: number | string,
): Promise<{ success: boolean; spaces?: { spaceId: string; spaceName: string; membershipId: string; role: string }[]; error?: string }> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  try {
    const memberships = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      depth: 1,
      limit: 50,
      overrideAccess: true,
    })

    const spaces = (memberships.docs || []).map((doc: any) => {
      const space = typeof doc.space === 'object' ? doc.space : null
      return {
        spaceId: String(space?.id || doc.space),
        spaceName: space?.name || 'Unknown Space',
        membershipId: String(doc.id),
        role: doc.role || 'member',
      }
    })

    return { success: true, spaces }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch spaces' }
  }
}

/**
 * Add a user to a specific space within the current tenant.
 */
export async function addMemberToSpace(
  userId: number | string,
  spaceId: number | string,
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  try {
    // Create directly — if a duplicate exists the DB unique constraint
    // or a subsequent find-based idempotency check handles it.
    // This avoids a TOCTOU race (check-then-create).
    await payload.create({
      collection: 'space-memberships',
      data: {
        user: Number(userId),
        space: Number(spaceId),
        role: 'member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        tenant: Number(tenantId),
      } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err: any) {
    // Treat duplicate/constraint errors as idempotent success
    if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
      return { success: true }
    }
    return { success: false, error: err?.message || 'Failed to add to space' }
  }
}

/**
 * Add a user to ALL spaces within the current tenant.
 */
export async function addMemberToAllSpaces(
  userId: number | string,
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  try {
    // Parallel reads — these two queries are independent
    const [spaces, existingMemberships] = await Promise.all([
      payload.find({
        collection: 'spaces',
        where: { tenant: { equals: tenantId } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'space-memberships',
        where: {
          and: [
            { user: { equals: userId } },
            { tenant: { equals: tenantId } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const existingSpaceIds = new Set(
      existingMemberships.docs.map((d: any) =>
        String(typeof d.space === 'object' ? d.space?.id : d.space),
      ),
    )

    const toAdd = spaces.docs.filter((space) => !existingSpaceIds.has(String(space.id)))
    const now = new Date().toISOString()

    // Parallel writes — avoids N+1 sequential DB round-trips
    const results = await Promise.allSettled(
      toAdd.map((space) =>
        payload.create({
          collection: 'space-memberships',
          data: {
            user: Number(userId),
            space: Number(space.id),
            role: 'member',
            status: 'active',
            joinedAt: now,
            tenant: Number(tenantId),
          } as any,
          overrideAccess: true,
        }),
      ),
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn(`[addMemberToAllSpaces] ${failed.length}/${toAdd.length} additions failed`)
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to add to all spaces' }
  }
}

/**
 * Remove a user from a specific space (set status to 'left').
 * Verifies the space-membership belongs to the current tenant before modifying.
 */
export async function removeMemberFromSpace(
  membershipId: number | string,
): Promise<ActionResult> {
  const { payload, tenantId, error } = await getAuthorizedUser()
  if (error || !tenantId) return { success: false, error: error || 'Auth failed' }

  try {
    // Verify this space-membership belongs to the current tenant
    const existing = await payload.findByID({
      collection: 'space-memberships',
      id: membershipId,
      depth: 0,
      overrideAccess: true,
    })
    const existingTenant =
      typeof (existing as any).tenant === 'object'
        ? (existing as any).tenant?.id
        : (existing as any).tenant
    if (String(existingTenant) !== String(tenantId)) {
      return { success: false, error: 'Space membership not found in this tenant' }
    }

    await payload.update({
      collection: 'space-memberships',
      id: membershipId,
      data: { status: 'left' } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to remove from space' }
  }
}
