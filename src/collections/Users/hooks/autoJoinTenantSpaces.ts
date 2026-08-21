import type { CollectionAfterChangeHook } from 'payload'
import { AI_BUS_SPACE_SLUG } from '@/utilities/ensureSystemSpace'
import type { User } from '@/payload-types'

/**
 * Auto-join new users to their tenant's main space.
 *
 * When a new user is created (not a system user), this hook:
 * 1. Looks up the user's active tenant memberships
 * 2. For each tenant, finds ALL spaces
 * 3. Creates a space-membership with 'member' role and 'active' status for each
 *
 * This ensures every onboarded user can immediately see and participate
 * in all tenant spaces (community, support, etc.)
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
        // Find ALL spaces for this tenant EXCEPT the AI Bus — it is system
        // plumbing, seeded `private`, and a membership row here is what put
        // "AI Bus" at the top of an ordinary member's Spaces picker. The
        // tenant-membership hook already excludes it; this one did not.
        const spaces = await payload.find({
          collection: 'spaces',
          where: { and: [{ tenant: { equals: tenantId } }, { slug: { not_equals: AI_BUS_SPACE_SLUG } }] },
          sort: 'createdAt',
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })

        if (spaces.totalDocs === 0) continue

        for (const space of spaces.docs) {
          // Check if membership already exists (idempotent)
          const existing = await payload.find({
            collection: 'space-memberships',
            where: {
              user: { equals: doc.id },
              space: { equals: space.id },
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
              space: space.id as number,
              role: 'member',
              status: 'active',
              joinedAt: new Date().toISOString(),
              tenant: tenantId,
            },
            req,
            overrideAccess: true,
          })

          payload.logger.info(
            `[autoJoinTenantSpaces] User ${doc.email} auto-joined space "${space.name}" (tenant ${tenantId})`,
          )
        }
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
