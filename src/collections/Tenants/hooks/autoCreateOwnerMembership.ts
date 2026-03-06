import type { CollectionAfterChangeHook } from 'payload'

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
  } catch (err) {
    // Non-fatal — tenant is created regardless
    req.payload.logger.warn(
      `[autoCreateOwnerMembership] Failed for tenant ${doc.id}: ${err}`,
    )
  }

  return doc
}
