/**
 * guardianEntitlement — is a user on the paid Guardian Angel tier?
 *
 * The subscription is stored as a row in the existing `memberships` collection
 * (the same one the Stripe webhook already syncs), keyed by a sentinel plan id.
 * That means the paid tier needs NO new schema — a guardian-angel subscription is
 * just a Membership whose planId is `guardian-angel`, scoped to the user's own
 * guardian tenant. Provisioning stays FREE (provision-free-first); this
 * entitlement only matters at the usage-overage boundary and for the upsell.
 *
 * @see src/endpoints/guardian-angel-checkout.ts — mints the Stripe subscription
 * @see src/endpoints/stripe-webhooks.ts — syncs the subscription → memberships
 * @see src/utilities/guardianUsage.ts — the free-tier meter that decides when this matters
 */
import type { Payload } from 'payload'

/** Sentinel plan id marking a platform Guardian Angel subscription in `memberships`. */
export const GUARDIAN_ANGEL_PLAN_ID = 'guardian-angel'
export const GUARDIAN_ANGEL_PLAN_NAME = 'Guardian Angel'

/** Default monthly price for the Guardian Angel tier, in cents ($9.00). Env-overridable. */
export function guardianAngelPriceCents(): number {
  const n = Number(process.env.GUARDIAN_ANGEL_PRICE_CENTS)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 900
}

/**
 * True when the user has an active/trialing Guardian Angel subscription.
 * Fail-soft: any query error (incl. a missing memberships table) → false.
 */
export async function hasGuardianAngelEntitlement(
  payload: Payload,
  userId: number | string,
): Promise<boolean> {
  try {
    const res = await payload.find({
      collection: 'memberships',
      where: {
        and: [
          { member: { equals: userId } },
          { planId: { equals: GUARDIAN_ANGEL_PLAN_ID } },
          { status: { in: ['active', 'trialing'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return res.totalDocs > 0
  } catch {
    return false
  }
}
