'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export interface TenantDetail {
  id: string | number
  name: string
  slug: string
  domain: string
  additionalDomains?: string[]
  status: string
  type: string
  businessType?: string
  branding?: {
    siteName?: string
    tagline?: string
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    backgroundColor?: string
    foregroundColor?: string
    borderColor?: string
    headingFont?: string
    bodyFont?: string
    logoUrl?: string | null
  }
  storefront?: {
    description?: string
    contactEmail?: string
    contactPhone?: string
    socialLinks?: Array<{ platform: string; url: string }>
  }
  commerce?: {
    currency?: string
    taxRate?: number
    enableShipping?: boolean
    enableBookings?: boolean
    enableEvents?: boolean
    enableDigitalProducts?: boolean
  }
  stripeConnect?: {
    accountId?: string
    onboardingComplete?: boolean
    payoutsEnabled?: boolean
    chargesEnabled?: boolean
  }
  spacesCount: number
  membersCount: number
  messagesCount: number
  productsCount: number
  ordersCount: number
  spaces: Array<{
    id: string | number
    name: string
    slug: string
    visibility: string
    channelCount: number
  }>
  members: Array<{
    id: string | number
    userId: string | number
    userName: string
    userEmail: string
    roles: string[]
    status: string
  }>
  lastActivity?: string
  createdAt: string
  updatedAt: string
}

async function requireAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) throw new Error('Not authenticated')

  if (!checkRole(ADMIN_ROLES, user)) throw new Error('Insufficient permissions')

  return { payload, user }
}

export async function getTenantDetail(
  id: string,
): Promise<{ tenant?: TenantDetail; error?: string }> {
  try {
    const { payload } = await requireAdmin()

    const tenant = await payload.findByID({
      collection: 'tenants',
      id,
      depth: 1,
      overrideAccess: true,
    })

    if (!tenant) return { error: 'Tenant not found' }

    // Parallel counts + recent message (all in one batch)
    const [spacesResult, membersResult, messagesCount, productsCount, ordersCount, recentMsg] =
      await Promise.all([
        payload.find({
          collection: 'spaces',
          where: { tenant: { equals: tenant.id } },
          limit: 50,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'tenant-memberships',
          where: { tenant: { equals: tenant.id } },
          depth: 1,
          limit: 100,
          overrideAccess: true,
        }),
        payload.count({
          collection: 'messages',
          where: { tenant: { equals: tenant.id } },
          overrideAccess: true,
        }),
        payload.count({
          collection: 'products',
          where: { tenant: { equals: tenant.id } },
          overrideAccess: true,
        }).catch(() => ({ totalDocs: 0 })),
        payload.count({
          collection: 'orders',
          where: { tenant: { equals: tenant.id } },
          overrideAccess: true,
        }).catch(() => ({ totalDocs: 0 })),
        payload.find({
          collection: 'messages',
          where: { tenant: { equals: tenant.id } },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
      ])

    // Fetch channel counts per space
    const spacesWithChannels = await Promise.all(
      spacesResult.docs.map(async (space: any) => {
        const channels = await payload.count({
          collection: 'channels',
          where: { space: { equals: space.id } },
          overrideAccess: true,
        })
        return {
          id: space.id,
          name: space.name,
          slug: space.slug,
          visibility: space.visibility || 'public',
          channelCount: channels.totalDocs,
        }
      }),
    )

    // Map members
    const members = membersResult.docs.map((m: any) => {
      const user = m.user
      return {
        id: m.id,
        userId: typeof user === 'object' ? user.id : user,
        userName: typeof user === 'object' ? user.name || user.email || 'Unknown' : 'Unknown',
        userEmail: typeof user === 'object' ? user.email || '' : '',
        roles: m.roles || [],
        status: m.status || 'active',
      }
    })

    const t = tenant as any
    const logo = t.branding?.logo
    const logoUrl =
      typeof logo === 'object' && logo !== null && 'url' in logo ? logo.url : null

    return {
      tenant: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        domain: t.domain || '',
        additionalDomains: t.additionalDomains?.map((d: any) => d.domain).filter(Boolean) || [],
        status: t.status || 'active',
        type: t.type || 'tenant',
        businessType: t.businessType,
        branding: {
          siteName: t.branding?.siteName,
          tagline: t.branding?.tagline,
          primaryColor: t.branding?.primaryColor,
          secondaryColor: t.branding?.secondaryColor,
          accentColor: t.branding?.accentColor,
          backgroundColor: t.branding?.backgroundColor,
          foregroundColor: t.branding?.foregroundColor,
          borderColor: t.branding?.borderColor,
          headingFont: t.branding?.headingFont,
          bodyFont: t.branding?.bodyFont,
          logoUrl,
        },
        storefront: t.storefront
          ? {
              description: t.storefront.description,
              contactEmail: t.storefront.contactEmail,
              contactPhone: t.storefront.contactPhone,
              socialLinks: t.storefront.socialLinks,
            }
          : undefined,
        commerce: t.commerce
          ? {
              currency: t.commerce.currency,
              taxRate: t.commerce.taxRate,
              enableShipping: t.commerce.enableShipping,
              enableBookings: t.commerce.enableBookings,
              enableEvents: t.commerce.enableEvents,
              enableDigitalProducts: t.commerce.enableDigitalProducts,
            }
          : undefined,
        stripeConnect: t.stripeConnect?.accountId
          ? {
              accountId: t.stripeConnect.accountId,
              onboardingComplete: t.stripeConnect.onboardingComplete,
              payoutsEnabled: t.stripeConnect.payoutsEnabled,
              chargesEnabled: t.stripeConnect.chargesEnabled,
            }
          : undefined,
        spacesCount: spacesResult.totalDocs,
        membersCount: membersResult.totalDocs,
        messagesCount: messagesCount.totalDocs,
        productsCount: productsCount.totalDocs,
        ordersCount: ordersCount.totalDocs,
        spaces: spacesWithChannels,
        members,
        lastActivity: recentMsg.docs?.[0]?.createdAt || undefined,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      },
    }
  } catch (err) {
    console.error('getTenantDetail error:', err)
    return { error: err instanceof Error ? err.message : 'Failed to load tenant' }
  }
}

export async function updateTenantBranding(
  tenantId: string | number,
  data: {
    siteName?: string
    tagline?: string
    primaryColor?: string
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { payload } = await requireAdmin()

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        branding: data,
      } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' }
  }
}

export async function deactivateTenant(
  tenantId: string | number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { payload } = await requireAdmin()

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: { status: 'inactive' } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Deactivation failed' }
  }
}
