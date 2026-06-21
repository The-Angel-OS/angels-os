/**
 * Member standing — the ONE definition of "is this user a member / in good standing"
 * for a tenant. Everything that gates on membership (page access, nav, meeting rooms,
 * the Membership block) should call this instead of re-hardcoding the status set.
 *
 * Status model (Memberships.status, Stripe-webhook authoritative):
 *   active | trialing  → in good standing
 *   past_due           → still a MEMBER (lapsing), NOT good standing
 *   canceled | incomplete → not a member
 *
 * @see src/collections/Memberships/index.ts
 */

export const GOOD_STANDING_STATUSES = ['active', 'trialing'] as const
export const MEMBER_STATUSES = ['active', 'trialing', 'past_due'] as const

export interface MemberStanding {
  /** Has any non-terminal membership (active/trialing/past_due). */
  isMember: boolean
  /** Member in good standing (active/trialing; excludes past_due). */
  inGoodStanding: boolean
}

const EMPTY: MemberStanding = { isMember: false, inGoodStanding: false }

/**
 * Resolve a user's membership standing in a tenant. One DB read; fail-soft to "no
 * membership" so a transient error never grants access (deny-by-default).
 */
export async function getMemberStanding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  userId: string | number | null | undefined,
  tenantId: string | number | null | undefined,
): Promise<MemberStanding> {
  if (userId == null || tenantId == null) return EMPTY
  try {
    const res = await payload.find({
      collection: 'memberships',
      where: { and: [{ tenant: { equals: tenantId } }, { member: { equals: userId } }] },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const statuses = (res.docs || []).map((d: { status?: string }) => d.status)
    const isMember = statuses.some((s: string) => (MEMBER_STATUSES as readonly string[]).includes(s))
    const inGoodStanding = statuses.some((s: string) => (GOOD_STANDING_STATUSES as readonly string[]).includes(s))
    return { isMember, inGoodStanding }
  } catch {
    return EMPTY
  }
}

/** Convenience: member in good standing (active/trialing) for a tenant. */
export async function isMemberInGoodStanding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  userId: string | number | null | undefined,
  tenantId: string | number | null | undefined,
): Promise<boolean> {
  return (await getMemberStanding(payload, userId, tenantId)).inGoodStanding
}
