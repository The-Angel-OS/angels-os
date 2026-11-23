/**
 * What a portal's plan entitles it to.
 *
 * One map, one place. Locked 4-tier creator pricing (2026-11-22 Sprint B):
 *   • Starter (Preview) — `free`     ($0/mo, 5% fee, 1 portal)
 *   • Creator           — `creator`  ($10/mo | $99/yr, 4% fee, 1 portal)
 *     Unlocks customDomain, memberships, and customerAssistant (LEO AI + RAG).
 *   • Pro               — `site`     ($29/mo | $290/yr, 1.5% fee, 3 portals)
 *     Adds hideFooterCredit (white-label) and crm.
 *   • Studio            — `business` ($79/mo | $790/yr, 0% fee, 10 portals)
 *     Adds 0% platform fee + 10-portal quota.
 *
 * Existing DB keys (`site`, `business`) are preserved for zero-downtime
 * backward compatibility with live tenants, while `'creator'` carries the
 * $10/mo flagship tier.
 *
 * @see src/collections/Tenants/index.ts — `portalPlan`
 * @see /dashboard/admin/settings?tab=plan — the upgrade surface
 */

export type PortalPlan = 'free' | 'creator' | 'site' | 'business' | 'agency' | 'demo'

export type PortalCapabilityKey =
  /** Own domain instead of a spacesangels.com address. */
  | 'customDomain'
  /** The "Powered by The Angel OS" footer credit removed. */
  | 'hideFooterCredit'
  /** Contact list and follow-up sequences. */
  | 'crm'
  /** The assistant answering customer questions on their behalf (LEO AI + YouTube RAG). */
  | 'customerAssistant'
  /** Selling memberships / recurring billing to their own customers. */
  | 'memberships'

/** $10/mo Creator — unlocks the creator monetization & AI stack. */
const CREATOR: PortalCapabilityKey[] = ['customDomain', 'memberships', 'customerAssistant']

/** $29/mo Pro & $79/mo Studio — adds white-label footer removal and CRM. */
const PRO: PortalCapabilityKey[] = [
  'customDomain',
  'memberships',
  'customerAssistant',
  'hideFooterCredit',
  'crm',
]

const CAPABILITIES: Record<PortalPlan, PortalCapabilityKey[]> = {
  free: [],
  creator: CREATOR,
  site: PRO,
  business: PRO,
  /**
   * Agency — Studio capabilities, with room for a hundred portals.
   */
  agency: PRO,
  /**
   * Everything working EXCEPT hideFooterCredit. A demo portal is marketing —
   * the footer credit stays visible so prospects know who built it.
   */
  demo: PRO.filter((c) => c !== 'hideFooterCredit'),
}

/**
 * How many portals a person on this plan may hold.
 * A person's allowance is the BEST plan among the portals they already run.
 */
export const PORTAL_QUOTA: Record<PortalPlan, number> = {
  free: 1,
  creator: 1,
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
 * Monthly subscription cost per portal, in US cents.
 * Locked Sprint B pricing: $0 Preview / $10 Creator / $29 Pro / $79 Studio.
 */
export const PLAN_PRICE_CENTS: Record<PortalPlan, number> = {
  free: 0,
  creator: 1000,
  site: 2900,
  business: 7900,
  /**
   * PLACEHOLDER — Agency is NOT self-serve (`agency` is absent from
   * PURCHASABLE_PLANS, so nothing can charge this via card). Granted by admin.
   */
  agency: 29900,
  demo: 0,
}

/** Annual billing option per portal, in US cents (~2 months free). */
export const PLAN_ANNUAL_PRICE_CENTS: Record<PortalPlan, number> = {
  free: 0,
  creator: 9900,
  site: 29000,
  business: 79000,
  agency: 0,
  demo: 0,
}

/**
 * Platform fee each plan pays in basis points — higher plans buy down the cut.
 *   • Starter (`free`):   5.0% (`500` bps, capped at $9.99/txn)
 *   • Creator (`creator`): 4.0% (`400` bps — half of Patreon)
 *   • Pro (`site`):       1.5% (`150` bps)
 *   • Studio (`business`): 0.0% (`0` bps)
 *   • Agency / Demo:       0.0% (`0` bps)
 *
 * @see src/utilities/platformFee.ts — where this is resolved (+ per-tenant override support).
 */
export const PLAN_FEE_BPS: Record<PortalPlan, number> = {
  free: 500,
  creator: 400,
  site: 150,
  business: 0,
  agency: 0,
  demo: 0,
}

/** Human labels for upgrade prompts & Settings UI — aligned with /pricing. */
export const PLAN_LABEL: Record<PortalPlan, string> = {
  free: 'Starter (Preview) — $0',
  creator: 'Creator — $10/mo',
  site: 'Pro — $29/mo',
  business: 'Studio — $79/mo',
  agency: 'Agency — talk to us',
  demo: 'Demo — not billed',
}

/** The cheapest plan that includes a capability, for "move to X" prompts. */
export function planRequiredFor(cap: PortalCapabilityKey): PortalPlan {
  if (CAPABILITIES.creator.includes(cap)) return 'creator'
  if (CAPABILITIES.site.includes(cap)) return 'site'
  return 'business'
}

/**
 * The plan a tenant is on, defaulting to free for anything unrecognised.
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
