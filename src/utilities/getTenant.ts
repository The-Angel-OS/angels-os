import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Media } from '@/payload-types'

export interface TenantWithTypedRefs {
  id: number
  name: string
  slug: string
  subdomain?: string | null
  domain?: string | null
  businessType: string
  status: string
  configuration?: {
    primaryColor?: string | null
    logo?: (number | null) | Media
    favicon?: (number | null) | Media
    contactEmail?: string | null
    contactPhone?: string | null
    address?: {
      street?: string | null
      city?: string | null
      state?: string | null
      zipCode?: string | null
      country?: string | null
    }
  }
  features?: {
    ecommerce?: boolean | null
    spaces?: boolean | null
    crm?: boolean | null
    vapi?: boolean | null
    n8n?: boolean | null
    memberPortal?: boolean | null
  }
  limits?: {
    maxUsers?: number | null
    maxProducts?: number | null
    maxStorage?: number | null
  }
}

/**
 * Get tenant information from the current request context
 */
export async function getCurrentTenant(): Promise<TenantWithTypedRefs | null> {
  try {
    const headersList = await headers()
    const subdomain = headersList.get('x-tenant-subdomain')

    if (!subdomain) {
      return null
    }

    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'tenants',
      where: {
        subdomain: {
          equals: subdomain,
        },
        status: {
          equals: 'active',
        },
      },
      limit: 1,
    })

    if (result.docs.length === 0) {
      return null
    }

    return result.docs[0] as TenantWithTypedRefs
  } catch (error) {
    console.error('Error getting current tenant:', error)
    return null
  }
}

/**
 * Get tenant by subdomain
 */
export async function getTenantBySubdomain(subdomain: string): Promise<TenantWithTypedRefs | null> {
  try {
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'tenants',
      where: {
        subdomain: {
          equals: subdomain,
        },
        status: {
          equals: 'active',
        },
      },
      limit: 1,
    })

    if (result.docs.length === 0) {
      return null
    }

    return result.docs[0] as TenantWithTypedRefs
  } catch (error) {
    console.error('Error getting tenant by subdomain:', error)
    return null
  }
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<TenantWithTypedRefs | null> {
  try {
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'tenants',
      where: {
        slug: {
          equals: slug,
        },
        status: {
          equals: 'active',
        },
      },
      limit: 1,
    })

    if (result.docs.length === 0) {
      return null
    }

    return result.docs[0] as TenantWithTypedRefs
  } catch (error) {
    console.error('Error getting tenant by slug:', error)
    return null
  }
}

/**
 * Check if a user belongs to a tenant
 */
export function userBelongsToTenant(
  userId: number,
  tenantId: number,
  userTenantId?: number,
): boolean {
  if (!userTenantId) return false
  return userTenantId === tenantId
}

/**
 * Get tenant-specific configuration for UI components
 */
export function getTenantConfig(tenant: TenantWithTypedRefs | null) {
  if (!tenant) {
    return {
      primaryColor: '#3b82f6',
      name: 'Spaces Commerce',
      logo: null,
      favicon: null,
      contactEmail: 'support@kendev.co',
      contactPhone: null,
    }
  }

  return {
    primaryColor: tenant.configuration?.primaryColor || '#3b82f6',
    name: tenant.name,
    logo: tenant.configuration?.logo,
    favicon: tenant.configuration?.favicon,
    contactEmail: tenant.configuration?.contactEmail || 'support@kendev.co',
    contactPhone: tenant.configuration?.contactPhone,
    address: tenant.configuration?.address,
  }
}

/**
 * Check if a feature is enabled for a tenant
 */
export function isTenantFeatureEnabled(
  tenant: TenantWithTypedRefs | null,
  feature: keyof NonNullable<TenantWithTypedRefs['features']>,
): boolean {
  if (!tenant) return false
  return tenant.features?.[feature] || false
}
