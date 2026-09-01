/**
 * What a portal's plan entitles it to.
 *
 * One map, one place. Before this the paywall lived only in the marketing copy
 * on /pricing, so the product happily gave away the $149 features and nobody
 * could tell by reading the code which side of the line anything was on.
 *
 * @see src/collections/Tenants/index.ts — `portalPlan`
 * @see /dashboard/plan — the upgrade surface
 */

export type PortalPlan = 'free' | 'site' | 'business' | 'agency' | 'demo'

export type PortalCapabilityKey =
  /** Own domain instead of a spacesangels.com address. */
  | 'customDomain'
  /** The "Powered by The Angel OS" footer credit removed. */
  | 'hideFooterCredit'
  /** Contact list and follow-up sequences. */
  | 'crm'
  /** The assistant answering customer questions on their behalf. */
  | 'customerAssistant'
  /** Selling memberships / recurring billing to their own customers. */
  | 'memberships'

const BUSINESS: PortalCapabilityKey[] = [
  'customDomain',
  'hideFooterCredit',
  'crm',
  'customerAssistant',
  'memberships',
]

const CAPABILITIES: Record<PortalPlan, PortalCapabilityKey[]> = {
  free: [],
  site: ['customDomain', 'hideFooterCredit'],
  business: BUSINESS,
  /**
   * Agency — Business, with room for a hundred portals.
   *
   * Ken's 260901 ruling. It exists because the allowance, not the feature set,
   * is what stopped a partner: someone reselling this platform runs fifty sites
   * for fifty clients, and the ceiling of ten made that conversation impossible
   * to have. The capabilities are Business's exactly; nothing new is unlocked,
   * and the whole difference is PORTAL_QUOTA below.
   *
   * Note what an agency allowance does NOT do: it is room to HOLD portals, not
   * a grant of Business to each of them. A client site still carries its own
   * plan and still pays for its own features. Quota answers "how many", plans
   * answer "what may each one do", and keeping those separate is why adding
   * this tier costs one line here instead of a second entitlement system.
   */
  agency: BUSINESS,
  /**
   * Everything, billed to nobody.
   *
   * A prospect demo with booking switched off sells nothing — the whole pitch
   * is the thing working before the ask. Our own portals are in the same
   * position: we do not invoice ourselves.
   *
   * Deliberately a PLAN and not an `isDemo` flag that bypasses the gate. A
   * bypass would be a second answer to "what may this portal do", and the two
   * would drift; the gate would then be honest in one place and a lie in the
   * other. As a plan it stays one map, one question, and the day a demo
   * converts you change a single field.
   *
   * Everything EXCEPT hideFooterCredit. A demo site is marketing — the credit
   * line is the point of building it, and hiding it on the one page a prospect
   * shows their friends throws away the only distribution the free work buys.
   * A paying customer buys the credit off; a demo never should.
   */
  demo: BUSINESS.filter((c) => c !== 'hideFooterCredit'),
}

/**
 * How many portals a person on this plan may hold.
 *
 * Until now anyone signed in could provision unlimited portals — Ken has 17 and
 * nothing stopped an eighteenth, or a script's ten thousandth. A person's
 * allowance is the BEST plan among the portals they already run: paying for one
 * Business portal buys room for the next few, which is the shape every hosting
 * product has and the shape nobody has to explain.
 *
 * ponytail: a map, not a field. A number per plan is the whole rule; a
 * `portalQuota` column would be a second answer to a question this already
 * answers, and the two would drift.
 */
export const PORTAL_QUOTA: Record<PortalPlan, number> = {
  free: 1,
  site: 3,
  business: 10,
  agency: 100,
  demo: 100,
}

/** A person's allowance: the most generous plan they hold. No portals yet = free. */
export function portalQuotaFor(plans: PortalPlan[]): number {
  return plans.reduce((max, p) => Math.max(max, PORTAL_QUOTA[p]), PORTAL_QUOTA.free)
}

/**
 * What each plan costs, in cents per month. Ken's 260823 ruling.
 *
 * These moved DOWN from $49/$149 to $29/$79 to sit at parity with
 * Wix/Squarespace. Open source, community-based and prayerful is the reason to
 * choose us AT parity — never a discount justification.
 */
export const PLAN_PRICE_CENTS: Record<PortalPlan, number> = {
  free: 0,
  site: 2900,
  business: 7900,
  /**
   * PLACEHOLDER — $299 is Claude's number, not Ken's, and it is deliberately
   * NOT self-serve: `agency` is absent from PURCHASABLE_PLANS, so nothing can
   * charge this until a price is agreed. An agency deal is a conversation; the
   * tier is granted by an admin the way `demo` is. Displayed so the tier is
   * visible on the pricing surfaces while the number is settled.
   */
  agency: 29900,
  demo: 0,
}

/**
 * The booking fee each plan pays, in basis points — the monthly buys down the rate.
 *
 * This is the actual pitch, and it was living only in a handoff document: a free
 * portal pays 5% of each deposit (capped at $9.99), $29 halves it to 2%, $79
 * removes it. For anyone taking deposits, the subscription pays for itself,
 * which is a sentence a tradesman can check with arithmetic.
 *
 * ⚠️ The fee is charged on the DEPOSIT, not the job — `feeCents(deposit, …)` in
 * booking-checkout.ts. 5% of a $50 deposit is $2.50, not 5% of a $600 move, and
 * the $9.99 cap only binds above a ~$200 deposit.
 *
 * A demo pays nothing because a demo is billed to nobody.
 * @see src/utilities/platformFee.ts — where this is resolved, and how a
 *      per-tenant override still wins for special cases.
 */
export const PLAN_FEE_BPS: Record<PortalPlan, number> = {
  free: 500,
  site: 200,
  business: 0,
  // An agency brings the platform its customers; taking a cut of their clients'
  // sales on top of the tier would be charging twice for the same relationship.
  agency: 0,
  demo: 0,
}

/** Human labels for the upgrade prompt — the same words as /pricing. */
export const PLAN_LABEL: Record<PortalPlan, string> = {
  free: 'Free',
  site: 'Site — $29/mo',
  business: 'Business — $79/mo',
  agency: 'Agency — talk to us',
  demo: 'Demo — not billed',
}

/** The cheapest plan that includes a capability, for "move to X" prompts. */
export function planRequiredFor(cap: PortalCapabilityKey): PortalPlan {
  if (CAPABILITIES.site.includes(cap)) return 'site'
  return 'business'
}

/**
 * The plan a tenant is on, defaulting to free for anything unrecognised.
 *
 * DERIVED from the capability map rather than a hand-written list of literals.
 * The list version silently forgot `agency` the day it was added: TypeScript
 * cannot flag a missing arm of an `||` chain, so an agency portal read back as
 * FREE and its owner was told they had room for one portal instead of a hundred.
 * A plan that exists in the map is a plan this recognises, by construction.
 */
export function planOf(tenant: { portalPlan?: string | null } | null | undefined): PortalPlan {
  const p = tenant?.portalPlan
  return typeof p === 'string' && Object.prototype.hasOwnProperty.call(CAPABILITIES, p)
    ? (p as PortalPlan)
    : 'free'
}

/** A demo is not a customer — no upgrade prompt, no footer credit, no invoice. */
export function isDemoPortal(
  tenant: { portalPlan?: string | null } | null | undefined,
): boolean {
  return planOf(tenant) === 'demo'
}

export function portalCan(
  tenant: { portalPlan?: string | null } | null | undefined,
  cap: PortalCapabilityKey,
): boolean {
  return CAPABILITIES[planOf(tenant)].includes(cap)
}
