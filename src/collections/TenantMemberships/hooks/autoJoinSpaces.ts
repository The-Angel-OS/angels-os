import type { CollectionAfterChangeHook } from 'payload'

/**
 * autoJoinSpaces — When a TenantMembership becomes active, auto-join
 * the user to ALL spaces in that tenant.
 *
 * This closes the gap where:
 * - `autoJoinTenantSpaces` (Users hook) only fires on user creation
 * - `tenant-invite-accept` endpoint handles invitation flow
 * - But direct admin additions or status changes (pending → active) had no hook
 *
 * Fires on both create and update so both new memberships and
 * status transitions are handled. Idempotent and non-fatal.
 */
export const autoJoinSpaces: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  // Only proceed when membership is active
  if (doc.status !== 'active') return doc

  const userId = typeof doc.user === 'number' ? doc.user : (doc.user as any)?.id
  const tenantId = typeof doc.tenant === 'number' ? doc.tenant : (doc.tenant as any)?.id

  if (!userId || !tenantId) return doc

  try {
    const { payload } = req

    // Find all spaces in this tenant
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      sort: 'createdAt',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    if (spaces.totalDocs === 0) return doc

    for (const space of spaces.docs) {
      try {
        // Check if membership already exists (idempotent)
        const existing = await payload.find({
          collection: 'space-memberships',
          where: {
            user: { equals: userId },
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
            user: userId as number,
            space: space.id as number,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
            tenant: tenantId as number,
          },
          overrideAccess: true,
        })

        payload.logger.info(
          `[autoJoinSpaces] User ${userId} auto-joined space "${space.name}" (tenant ${tenantId})`,
        )
      } catch (err) {
        // Non-fatal per space — continue to next
        payload.logger.warn(
          `[autoJoinSpaces] Failed to join user ${userId} to space "${space.name}": ${err}`,
        )
      }
    }
  } catch (err) {
    // Non-fatal — membership is already saved
    req.payload.logger.warn(
      `[autoJoinSpaces] Hook failed for user ${userId}, tenant ${tenantId}: ${err}`,
    )
  }

  return doc
}
