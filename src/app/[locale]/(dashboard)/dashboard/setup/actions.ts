'use server'

/**
 * Enterprise Setup Wizard — Server Actions
 *
 * Handles wizard progress persistence, channel creation, and setup-required checks.
 * All functions require an authenticated user (next-intl headers / Payload auth).
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

// ── Types ─────────────────────────────────────────────────────────────────

export interface WizardProgress {
  currentStep: number
  completedSteps: number[]
  enterpriseName?: string
  operatorName?: string
  endeavorType?: string
  completedAt?: string
  // Encrypted key pair stored by federation/keyStore — do not touch directly
  encryptedPrivateKey?: string
  publicKey?: string
  federationId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function resolveTenantId(): Promise<number | null> {
  // Shared resolution (x-tenant-id → domain → DEFAULT_TENANT_SLUG); apex-safe.
  const { tenantId } = await resolveTenantFromHeaders()
  return (tenantId as number) ?? null
}

// ── checkIsAdmin ─────────────────────────────────────────────────────────────

/**
 * Returns true if the current user has an admin-level platform role.
 * Used to guard the setup page from non-admin users.
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    if (!user) return false
    return checkRole(ADMIN_ROLES, user)
  } catch {
    return false
  }
}

// ── checkSetupRequired ─────────────────────────────────────────────────────

/**
 * Returns true if this Enterprise still needs to complete the Leo Wizard.
 * Used by layout.tsx to decide whether to show the "Enterprise Setup" nav link.
 */
export async function checkSetupRequired(): Promise<boolean> {
  try {
    const payload = await getPayload({ config })
    const tenantId = await resolveTenantId()
    if (!tenantId) return false

    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    // Explicit flag wins — set when the Leo Wizard is walked to completion.
    if ((tenant as any)?.setup?.wizardComplete === true) return false

    // Robustness: seed/provisioned tenants never walk the wizard, so the flag is
    // never set — yet they're clearly established. Infer completion from real
    // content so an established Enterprise stops showing "Enterprise Setup". A
    // fresh wizard tenant has no content yet, so it still sees the wizard. (This
    // only governs the NAV link; the /dashboard/setup page stays reachable, since
    // it keys off the explicit flag.)
    const [products, posts, pages] = await Promise.all([
      payload.count({ collection: 'products', where: { tenant: { equals: tenantId } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'posts', where: { tenant: { equals: tenantId } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'pages', where: { tenant: { equals: tenantId } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
    ])
    const isEstablished = products.totalDocs > 0 || posts.totalDocs > 0 || pages.totalDocs > 0
    return !isEstablished
  } catch {
    return false
  }
}

// ── getWizardProgress ─────────────────────────────────────────────────────

/**
 * Returns the current wizard progress for the authenticated tenant.
 */
export async function getWizardProgress(): Promise<{
  progress: WizardProgress
  wizardComplete: boolean
  tenantId: number | null
}> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return { progress: { currentStep: 0, completedSteps: [] }, wizardComplete: false, tenantId: null }
    }

    const tenantId = await resolveTenantId()
    if (!tenantId) {
      return { progress: { currentStep: 0, completedSteps: [] }, wizardComplete: false, tenantId: null }
    }

    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    const setup = (tenant as any)?.setup ?? {}
    const wizardComplete: boolean = setup.wizardComplete === true
    const rawProgress = setup.wizardProgress

    const progress: WizardProgress =
      rawProgress && typeof rawProgress === 'object'
        ? (rawProgress as WizardProgress)
        : { currentStep: 0, completedSteps: [] }

    // Inject operator name from user if not set yet
    if (!progress.operatorName && user) {
      progress.operatorName = (user as any).name || (user as any).email?.split('@')[0] || 'Operator'
    }

    return { progress, wizardComplete, tenantId }
  } catch (err) {
    console.error('[WizardActions] getWizardProgress error:', err)
    return { progress: { currentStep: 0, completedSteps: [] }, wizardComplete: false, tenantId: null }
  }
}

// ── saveWizardProgress ────────────────────────────────────────────────────

/**
 * Persists wizard progress to tenant.setup.wizardProgress JSON field.
 * Called by the wizard UI after each step completes.
 */
export async function saveWizardProgress(
  partialProgress: Partial<WizardProgress>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user) return { success: false, error: 'Not authenticated' }

    const tenantId = await resolveTenantId()
    if (!tenantId) return { success: false, error: 'Tenant not found' }

    // Merge with existing progress
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    const existingProgress: WizardProgress =
      ((tenant as any)?.setup?.wizardProgress as WizardProgress) ?? {
        currentStep: 0,
        completedSteps: [],
      }

    const updatedProgress: WizardProgress = {
      ...existingProgress,
      ...partialProgress,
      // Merge completedSteps (union)
      completedSteps: Array.from(
        new Set([
          ...(existingProgress.completedSteps ?? []),
          ...(partialProgress.completedSteps ?? []),
        ]),
      ).sort((a, b) => a - b),
    }

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        setup: {
          wizardProgress: updatedProgress,
        },
      } as any,
      overrideAccess: true,
    })

    return { success: true }
  } catch (err) {
    console.error('[WizardActions] saveWizardProgress error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}

// ── ensureWizardChannel ────────────────────────────────────────────────────

/**
 * Ensures the wizard-setup channel exists in the tenant's primary space.
 * Returns { spaceId, channelSlug } for the wizard chat.
 */
export async function ensureWizardChannel(): Promise<{
  spaceId: number | null
  channelSlug: string
}> {
  const WIZARD_CHANNEL_SLUG = 'wizard-setup'

  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    if (!user) return { spaceId: null, channelSlug: WIZARD_CHANNEL_SLUG }

    const tenantId = await resolveTenantId()
    if (!tenantId) return { spaceId: null, channelSlug: WIZARD_CHANNEL_SLUG }

    // Find or create a space for this tenant
    const spacesResult = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      sort: 'createdAt',
      depth: 0,
      overrideAccess: true,
    })

    let spaceId: number

    if (spacesResult.docs.length > 0) {
      spaceId = spacesResult.docs[0].id as number
    } else {
      // Create a temporary setup space
      const tenant = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })
      const tenantName = (tenant as any)?.name || 'Enterprise'

      const newSpace = await payload.create({
        collection: 'spaces',
        data: {
          name: `${tenantName} Setup`,
          slug: 'setup',
          visibility: 'invite_only',
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      spaceId = newSpace.id as number
    }

    // Ensure the wizard-setup channel exists in this space
    const channelsResult = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { space: { equals: spaceId } },
          { slug: { equals: WIZARD_CHANNEL_SLUG } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (channelsResult.docs.length === 0) {
      await payload.create({
        collection: 'channels',
        data: {
          name: 'Enterprise Setup',
          slug: WIZARD_CHANNEL_SLUG,
          description: 'Leo Wizard — Enterprise setup conversation',
          space: spaceId,
          tenant: tenantId,
          type: 'general',
          isDefault: false,
        } as any,
        overrideAccess: true,
      })
    }

    return { spaceId, channelSlug: WIZARD_CHANNEL_SLUG }
  } catch (err) {
    console.error('[WizardActions] ensureWizardChannel error:', err)
    return { spaceId: null, channelSlug: WIZARD_CHANNEL_SLUG }
  }
}

// ── loadWizardMessages ─────────────────────────────────────────────────────

/**
 * Loads existing wizard conversation messages from the wizard-setup channel.
 * Used to restore chat history when the wizard page is reloaded.
 */
export async function loadWizardMessages(
  channelSlug: string,
): Promise<{ role: 'user' | 'leo'; content: string; id: string }[]> {
  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    if (!user) return []

    const tenantId = await resolveTenantId()
    if (!tenantId) return []

    // Find the wizard channel
    const channels = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { slug: { equals: channelSlug } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const channelDoc = channels.docs[0]
    if (!channelDoc) return []

    // Load messages from this channel, oldest first
    const messagesResult = await payload.find({
      collection: 'messages',
      where: {
        channel: { equals: channelDoc.id },
      },
      sort: 'createdAt',
      limit: 100,
      depth: 1,
      overrideAccess: true,
    })

    return messagesResult.docs.map((msg: any) => {
      const authorId = typeof msg.author === 'object' ? msg.author?.id : msg.author
      const isLeo = authorId !== user.id
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : typeof msg.content === 'object' && msg.content?.text
            ? msg.content.text
            : JSON.stringify(msg.content ?? '')

      return {
        id: `msg-${msg.id}`,
        role: isLeo ? ('leo' as const) : ('user' as const),
        content,
      }
    })
  } catch (err) {
    console.error('[WizardActions] loadWizardMessages error:', err)
    return []
  }
}
