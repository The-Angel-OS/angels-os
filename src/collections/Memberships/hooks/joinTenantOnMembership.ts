import type { CollectionAfterChangeHook } from 'payload'

/**
 * A membership is a billing fact. Being in the room is a different fact, and
 * nothing connected the two: `POST /api/membership-ops/checkout` wrote a
 * `memberships` row and stopped, so someone who joined a portal — free plan or
 * paid dues — got a receipt and no community. They landed on a Spaces list with
 * nothing in it.
 *
 * `ensureTenantMembership` is the existing door: an active tenant-membership
 * fires `autoJoinSpaces`, which creates the space-membership rows. So the wire
 * is one call, not a second enrollment path — and it is idempotent, which
 * matters because the Stripe webhook re-writes this row on every renewal.
 *
 * Email-only members (no user account yet) are skipped: there is no one to
 * enroll. They get their rooms when they sign in and the account is linked.
 */
export const joinTenantOnMembership: CollectionAfterChangeHook = async ({ doc, req }) => {
  const status = (doc as { status?: string }).status
  if (status !== 'active' && status !== 'trialing') return doc

  const id = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
  const userId = id((doc as { member?: unknown }).member)
  const tenantId = id((doc as { tenant?: unknown }).tenant)
  if (userId == null || tenantId == null) return doc

  const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')
  // req threaded: a hook write without it drops FKs or deadlocks at 300s.
  await ensureTenantMembership(userId as number, tenantId as number, req)

  return doc
}
