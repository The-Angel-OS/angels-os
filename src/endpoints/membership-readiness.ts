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

  const connect = (tenant.stripeConnect || {}) as Record<string, unknown>
  const connectOnboarded = Boolean(connect.stripeAccountId)
  const chargesEnabled = Boolean(connect.stripeChargesEnabled)

  const plans = await getMembershipPlans(req.payload, tenant.id)
  const activePlans = plans.filter((p) => p.active !== false)

  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET)

  // First blocker → the one thing to do next.
  let nextAction: string
  if (!connectOnboarded) {
    nextAction = `Connect ${tenant.name || slug}'s Stripe account — run Stripe Connect onboarding for this endeavor.`
  } else if (!chargesEnabled) {
    nextAction = `Stripe Connect is linked but charges aren't enabled yet — finish the Stripe onboarding (identity/bank) so chargesEnabled flips true.`
  } else if (activePlans.length === 0) {
    nextAction = `Create a membership plan — ask LEO on this portal "create a $1/month plan called Founding Dollar" (create_membership_plan) or POST /api/membership-ops/plans.`
  } else if (!webhookConfigured) {
    nextAction = `Set STRIPE_WEBHOOK_SECRET + register the platform webhook — otherwise a paid subscription charges but never records a Membership.`
  } else {
    nextAction = `Ready to earn. Start a checkout: POST /api/membership-ops/checkout { planId: "${activePlans[0].id}" } with x-tenant-id: ${slug}.`
  }

  const ready = connectOnboarded && chargesEnabled && activePlans.length > 0 && webhookConfigured

  return Response.json({
    tenant: slug,
    ready,
    checks: {
      connectOnboarded,
      chargesEnabled,
      planCount: activePlans.length,
      planIds: activePlans.map((p) => p.id),
      webhookConfigured,
    },
    nextAction,
  })
}
