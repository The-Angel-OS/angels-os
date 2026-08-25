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

export type PortalPlan = 'free' | 'site' | 'business' | 'demo'

export type PortalCapabilityKey =
  /** Own domain instead of a spacesangels.com address. */
  | 'customDomain'
  /** The "Powered by The Angel OS" footer credit removed. */
  | 'hideFooterCredit'
  /** Customers book online and leave a deposit. */
  | 'onlineBooking'
  /** Contact list and follow-up sequences. */
  | 'crm'
  /** The assistant answering customer questions on their behalf. */
  | 'customerAssistant'
  /** Selling memberships / recurring billing to their own customers. */
  | 'memberships'

const BUSINESS: PortalCapabilityKey[] = [
  'customDomain',
  'hideFooterCredit',
  'onlineBooking',
  'crm',
  'customerAssistant',
  'memberships',
]

const CAPABILITIES: Record<PortalPlan, PortalCapabilityKey[]> = {
  free: [],
  site: ['customDomain', 'hideFooterCredit'],
  business: BUSINESS,
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
  demo: 100,
}

/** A person's allowance: the most generous plan they hold. No portals yet = free. */
export function portalQuotaFor(plans: PortalPlan[]): number {
  return plans.reduce((max, p) => Math.max(max, PORTAL_QUOTA[p]), PORTAL_QUOTA.free)
}

/** Human labels for the upgrade prompt — the same words as /pricing. */
export const PLAN_LABEL: Record<PortalPlan, string> = {
  free: 'Free',
  site: 'Site — $49/mo',
  business: 'Business — $149/mo',
  demo: 'Demo — not billed',
}

/** The cheapest plan that includes a capability, for "move to X" prompts. */
export function planRequiredFor(cap: PortalCapabilityKey): PortalPlan {
  if (CAPABILITIES.site.includes(cap)) return 'site'
  return 'business'
}

export function planOf(tenant: { portalPlan?: string | null } | null | undefined): PortalPlan {
  const p = tenant?.portalPlan
  return p === 'site' || p === 'business' || p === 'demo' ? p : 'free'
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
