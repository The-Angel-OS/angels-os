'use server'

/**
 * Endeavor Setup — Server Actions
 *
 * Fetch and update the Endeavor (constitutional identity) for the current tenant.
 * Admin-only. Follows the getAuthenticatedAdmin() pattern from contacts/actions.ts.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EndeavorData {
  id?: string | number
  name: string
  tagline: string
  description: string
  endeavorType: string
  holonTypes: string[]
  missionStatement: string
  capabilities: { skill: string; description: string }[]
  region: { city: string; state: string; country: string }
  federation: {
    networkVisible: boolean
    ministryStatus: string
    federationId: string
    constitutionVersion: string
  }
  status: string
  operator: { name: string; email: string; role: string }
}

export interface EndeavorResult {
  success: boolean
  endeavor: EndeavorData | null
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenantId: null, error: 'Not authenticated' }
  }

  const isAdmin = checkRole(ADMIN_ROLES, user)

  if (!isAdmin) {
    return { payload, user, tenantId: null, error: 'Insufficient permissions' }
  }

  // Resolve tenant the SAME way the dashboard layout does — x-tenant-id, then a
  // host/domain lookup, then DEFAULT_TENANT_SLUG. The previous hand-rolled
  // `x-tenant-id || 'default'` lacked the domain fallback, so on an apex/
  // federation host (no subdomain header, e.g. federation.kendev.co) it resolved
  // a non-existent 'default' tenant → "Tenant not found" → the page's
  // "Unable to load Endeavor data" dead-end even though an endeavor existed.
  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return { payload, user, tenantId: null, error: 'Tenant not found' }
  }

  return { payload, user, tenantId, error: null }
}

// ── getEndeavor ──────────────────────────────────────────────────────────────

/**
 * Fetch the Endeavor for the current tenant.
 */
export async function getEndeavor(): Promise<EndeavorResult> {
  const { payload, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId) {
    return { success: false, endeavor: null, error: error || 'Tenant not found' }
  }

  const result = await payload.find({
    collection: 'endeavors',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = result.docs[0] as any
  if (!doc) {
    return { success: true, endeavor: null }
  }

  return {
    success: true,
    endeavor: {
      id: doc.id,
      name: doc.name || '',
      tagline: doc.tagline || '',
      description: doc.description || '',
      endeavorType: doc.endeavorType || 'custom',
      holonTypes: doc.holonTypes || [],
      missionStatement: doc.missionStatement || '',
      capabilities: (doc.capabilities || []).map((c: any) => ({
        skill: c.skill || '',
        description: c.description || '',
      })),
      region: {
        city: doc.region?.city || '',
        state: doc.region?.state || '',
        country: doc.region?.country || 'US',
      },
      federation: {
        networkVisible: doc.federation?.networkVisible || false,
        ministryStatus: doc.federation?.ministryStatus || 'applicant',
        federationId: doc.federation?.federationId || '',
        constitutionVersion: doc.federation?.constitutionVersion || '1.1',
      },
      status: doc.status || 'forming',
      operator: {
        name: doc.operator?.name || '',
        email: doc.operator?.email || '',
        role: doc.operator?.role || '',
      },
    },
  }
}

// ── updateEndeavor ───────────────────────────────────────────────────────────

/**
 * Update (or create) the Endeavor for the current tenant.
 */
export async function updateEndeavor(
  data: Partial<EndeavorData>,
): Promise<{ success: boolean; error?: string }> {
  const { payload, user, tenantId, error } = await getAuthenticatedAdmin()
  if (error || !tenantId || !user) {
    return { success: false, error: error || 'Auth failed' }
  }

  // Find existing endeavor for this tenant
  const existing = await payload.find({
    collection: 'endeavors',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const updateData: Record<string, any> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.tagline !== undefined) updateData.tagline = data.tagline
  if (data.description !== undefined) updateData.description = data.description
  if (data.endeavorType !== undefined) updateData.endeavorType = data.endeavorType
  if (data.holonTypes !== undefined) updateData.holonTypes = data.holonTypes
  if (data.missionStatement !== undefined) updateData.missionStatement = data.missionStatement
  if (data.capabilities !== undefined) updateData.capabilities = data.capabilities
  if (data.region !== undefined) updateData.region = data.region
  if (data.operator !== undefined) updateData.operator = data.operator
  if (data.federation?.networkVisible !== undefined) {
    updateData.federation = {
      ...(existing.docs[0] as any)?.federation,
      networkVisible: data.federation.networkVisible,
    }
  }

  if (existing.docs[0]) {
    // Update existing
    await payload.update({
      collection: 'endeavors',
      id: existing.docs[0].id,
      data: updateData,
      overrideAccess: true,
    })
  } else {
    // Create new endeavor for this tenant
    await payload.create({
      collection: 'endeavors',
      data: {
        ...updateData,
        tenant: tenantId,
        name: data.name || 'My Enterprise',
        endeavorType: data.endeavorType || 'custom',
        status: 'forming',
      } as any,
      overrideAccess: true,
    })
  }

  return { success: true }
}
