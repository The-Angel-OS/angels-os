'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { leoSystemUserEmail, leoLegacyEmail } from '@/utilities/leoEmail'

export interface SaveBrandingInput {
  siteName: string
  tagline: string
  logoId: number | null
  coverImageId: number | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  foregroundColor: string
  borderColor: string
  headingFont: string
  bodyFont: string
  currency: string
  taxRate: number
  worksEnabled: boolean
  pageCommentsEnabled: boolean
}

export interface SaveLeoAndAiInput {
  angelName?: string
  displayName?: string
  personality?: string
  googleAiApiKey?: string
  openrouterApiKey?: string
  openaiApiKey?: string
  nvidiaApiKey?: string
  clearGoogleKey?: boolean
  clearOpenRouterKey?: boolean
  clearOpenAiKey?: boolean
  clearNvidiaKey?: boolean
  preferredImageProvider?: string
}

async function getPortalManagerContext() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenant: null, tenantId: null, error: 'Not authenticated' }
  }

  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId || !tenant) {
    return { payload, user, tenant: null, tenantId: null, error: 'Portal not found' }
  }

  if (!checkRole(ADMIN_ROLES, user)) {
    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: (user as { id: number | string }).id } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
          { role: { in: ['tenant_admin', 'tenant_manager'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (memberships.docs.length === 0) {
      return { payload, user, tenant: null, tenantId: null, error: 'Insufficient permissions' }
    }
  }

  return { payload, user, tenant, tenantId, error: null }
}

const mediaIdOf = (val: unknown): number | null => {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'object' && 'id' in (val as Record<string, unknown>)) {
    const n = Number((val as { id?: unknown }).id)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

/**
 * Save Branding, Colors, Fonts, Commerce defaults & Optional Surfaces on `Tenants`,
 * and sync core identity (`name`, `tagline`, `logo`, `coverImage`) to the tenant's
 * `Endeavors` doc when not explicitly overridden for directory listing.
 */
export async function savePortalBrandingAndGeneral(
  input: SaveBrandingInput,
): Promise<{ success: boolean; error?: string }> {
  const { payload, tenant, tenantId, error } = await getPortalManagerContext()
  if (error || !tenant || !tenantId) {
    return { success: false, error: error || 'Unauthorized' }
  }

  try {
    // Re-read raw doc with depth 0 so relational IDs are plain numbers when updating
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawTenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as any

    const prevLogoId = mediaIdOf(rawTenant?.branding?.logo)
    const prevCoverId = mediaIdOf(rawTenant?.storefront?.coverImage)

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        branding: {
          ...(rawTenant?.branding || {}),
          logo: input.logoId,
          siteName: input.siteName,
          tagline: input.tagline,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          accentColor: input.accentColor,
          backgroundColor: input.backgroundColor,
          foregroundColor: input.foregroundColor,
          borderColor: input.borderColor,
          headingFont: input.headingFont,
          bodyFont: input.bodyFont,
        },
        storefront: {
          ...(rawTenant?.storefront || {}),
          coverImage: input.coverImageId,
        },
        commerce: {
          ...(rawTenant?.commerce || {}),
          currency: input.currency,
          taxRate: Number.isFinite(input.taxRate) ? input.taxRate : 0,
        },
        features: {
          ...(rawTenant?.features || {}),
          works: Boolean(input.worksEnabled),
          pageComments: Boolean(input.pageCommentsEnabled),
        },
      } as never,
      overrideAccess: true,
    })

    // Keep Endeavor identity synced so Settings and Advanced stay single-source-of-truth
    try {
      const endeavors = await payload.find({
        collection: 'endeavors',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = endeavors.docs?.[0] as any
      if (existing) {
        const endLogoId = mediaIdOf(existing.logo)
        const endCoverId = mediaIdOf(existing.coverImage)
        const endPatch: Record<string, unknown> = {
          tagline: input.tagline,
        }
        if (input.siteName.trim()) {
          endPatch.name = input.siteName.trim()
        }
        // Only overwrite listing artwork if it was blank or previously mirrored site branding
        if (endLogoId === null || endLogoId === prevLogoId) {
          endPatch.logo = input.logoId
        }
        if (endCoverId === null || endCoverId === prevCoverId) {
          endPatch.coverImage = input.coverImageId
        }
        await payload.update({
          collection: 'endeavors',
          id: existing.id,
          data: endPatch as never,
          overrideAccess: true,
        })
      }
    } catch {
      // Non-fatal — tenant save already succeeded
    }

    revalidatePath('/dashboard/admin/settings')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save settings.',
    }
  }
}

/**
 * Save LEO assistant persona on the tenant's LEO system user and/or allowlisted
 * BYOK AI provider keys on `Tenants.aiConfig`.
 */
export async function saveLeoAndAiSettings(
  input: SaveLeoAndAiInput,
): Promise<{ success: boolean; error?: string }> {
  const { payload, tenant, tenantId, error } = await getPortalManagerContext()
  if (error || !tenant || !tenantId) {
    return { success: false, error: error || 'Unauthorized' }
  }

  try {
    // 1. Update LEO agent persona if any persona fields were submitted
    if (
      input.angelName !== undefined ||
      input.displayName !== undefined ||
      input.personality !== undefined
    ) {
      type LeoUserRecord = { id: number | string; agentConfig?: Record<string, unknown> | null }
      let leoUser: LeoUserRecord | null = null

      const byTenant = await payload.find({
        collection: 'users',
        where: {
          and: [
            { servesTenant: { equals: tenantId } },
            { 'agentConfig.agentType': { equals: 'leo' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (byTenant.docs?.[0]) {
        leoUser = byTenant.docs[0] as unknown as LeoUserRecord
      } else if (tenant.slug) {
        for (const email of [leoSystemUserEmail(tenant.slug), leoLegacyEmail(tenant.slug)]) {
          const byEmail = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          if (byEmail.docs?.[0]) {
            leoUser = byEmail.docs[0] as unknown as LeoUserRecord
            break
          }
        }
      }

      if (leoUser) {
        const curConfig = leoUser.agentConfig || {}
        await payload.update({
          collection: 'users',
          id: leoUser.id,
          data: {
            agentConfig: {
              ...curConfig,
              ...(input.angelName !== undefined ? { angelName: input.angelName.trim() || 'LEO' } : {}),
              ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
              ...(input.personality !== undefined ? { personality: input.personality } : {}),
            },
          } as never,
          overrideAccess: true,
        })
      }
    }

    // 2. Update allowlisted BYOK AI keys if any AI config fields were submitted
    const hasAiUpdates =
      input.googleAiApiKey !== undefined ||
      input.openrouterApiKey !== undefined ||
      input.openaiApiKey !== undefined ||
      input.nvidiaApiKey !== undefined ||
      input.clearGoogleKey ||
      input.clearOpenRouterKey ||
      input.clearOpenAiKey ||
      input.clearNvidiaKey ||
      input.preferredImageProvider !== undefined

    if (hasAiUpdates) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawTenant = (await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as any
      const nextAiConfig: Record<string, unknown> = { ...(rawTenant?.aiConfig || {}) }

      if (input.clearGoogleKey) nextAiConfig.googleAiApiKey = ''
      else if (input.googleAiApiKey?.trim()) nextAiConfig.googleAiApiKey = input.googleAiApiKey.trim()

      if (input.clearOpenRouterKey) nextAiConfig.openrouterApiKey = ''
      else if (input.openrouterApiKey?.trim()) nextAiConfig.openrouterApiKey = input.openrouterApiKey.trim()

      if (input.clearOpenAiKey) nextAiConfig.openaiApiKey = ''
      else if (input.openaiApiKey?.trim()) nextAiConfig.openaiApiKey = input.openaiApiKey.trim()

      if (input.clearNvidiaKey) nextAiConfig.nvidiaApiKey = ''
      else if (input.nvidiaApiKey?.trim()) nextAiConfig.nvidiaApiKey = input.nvidiaApiKey.trim()

      if (input.preferredImageProvider) {
        nextAiConfig.preferredImageProvider = input.preferredImageProvider
      }

      await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: { aiConfig: nextAiConfig } as never,
        overrideAccess: true,
      })
    }

    revalidatePath('/dashboard/admin/settings')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save AI configuration.',
    }
  }
}
