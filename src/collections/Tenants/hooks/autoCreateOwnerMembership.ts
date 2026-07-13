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

    // SEQUENTIAL only — never parallelize creates on the max=3 Vercel pool. This
    // hook runs INSIDE the tenant-create operation's transaction window: parallel
    // write chains here starved the pool, the transaction connection sat idle past
    // PgBouncer's idle-in-transaction timeout, and inserts (including the owner
    // membership) were killed/rolled back mid-provision (260709 guardian incident).
    const settle = async <T,>(p: Promise<T>): Promise<PromiseSettledResult<T>> => {
      try {
        return { status: 'fulfilled', value: await p }
      } catch (reason) {
        return { status: 'rejected', reason }
      }
    }
    const pagesResult = await settle(
      createDefaultTenantPages(payload, doc.id, {
        siteName: doc.branding?.siteName || doc.name || 'Welcome',
        tagline: typeof doc.branding?.tagline === 'string' ? doc.branding.tagline : '',
      }),
    )
    const navResult = await settle(createDefaultTenantNavigation(payload, doc.id))
    // Pass `req` so ensureMainSpace's writes join this hook's transaction. (The
    // actual empty-Community-space fix is the SYSTEM_ADMIN user sysOpts injects —
    // multi-tenant relationship validation re-reads the target space and needs a
    // privileged reader; the owner req.user here would also suffice for their own
    // new tenant, but SYSTEM_ADMIN makes it uniform with the CRON heal path.)
    const spaceResult = await settle(ensureMainSpace(payload, doc.id, doc.name, doc.slug, req))

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

    if (spaceResult.status === 'fulfilled' && spaceResult.value?.spaceId) {
      try {
        // Ensure the creating user is space_admin — whether the space was just
        // created or already existed (e.g. from a prior partial provision attempt)
        const existing = await payload.find({
          collection: 'space-memberships',
          where: {
            user: { equals: userId },
            space: { equals: Number(spaceResult.value.spaceId) },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.totalDocs === 0) {
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
        }
        const verb = spaceResult.value.created ? 'Created' : 'Found existing'
        payload.logger.info(
          `[autoCreateOwnerMembership] ${verb} main space for tenant "${doc.name}" (${doc.id})${spaceResult.value.created ? ` with ${spaceResult.value.channelIds.length} channels` : ''}`,
        )
      } catch (memberErr) {
        payload.logger.warn(
          `[autoCreateOwnerMembership] Non-critical: main space ready but failed to add owner as space_admin for tenant ${doc.id}: ${memberErr}`,
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
