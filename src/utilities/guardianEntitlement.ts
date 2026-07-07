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

export interface GuardianTenantRef {
  id: number | string
  slug?: string
  domain?: string
}

/**
 * Resolve the user's PERSONAL guardian-angel tenant — the one marked
 * `isGuardianAngel`, NOT just any portal they admin. Returns null if they have
 * none yet. This is the shared "which tenant is their angel" lookup so claim,
 * status, and checkout all agree (a business admin's guardian is found, not their
 * business). Fail-soft.
 */
export async function resolveGuardianTenant(
  payload: Payload,
  userId: number | string,
): Promise<GuardianTenantRef | null> {
  try {
    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { role: { equals: 'tenant_admin' } },
          { status: { in: ['active', 'pending'] } },
        ],
      },
      depth: 1,
      sort: 'createdAt',
      limit: 100,
      overrideAccess: true,
    })
    for (const m of memberships.docs) {
      const t = (m as { tenant?: unknown }).tenant
      if (t && typeof t === 'object' && (t as { isGuardianAngel?: boolean }).isGuardianAngel === true) {
        const tt = t as GuardianTenantRef
        return { id: tt.id, slug: tt.slug, domain: tt.domain }
      }
    }
    return null
  } catch {
    return null
  }
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
