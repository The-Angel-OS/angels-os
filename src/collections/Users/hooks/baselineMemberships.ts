import type { CollectionAfterChangeHook } from 'payload'
import type { User } from '@/payload-types'

/**
 * Every new human user walks through ensureBaselineMemberships — no matter which
 * door they came in (Google, Discord, GitHub, OTP, invite, admin panel, seed).
 *
 * This used to be a per-call-site import in the auth endpoints, so Discord and
 * GitHub OAuth silently skipped it. The hook is the door.
 *
 * Runs FIRST in the afterChange array: autoJoinTenantSpaces reads the memberships
 * this creates, and Payload runs afterChange hooks in order.
 *
 * The auth endpoints still call ensureBaselineMemberships directly — it is
 * idempotent, and they carry a `joiningTenantId` the hook cannot know, plus they
 * backfill users who predate this.
 */
export const baselineMemberships: CollectionAfterChangeHook<User> = async ({
  doc,
  operation,
  req,
}) => {
  // System users (LEO agents, seeded archangels) get no commons and no guardian angel.
  if (operation !== 'create' || doc.isSystemUser) return doc

  const { ensureBaselineMemberships } = await import('@/utilities/ensureBaselineMemberships')
  // req threaded through: a hook write without it drops FKs or deadlocks at 300s.
  await ensureBaselineMemberships(req.payload, { id: doc.id, email: doc.email, name: doc.name }, { req })

  return doc
}
