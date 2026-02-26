'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export interface TenantSummary {
  id: string | number
  name: string
  slug: string
  domain: string
  status: string
  type: string
  branding?: {
    siteName?: string
    tagline?: string
    primaryColor?: string
  }
  spacesCount: number
  usersCount: number
  createdAt: string
}

export async function getTenantsList(): Promise<{
  tenants: TenantSummary[]
  error?: string
}> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return { tenants: [], error: 'Not authenticated' }
    }

    // Check role - only super_admin and admin can see all tenants
    const roles = (user as any).roles as string[] | undefined
    const isAdmin = roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel')

    if (!isAdmin) {
      return { tenants: [], error: 'Insufficient permissions' }
    }

    const result = await payload.find({
      collection: 'tenants',
      limit: 100,
      depth: 0,
      overrideAccess: true,
      sort: '-createdAt',
    })

    // Batch all count queries in parallel (2 per tenant, flattened)
    const countQueries = result.docs.flatMap((tenant: any) => [
      payload.count({
        collection: 'spaces',
        where: { tenant: { equals: tenant.id } },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'tenant-memberships',
        where: { tenant: { equals: tenant.id } },
        overrideAccess: true,
      }),
    ])
    const counts = await Promise.all(countQueries)

    const tenants: TenantSummary[] = result.docs.map((tenant: any, i: number) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      status: tenant.status || 'active',
      type: tenant.type || 'tenant',
      branding: tenant.branding
        ? {
            siteName: tenant.branding.siteName,
            tagline: tenant.branding.tagline,
            primaryColor: tenant.branding.primaryColor,
          }
        : undefined,
      spacesCount: counts[i * 2].totalDocs,
      usersCount: counts[i * 2 + 1].totalDocs,
      createdAt: tenant.createdAt,
    }))

    return { tenants }
  } catch (err) {
    console.error('getTenantsList error:', err)
    return { tenants: [], error: err instanceof Error ? err.message : 'Failed to load tenants' }
  }
}

export async function updateTenantStatus(
  tenantId: string | number,
  status: 'active' | 'inactive',
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const roles = (user as any).roles as string[] | undefined
    if (!roles?.includes('super_admin') && !roles?.includes('archangel')) {
      return { success: false, error: 'Only super admins can change tenant status' }
    }

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: { status } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}
