import type { CollectionAfterChangeHook } from 'payload'
import type { User } from '@/payload-types'

/**
 * Auto-join new users to their tenant's main space.
 *
 * When a new user is created (not a system user), this hook:
 * 1. Looks up the user's active tenant memberships
 * 2. For each tenant, finds the oldest (main) space
 * 3. Creates a space-membership with 'member' role and 'active' status
 *
 * This ensures every onboarded user can immediately see and participate
 * in the main space channels (general, support, welcome, etc.)
 *
 * Non-fatal — if space lookup or membership creation fails,
 * the user can still log in and join spaces manually.
 */
export const autoJoinTenantSpaces: CollectionAfterChangeHook<User> = async ({
  doc,
  operation,
  req,
}) => {
  // Only on user creation, skip system users
  if (operation !== 'create' || doc.isSystemUser) return doc

  try {
    const { payload } = req

    // Wait briefly for tenant-membership to be created (happens in parallel flows)
    // The tenant membership may not exist yet if user just registered
    // In that case, the dashboard redirect to /new-endeavor handles it
    const tenantMemberships = await payload.find({
      collection: 'tenant-memberships',
      where: {
        user: { equals: doc.id },
        status: { equals: 'active' },
      },
      depth: 0,
      limit: 10,
      overrideAccess: true,
    })

    if (tenantMemberships.totalDocs === 0) {
      // No tenant memberships yet — user will be routed to endeavor creation
      // or invited later. Auto-join will happen when they join a tenant.
      return doc
    }

    // For each tenant membership, find the main space and auto-join
    for (const tm of tenantMemberships.docs) {
      const tenantId = typeof tm.tenant === 'number' ? tm.tenant : (tm.tenant as any)?.id
      if (!tenantId) continue

      try {
        // Find the oldest (main) space for this tenant
        const spaces = await payload.find({
          collection: 'spaces',
          where: { tenant: { equals: tenantId } },
          sort: 'createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (spaces.totalDocs === 0) continue

        const mainSpace = spaces.docs[0]

        // Check if membership already exists (idempotent)
        const existing = await payload.find({
          collection: 'space-memberships',
          where: {
            user: { equals: doc.id },
            space: { equals: mainSpace.id },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.totalDocs > 0) continue // Already a member

        // Create space membership
        await payload.create({
          collection: 'space-memberships',
          data: {
            user: doc.id as number,
            space: mainSpace.id as number,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
            tenant: tenantId,
          },
          overrideAccess: true,
        })

        payload.logger.info(
          `[autoJoinTenantSpaces] User ${doc.email} auto-joined space "${mainSpace.name}" (tenant ${tenantId})`,
        )
      } catch (err) {
        // Non-fatal — log and continue to next tenant
        payload.logger.warn(
          `[autoJoinTenantSpaces] Failed to auto-join user ${doc.email} to tenant ${tenantId} space: ${err}`,
        )
      }
    }
  } catch (err) {
    // Non-fatal — user is created regardless
    req.payload.logger.warn(`[autoJoinTenantSpaces] Hook failed for user ${doc.email}: ${err}`)
  }

  return doc
}
