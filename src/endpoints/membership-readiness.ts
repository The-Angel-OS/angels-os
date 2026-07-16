/**
 * Earn-loop readiness — GET /api/membership-ops/readiness?tenant=<slug>
 *
 * One truthful answer to "can this endeavor take a real dollar yet?" It checks the
 * three things the membership checkout needs and reports the FIRST blocker with a
 * concrete next action — so closing the earn loop is a checklist, not a guess.
 *
 *   1. Stripe Connect onboarded (chargesEnabled) — dues can't transfer otherwise.
 *   2. At least one membership plan (the menu to subscribe to).
 *   3. Platform webhook secret configured — else a paid sub never records a Membership.
 *
 * Booleans only (no account ids / secrets), so it's safe as a public read like the
 * plans GET. This is the data behind a future "Ready to earn ✓" dashboard tile.
 *
 * @see src/endpoints/membership-checkout.ts  @see src/utilities/membershipPlans.ts
 */
import type { PayloadHandler } from 'payload'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { getBillingMode } from '@/utilities/billingMode'

export const membershipReadinessHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const slug = req.headers?.get('x-tenant-id') || url.searchParams.get('tenant') || ''
  if (!slug) return Response.json({ error: 'tenant slug required (x-tenant-id or ?tenant=)' }, { status: 400 })

  const tenants = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenants.docs?.[0] as any
  if (!tenant) return Response.json({ error: `No endeavor "${slug}"` }, { status: 404 })

  const billingMode = await getBillingMode(req.payload, tenant.id)
  const connect = (tenant.stripeConnect || {}) as Record<string, unknown>
  const connectOnboarded = Boolean(connect.stripeAccountId)
  const chargesEnabled = Boolean(connect.stripeChargesEnabled)
  // Connect is ONLY a prerequisite in the third-party destination-charge mode.
  // Platform-direct (first-party, default) charges on the platform Stripe.
  const needsConnect = billingMode === 'connect'
  const connectReady = !needsConnect || (connectOnboarded && chargesEnabled)

  const plans = await getMembershipPlans(req.payload, tenant.id)
  const activePlans = plans.filter((p) => p.active !== false)

  // The CANONICAL name — the actual webhook handler (stripe-webhooks.ts) and the
  // ecommerce plugin (plugins/index.ts) both read STRIPE_WEBHOOKS_SIGNING_SECRET,
  // and .env.example documents it. Readiness previously checked STRIPE_WEBHOOK_SECRET
  // (a name NOTHING else uses), so it always reported webhook:false and told owners
  // to set a var that does nothing — the earn loop looked broken (or falsely fixed)
  // regardless of the real state. Check the name the handler actually verifies with.
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOKS_SIGNING_SECRET)

  // First blocker → the one thing to do next.
  let nextAction: string
  if (needsConnect && !connectOnboarded) {
    nextAction = `Connect ${tenant.name || slug}'s Stripe account — this endeavor is set to connect mode (third-party payouts). Run Stripe Connect onboarding, or switch it to platform-direct.`
  } else if (needsConnect && !chargesEnabled) {
    nextAction = `Stripe Connect is linked but charges aren't enabled yet — finish the Stripe onboarding (identity/bank) so chargesEnabled flips true.`
  } else if (activePlans.length === 0) {
    nextAction = `Create a membership plan — ask LEO on this portal "create a $1/month plan called Founding Dollar" (create_membership_plan) or POST /api/membership-ops/plans.`
  } else if (!webhookConfigured) {
    nextAction = `Set STRIPE_WEBHOOKS_SIGNING_SECRET (from the Stripe Dashboard webhook you register at /api/stripe/webhooks) — otherwise a paid subscription charges but never records a Membership.`
  } else {
    nextAction = `Ready to earn (${billingMode}). Start a checkout: POST /api/membership-ops/checkout { planId: "${activePlans[0].id}" } with x-tenant-id: ${slug}.`
  }

  const ready = connectReady && activePlans.length > 0 && webhookConfigured

  return Response.json({
    tenant: slug,
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
  })
}
