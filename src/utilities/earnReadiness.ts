/**
 * earnReadiness — the single source of truth for "can this endeavor take a real
 * dollar yet?" Shared by the readiness endpoint (GET /api/membership-ops/readiness)
 * and the dashboard "Ready to Earn" card, so the API and the UI never drift.
 *
 * Three gates the membership checkout needs:
 *   1. Stripe Connect onboarded (only in `connect` billing mode).
 *   2. At least one active membership plan.
 *   3. The platform webhook signing secret — else a paid sub charges but never
 *      records a Membership. NOTE the canonical name STRIPE_WEBHOOKS_SIGNING_SECRET
 *      (what the webhook handler + ecommerce plugin actually verify with).
 *
 * @see src/endpoints/membership-readiness.ts  @see src/endpoints/membership-checkout.ts
 */
import type { Payload, Where } from 'payload'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { getBillingMode } from '@/utilities/billingMode'

export interface EarnReadiness {
  ok: boolean
  error?: string
  tenantSlug?: string
  tenantName?: string
  ready: boolean
  billingMode: string
  checks: {
    connectRequired: boolean
    connectOnboarded: boolean
    chargesEnabled: boolean
    planCount: number
    planIds: Array<string | number>
    webhookConfigured: boolean
  }
  /** The FIRST blocker, phrased as the one thing to do next. */
  nextAction: string
}

export async function getEarnReadiness(
  payload: Payload,
  ref: { tenantId?: number | string; slug?: string },
): Promise<EarnReadiness> {
  const empty: EarnReadiness['checks'] = {
    connectRequired: false,
    connectOnboarded: false,
    chargesEnabled: false,
    planCount: 0,
    planIds: [],
    webhookConfigured: false,
  }

  // Resolve the tenant (by id or slug).
  const where: Where = ref.tenantId != null
    ? { id: { equals: ref.tenantId } }
    : { slug: { equals: ref.slug || '' } }
  const tenants = await payload.find({ collection: 'tenants', where, limit: 1, depth: 0, overrideAccess: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenants.docs?.[0] as any
  if (!tenant) {
    return { ok: false, error: 'tenant not found', ready: false, billingMode: 'unknown', checks: empty, nextAction: 'Endeavor not found.' }
  }

  const tenantSlug = tenant.slug as string
  const tenantName = (tenant.name as string) || tenantSlug

  const billingMode = await getBillingMode(payload, tenant.id)
  const connect = (tenant.stripeConnect || {}) as Record<string, unknown>
  const connectOnboarded = Boolean(connect.stripeAccountId)
  const chargesEnabled = Boolean(connect.stripeChargesEnabled)
  const needsConnect = billingMode === 'connect'
  const connectReady = !needsConnect || (connectOnboarded && chargesEnabled)

  const plans = await getMembershipPlans(payload, tenant.id)
  const activePlans = plans.filter((p) => p.active !== false)

  // Canonical name — the webhook handler (stripe-webhooks.ts) + ecommerce plugin
  // both verify with STRIPE_WEBHOOKS_SIGNING_SECRET.
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOKS_SIGNING_SECRET)

  let nextAction: string
  if (needsConnect && !connectOnboarded) {
    nextAction = `Connect ${tenantName}'s Stripe account — this endeavor is in connect mode (third-party payouts). Run Stripe Connect onboarding, or switch to platform-direct.`
  } else if (needsConnect && !chargesEnabled) {
    nextAction = `Stripe Connect is linked but charges aren't enabled yet — finish Stripe onboarding (identity/bank) so chargesEnabled flips true.`
  } else if (activePlans.length === 0) {
    nextAction = `Create a membership plan — ask LEO "create a $1/month plan called Founding Dollar" (create_membership_plan) or POST /api/membership-ops/plans.`
  } else if (!webhookConfigured) {
    nextAction = `Set STRIPE_WEBHOOKS_SIGNING_SECRET (from the Stripe Dashboard webhook you register at /api/stripe/webhooks) — otherwise a paid subscription charges but never records a Membership.`
  } else {
    nextAction = `Ready to earn (${billingMode}). Start a checkout: POST /api/membership-ops/checkout { planId: "${activePlans[0].id}" } with x-tenant-id: ${tenantSlug}.`
  }

  const ready = connectReady && activePlans.length > 0 && webhookConfigured

  return {
    ok: true,
    tenantSlug,
    tenantName,
    ready,
    billingMode,
    checks: {
      connectRequired: needsConnect,
      connectOnboarded,
      chargesEnabled,
      planCount: activePlans.length,
      planIds: activePlans.map((p) => p.id),
      webhookConfigured,
    },
    nextAction,
  }
}
