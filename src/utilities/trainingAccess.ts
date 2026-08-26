/**
 * May this person take this training?
 *
 * Entitlement is DERIVED, never stored. There is no `enrollments` collection,
 * because an enrolment row would be a CACHE of a question we can already answer
 * — and caches drift. The one thing it would add ("when did you enrol") the
 * first `workProgress` write already tells us.
 *
 * Three ways in, one resolver:
 *   • free — `access: 'public'`, or `'authenticated'` and they are signed in
 *   • included with a membership — `'members'` / `'good_standing'`, decided by
 *     the SAME `isPageViewable` the page gating uses. There is not a second
 *     standing check anywhere in this codebase and there must not be.
 *   • bought — a PAID order containing the Work's bound product
 *
 * When the answer is no and a product is bound, the product comes back so the
 * caller can offer checkout instead of a locked door.
 *
 * @see src/utilities/pageAccess.ts  @see docs/planning/MEMBERSHIP_GATING.md
 */
import type { Payload } from 'payload'
import { isPageViewable, resolveViewerStanding } from './pageAccess'
import { canManageWork } from '@/access/canManageWork'
import { PAID_ORDER_STATUSES } from './orderPaid'

export type TrainingAccessReason =
  | 'open'
  | 'manager'
  | 'membership'
  | 'purchased'
  | 'sign_in_required'
  | 'membership_required'
  | 'purchase_required'

export interface TrainingAccess {
  allowed: boolean
  reason: TrainingAccessReason
  /** The product that unlocks this Work — present when the caller should offer checkout. */
  productId?: number | null
}

export interface TrainingWork {
  id: number | string
  access?: string | null
  product?: number | string | { id: number | string } | null
  owner?: string | null
}

const productIdOf = (p: TrainingWork['product']): number | null => {
  if (p == null) return null
  const raw = typeof p === 'object' ? (p as { id: number | string }).id : p
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Has this user a PAID order containing `productId`? */
async function hasPaidFor(payload: Payload, userId: number | string, productId: number): Promise<boolean> {
  const res = await payload.find({
    collection: 'orders',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    where: {
      and: [
        { customer: { equals: userId } },
        { status: { in: PAID_ORDER_STATUSES as unknown as string[] } },
        { 'items.product': { equals: productId } },
      ],
    },
  })
  return (res.docs?.length ?? 0) > 0
}

export async function resolveTrainingAccess(
  payload: Payload,
  user: { id?: number | string } | null | undefined,
  work: TrainingWork,
  tenantId?: string | number | null,
): Promise<TrainingAccess> {
  const access = work.access || 'public'
  const productId = productIdOf(work.product)

  // A Work nobody has gated is a Work anybody may read — the Library's stance.
  if (access === 'public') return { allowed: true, reason: 'open' }

  // Whoever can EDIT the Work can always see it (admins included).
  if (await canManageWork(payload, user, work.owner)) return { allowed: true, reason: 'manager' }

  if (!user?.id) {
    return { allowed: false, reason: 'sign_in_required', productId }
  }

  if (access === 'purchase') {
    // A 'purchase' Work with no product bound is a mistake, not an open door.
    if (!productId) return { allowed: false, reason: 'purchase_required', productId: null }
    if (await hasPaidFor(payload, user.id, productId)) return { allowed: true, reason: 'purchased' }
    return { allowed: false, reason: 'purchase_required', productId }
  }

  const standing = await resolveViewerStanding(payload, user, tenantId ?? null)
  if (isPageViewable(access, standing)) return { allowed: true, reason: 'membership' }

  // Membership-gated, but a product is bound — buying it is still a way in.
  if (productId && (await hasPaidFor(payload, user.id, productId))) {
    return { allowed: true, reason: 'purchased' }
  }
  return { allowed: false, reason: 'membership_required', productId }
}
