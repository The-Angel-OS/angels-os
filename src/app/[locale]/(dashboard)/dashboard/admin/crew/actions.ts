'use server'

/**
 * Crew Relations — Server Actions
 *
 * CRUD for crew-assignments: maps tenant members to departments, stations,
 * ranks, watches and duty status within the tenant's Endeavor (its "ship").
 * All actions verify the caller has manage_users permission or is a platform
 * admin, and that the target belongs to the current tenant.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export interface CrewActionResult {
  success: boolean
  error?: string
  id?: string
}

export const DEPARTMENTS = ['bridge', 'engineering', 'operations', 'science', 'communications', 'medical', 'security', 'logistics'] as const
export const RANKS = ['captain', 'commander', 'lt_commander', 'lieutenant', 'ensign', 'specialist', 'cadet'] as const
export const DUTY_STATUSES = ['active_duty', 'shore_leave', 'detached', 'reserve'] as const
export const WATCH_SECTIONS = ['alpha', 'beta', 'gamma', 'delta'] as const

interface CrewInput {
  membershipId: string | number
  department: string
  rank: string
  station?: string
  dutyStatus?: string
  watchSection?: string
}

async function getAuthorizedUser() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) return { payload, user: null, tenantId: null, isPlatformAdmin: false, error: 'Not authenticated' }

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return { payload, user, tenantId: null, isPlatformAdmin: false, error: 'No tenant context' }

  const isPlatformAdmin = checkRole(ADMIN_ROLES, user)
  if (!isPlatformAdmin) {
    const membership = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [{ user: { equals: user.id } }, { tenant: { equals: tenantId } }, { status: { equals: 'active' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = membership.docs[0] as any
    const isTA = doc?.role === 'tenant_admin'
    const hasPermission = Array.isArray(doc?.permissions) && doc.permissions.includes('manage_users')
    if (!isTA && !hasPermission) return { payload, user, tenantId, isPlatformAdmin, error: 'Insufficient permissions' }
  }
  return { payload, user, tenantId, isPlatformAdmin, error: null }
}

/** Resolve the tenant's Endeavor (the ship crew is assigned to). */
async function resolveEndeavorId(payload: any, tenantId: string | number): Promise<string | number | null> {
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return endeavors.docs?.[0]?.id ?? null
}

function validate(input: Partial<CrewInput>): string | null {
  if (input.department && !DEPARTMENTS.includes(input.department as any)) return 'Invalid department'
  if (input.rank && !RANKS.includes(input.rank as any)) return 'Invalid rank'
  if (input.dutyStatus && !DUTY_STATUSES.includes(input.dutyStatus as any)) return 'Invalid duty status'
  if (input.watchSection && !WATCH_SECTIONS.includes(input.watchSection as any)) return 'Invalid watch section'
  return null
}

/** Confirm a crew assignment belongs to the tenant's endeavor. */
async function assignmentInTenant(payload: any, id: string | number, endeavorId: string | number): Promise<boolean> {
  try {
    const doc = await payload.findByID({ collection: 'crew-assignments', id, depth: 0, overrideAccess: true })
    const e = typeof (doc as any).endeavor === 'object' ? (doc as any).endeavor?.id : (doc as any).endeavor
    return String(e) === String(endeavorId)
  } catch {
    return false
  }
}

export async function assignCrew(input: CrewInput): Promise<CrewActionResult> {
  const { payload, user, tenantId, error } = await getAuthorizedUser()
  if (error || !user || !tenantId) return { success: false, error: error || 'Unauthorized' }

  const invalid = validate(input)
  if (invalid) return { success: false, error: invalid }
  if (!input.membershipId || !input.department || !input.rank) {
    return { success: false, error: 'Member, department, and rank are required' }
  }

  const endeavorId = await resolveEndeavorId(payload, tenantId)
  if (!endeavorId) return { success: false, error: 'No Endeavor found for this tenant' }

  // Membership must belong to this tenant
  try {
    const m = await payload.findByID({ collection: 'tenant-memberships', id: input.membershipId, depth: 0, overrideAccess: true })
    const mTenant = typeof (m as any).tenant === 'object' ? (m as any).tenant?.id : (m as any).tenant
    if (String(mTenant) !== String(tenantId)) return { success: false, error: 'Member not in this tenant' }
  } catch {
    return { success: false, error: 'Member not found' }
  }

  try {
    const created = await payload.create({
      collection: 'crew-assignments',
      data: {
        membership: input.membershipId,
        endeavor: endeavorId,
        department: input.department,
        rank: input.rank,
        station: input.station || undefined,
        dutyStatus: input.dutyStatus || 'active_duty',
        watchSection: input.watchSection || undefined,
        assignedAt: new Date().toISOString(),
        assignedBy: user.id,
      } as any,
      overrideAccess: true,
    })
    return { success: true, id: String(created.id) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to assign crew' }
  }
}

export async function updateCrewAssignment(
  id: string | number,
  patch: Partial<Pick<CrewInput, 'department' | 'rank' | 'station' | 'dutyStatus' | 'watchSection'>>,
): Promise<CrewActionResult> {
  const { payload, user, tenantId, error } = await getAuthorizedUser()
  if (error || !user || !tenantId) return { success: false, error: error || 'Unauthorized' }

  const invalid = validate(patch)
  if (invalid) return { success: false, error: invalid }

  const endeavorId = await resolveEndeavorId(payload, tenantId)
  if (!endeavorId || !(await assignmentInTenant(payload, id, endeavorId))) {
    return { success: false, error: 'Assignment not found in this tenant' }
  }

  try {
    await payload.update({
      collection: 'crew-assignments',
      id,
      data: {
        ...(patch.department ? { department: patch.department } : {}),
        ...(patch.rank ? { rank: patch.rank } : {}),
        ...(patch.station !== undefined ? { station: patch.station } : {}),
        ...(patch.dutyStatus ? { dutyStatus: patch.dutyStatus } : {}),
        ...(patch.watchSection ? { watchSection: patch.watchSection } : {}),
      } as any,
      overrideAccess: true,
    })
    return { success: true, id: String(id) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to update assignment' }
  }
}

export async function removeCrewAssignment(id: string | number): Promise<CrewActionResult> {
  const { payload, user, tenantId, error } = await getAuthorizedUser()
  if (error || !user || !tenantId) return { success: false, error: error || 'Unauthorized' }

  const endeavorId = await resolveEndeavorId(payload, tenantId)
  if (!endeavorId || !(await assignmentInTenant(payload, id, endeavorId))) {
    return { success: false, error: 'Assignment not found in this tenant' }
  }

  try {
    await payload.delete({ collection: 'crew-assignments', id, overrideAccess: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to remove assignment' }
  }
}
