'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { createSpaceFromTemplate, type EndeavorType } from '@/utilities/spaceProvisioning'
import {
  findOrCreateTenant,
  findOrCreateSystemAgent,
  findOrCreateTenantMembership,
  findOrCreateSpaceMembership,
} from '@/endpoints/seed/seed-helpers'
import { headers } from 'next/headers'

/** Nimue archetype - default LEO personality. */
const NIMUE_PERSONALITY = `I am Nimue, your Guardian Angel. I know everything about your endeavor - every product, every booking, every customer interaction. I manage your site, help your team, and guide your customers. I am patient, wise, and always learning. I serve with compassion and never forget that behind every transaction is a human being who deserves dignity and care.`

export interface WizardState {
  identity: {
    name: string
    slug: string
    domain: string
  }
  endeavorType: EndeavorType
  branding: {
    siteName: string
    tagline: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    headingFont: string
    bodyFont: string
  }
  nimue: {
    angelName: string
    personality: string
    domainExpertise: string
  }
}

export async function validateTenantIdentity(slug: string): Promise<{
  valid: boolean
  error?: string
}> {
  if (!slug || slug.length < 2) {
    return { valid: false, error: 'Slug must be at least 2 characters' }
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  }

  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    return { valid: false, error: 'This slug is already taken' }
  }

  return { valid: true }
}

export async function provisionTenant(state: WizardState): Promise<{
  success: boolean
  tenantId?: string | number
  tenantSlug?: string
  error?: string
}> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()

    // Get current user from auth
    const { user } = await payload.auth({ headers: headersList })
    if (!user) {
      return { success: false, error: 'You must be logged in to provision a tenant' }
    }

    // Create a request object for seed helpers
    const req = { payload, user, headers: headersList } as any

    // 1. Create tenant (status: provisioning)
    const tenant = await findOrCreateTenant(payload, req, {
      name: state.identity.name,
      slug: state.identity.slug,
      domain: state.identity.domain,
      branding: {
        siteName: state.branding.siteName || state.identity.name,
        tagline: state.branding.tagline,
        primaryColor: state.branding.primaryColor,
        secondaryColor: state.branding.secondaryColor,
        accentColor: state.branding.accentColor,
        headingFont: state.branding.headingFont,
        bodyFont: state.branding.bodyFont,
      },
    })

    // Set status to provisioning
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { status: 'provisioning' } as any,
      overrideAccess: true,
    })

    // 2. Create space from endeavor template
    const spaceName = `${state.identity.name} HQ`
    const { spaceId } = await createSpaceFromTemplate(
      payload,
      state.endeavorType,
      tenant.id,
      spaceName,
      req,
    )

    // 3. Create Nimue/LEO agent for this tenant
    const personality = state.nimue.domainExpertise
      ? `${state.nimue.personality}\n\nDomain expertise: ${state.nimue.domainExpertise}`
      : state.nimue.personality

    await findOrCreateSystemAgent(payload, req, {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      agentType: 'leo',
      displayName: state.nimue.angelName,
      personality,
    })

    // 4. Link current user as tenant_admin
    await findOrCreateTenantMembership(payload, req, {
      userId: user.id,
      tenantId: tenant.id,
      role: 'tenant_admin',
    })

    // 5. Link current user as space_admin
    await findOrCreateSpaceMembership(payload, req, {
      userId: user.id,
      spaceId,
      role: 'space_admin',
    })

    // 6. Activate tenant
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { status: 'active' } as any,
      overrideAccess: true,
    })

    return {
      success: true,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    }
  } catch (err) {
    console.error('Provision error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Provisioning failed',
    }
  }
}

/** Get the default Nimue personality for the wizard. */
export async function getDefaultPersonality(): Promise<string> {
  return NIMUE_PERSONALITY
}
