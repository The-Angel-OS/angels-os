/**
 * enforceReviewAuthority — server-side integrity gate for QuestParticipations.
 *
 * The collection is `update: authenticated`, so without this hook ANY logged-in
 * user could (1) flip their OWN participation to `approved` and have
 * `creditOnApproval` mint AT to themselves from the Diocese float, (2) approve a
 * participation in a tenant they don't belong to (cross-tenant mint), or (3)
 * forge the review/payout bookkeeping (reviewedBy, payoutStatus, payoutAmount) or
 * jump straight to `paid`. This beforeChange hook closes all of those.
 *
 * On an UPDATE it enforces:
 *   (a) an authenticated reviewer (req.user) for any privileged transition;
 *   (b) no self-review — the reviewer may never be the record's participant;
 *   (c) authority — reviewer must be super_admin, an admin/archangel WHO IS A
 *       MEMBER OF THE QUEST'S TENANT, or the quest's owner (postedBy). A global
 *       admin on tenant A may NOT review tenant B's participation (the float is
 *       the quest's-tenant float — see creditQuestPayout);
 *   (d) a valid state machine into a decision (only submitted/under_review/pending
 *       → approved|rejected; missing prev-state is denied, not skipped);
 *   (e) integrity — a non-privileged caller may not change participant/quest/
 *       reviewedBy/payoutStatus/payoutAmount, nor set status to `paid`.
 * On a valid review it server-stamps reviewedBy/reviewedAt authoritatively.
 *
 * super_admin is break-glass. Internal `overrideAccess` calls with no req.user
 * (e.g. creditQuestPayout marking payoutStatus) are trusted: external
 * unauthenticated writes are already rejected by `update: authenticated` before
 * any hook runs, so a hook with no user can only be a system call.
 *
 * @see src/collections/QuestParticipations/hooks/creditOnApproval.ts
 * @see src/utilities/creditQuestPayout.ts
 */
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { ADMIN_ROLES, checkRole } from '@/access/utilities'

const REVIEW_STATUSES = ['approved', 'rejected'] as const
/** States a participation may legally enter a review decision FROM. */
const REVIEWABLE_FROM = ['submitted', 'under_review', 'pending'] as const
/** Fields a non-privileged caller may never mutate (audit trail + payout bookkeeping). */
const PROTECTED_FIELDS = ['participant', 'quest', 'reviewedBy', 'payoutStatus', 'payoutAmount'] as const

const relId = (rel: unknown): string | number | null =>
  rel != null && typeof rel === 'object'
    ? ((rel as { id: string | number }).id ?? null)
    : (rel as string | number | null)

/** True if the user has an ACTIVE tenant-membership in the given tenant. */
async function isMemberOfTenant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  userId: string | number,
  tenantId: string | number,
): Promise<boolean> {
  try {
    const res = await req.payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (res.totalDocs ?? res.docs?.length ?? 0) > 0
  } catch {
    return false // fail closed
  }
}

export const enforceReviewAuthority: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return data

  const user = req?.user
  // Internal/system call (overrideAccess, no user) — trusted. External unauthenticated
  // updates are already blocked by `access.update: authenticated` before hooks run,
  // so a missing user here can only be a server-initiated write (e.g. creditQuestPayout).
  if (!user) return data

  // super_admin break-glass.
  if (checkRole(['super_admin'], user)) return data

  const nextStatus = data?.status as string | undefined
  const prevStatus = (originalDoc?.status as string | undefined) ?? undefined

  const isReviewTransition =
    !!nextStatus &&
    REVIEW_STATUSES.includes(nextStatus as (typeof REVIEW_STATUSES)[number]) &&
    nextStatus !== prevStatus
  const isPaidTransition = nextStatus === 'paid' && prevStatus !== 'paid'

  // Identities.
  const participantId = relId(originalDoc?.participant ?? data?.participant)
  const isSelf = participantId != null && String(participantId) === String(user.id)

  // Resolve the quest once (for tenant scope + owner check).
  const questId = relId(originalDoc?.quest ?? data?.quest)
  let questTenantId: string | number | null = null
  let questOwnerId: string | number | null = null
  if (questId != null) {
    try {
      const quest = (await req.payload.findByID({
        collection: 'quests' as never,
        id: questId,
        depth: 0,
        overrideAccess: true,
      })) as { postedBy?: unknown; tenant?: unknown } | null
      questOwnerId = relId(quest?.postedBy)
      questTenantId = relId(quest?.tenant)
    } catch {
      /* quest lookup failed — leaves scope unverifiable → privilege denied below */
    }
  }

  const isQuestOwner = questOwnerId != null && String(questOwnerId) === String(user.id)
  // A global admin/archangel must ALSO belong to the quest's tenant to review it
  // (the payout debits that tenant's float). Owner implies scope.
  const isTenantAdmin =
    checkRole(ADMIN_ROLES, user) &&
    questTenantId != null &&
    (await isMemberOfTenant(req, user.id, questTenantId))
  const privileged = isQuestOwner || isTenantAdmin

  if (!privileged) {
    // (e) integrity — non-privileged callers may not touch protected fields.
    for (const f of PROTECTED_FIELDS) {
      if (f in (data ?? {})) {
        const before = relId((originalDoc as Record<string, unknown> | undefined)?.[f])
        const after = relId((data as Record<string, unknown>)[f])
        if (String(after ?? '') !== String(before ?? '')) {
          throw new APIError(`You are not allowed to modify '${f}' on a quest participation.`, 403)
        }
      }
    }
    // (a)/(b)/(c) no review or settlement by a non-privileged caller.
    if (isReviewTransition) {
      throw new APIError(
        isSelf
          ? 'You cannot review (approve/reject) your own quest participation.'
          : 'Only an admin of this tenant or the quest owner may approve or reject this participation.',
        403,
      )
    }
    if (isPaidTransition) {
      throw new APIError('Only the payout settlement process may mark a participation paid.', 403)
    }
    return data
  }

  // ── Privileged reviewer path ───────────────────────────────────────────────
  if (isReviewTransition) {
    // (b) no self-review even for an admin/owner who happens to be the participant.
    if (isSelf) {
      throw new APIError('You cannot review (approve/reject) your own quest participation.', 403)
    }
    // (d) valid state machine — deny when the prior state is unknown or non-reviewable.
    if (!prevStatus || !REVIEWABLE_FROM.includes(prevStatus as (typeof REVIEWABLE_FROM)[number])) {
      throw new APIError(
        `Cannot transition quest participation from '${prevStatus ?? 'unknown'}' to '${nextStatus}'.`,
        400,
      )
    }
    // Server-stamp the reviewer authoritatively (don't trust a client-supplied reviewedBy).
    data.reviewedBy = user.id
    if (!data.reviewedAt) data.reviewedAt = new Date().toISOString()
  }

  return data
}
