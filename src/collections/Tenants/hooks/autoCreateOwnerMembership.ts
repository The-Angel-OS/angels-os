import type { CollectionAfterChangeHook } from 'payload'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
import { ensureMainSpace } from '@/utilities/ensureMainSpace'

/**
 * autoCreateOwnerMembership — When a new Tenant is created, auto-create
 * a tenant-membership with `tenant_admin` role for the creating user.
 *
 * The ProvisionWizard handles this via `findOrCreateTenantMembership`,
 * but tenants created directly through the admin panel or API had no
 * automatic membership linkage, making the new tenant invisible in
 * the dashboard's tenant switcher.
 *
 * Only fires on `create`. Skips if no authenticated user (seed scripts).
 * Idempotent: checks for existing membership before creating.
 */
export const autoCreateOwnerMembership: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const userId = req.user?.id
  if (!userId) return doc // No user context (seed scripts, system operations)

  // Skip system users
  if ((req.user as any)?.isSystemUser) return doc

  try {
    const { payload } = req

    // Check if membership already exists (idempotent — wizard may have already created it)
    const existing = await payload.find({
      collection: 'tenant-memberships',
      where: {
        user: { equals: userId },
        tenant: { equals: doc.id },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.totalDocs > 0) return doc // Already linked

    // Create tenant membership with tenant_admin role
    await payload.create({
      collection: 'tenant-memberships',
      data: {
        user: userId as number,
        tenant: doc.id as number,
        role: 'tenant_admin',
        status: 'active',
        joinedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    payload.logger.info(
      `[autoCreateOwnerMembership] User ${userId} linked as tenant_admin to new tenant "${doc.name}" (${doc.id})`,
    )

    // Pages, navigation, and main space creation are independent — run in parallel
    const [pagesResult, navResult, spaceResult] = await Promise.allSettled([
      createDefaultTenantPages(payload, doc.id, {
        siteName: doc.branding?.siteName || doc.name || 'Welcome',
        tagline: typeof doc.branding?.tagline === 'string' ? doc.branding.tagline : '',
      }),
      createDefaultTenantNavigation(payload, doc.id),
      ensureMainSpace(payload, doc.id, doc.name, doc.slug),
    ])

    if (pagesResult.status === 'fulfilled') {
      payload.logger.info(
        `[autoCreateOwnerMembership] Created default pages for tenant "${doc.name}" (${doc.id})`,
      )
    } else {
      payload.logger.warn(
        `[autoCreateOwnerMembership] Non-critical: failed to create default pages for tenant ${doc.id}: ${pagesResult.reason}`,
      )
    }

    if (navResult.status === 'fulfilled') {
      payload.logger.info(
        `[autoCreateOwnerMembership] Created default navigation for tenant "${doc.name}" (${doc.id})`,
      )
    } else {
      payload.logger.warn(
        `[autoCreateOwnerMembership] Non-critical: failed to create default navigation for tenant ${doc.id}: ${navResult.reason}`,
      )
    }

    if (spaceResult.status === 'fulfilled' && spaceResult.value?.created) {
      try {
        // Make the creating user a space_admin of the new main space
        await payload.create({
          collection: 'space-memberships',
          data: {
            user: userId as number,
            space: Number(spaceResult.value.spaceId),
            role: 'space_admin',
            status: 'active',
            joinedAt: new Date().toISOString(),
            tenant: doc.id as number,
          } as any,
          overrideAccess: true,
        })
        payload.logger.info(
          `[autoCreateOwnerMembership] Created main space for tenant "${doc.name}" (${doc.id}) with ${spaceResult.value.channelIds.length} channels`,
        )
      } catch (memberErr) {
        payload.logger.warn(
          `[autoCreateOwnerMembership] Non-critical: main space created but failed to add owner as space_admin for tenant ${doc.id}: ${memberErr}`,
        )
      }
    } else if (spaceResult.status === 'rejected') {
      payload.logger.warn(
        `[autoCreateOwnerMembership] Non-critical: failed to create main space for tenant ${doc.id}: ${spaceResult.reason}`,
      )
    }
  } catch (err) {
    // Non-fatal — tenant is created regardless
    req.payload.logger.warn(
      `[autoCreateOwnerMembership] Failed for tenant ${doc.id}: ${err}`,
    )
  }

  return doc
}
