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

export type PortalPlan = 'free' | 'site' | 'business'

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

const CAPABILITIES: Record<PortalPlan, PortalCapabilityKey[]> = {
  free: [],
  site: ['customDomain', 'hideFooterCredit'],
  business: ['customDomain', 'hideFooterCredit', 'onlineBooking', 'crm', 'customerAssistant', 'memberships'],
}

/** Human labels for the upgrade prompt — the same words as /pricing. */
export const PLAN_LABEL: Record<PortalPlan, string> = {
  free: 'Free',
  site: 'Site — $49/mo',
  business: 'Business — $149/mo',
}

/** The cheapest plan that includes a capability, for "move to X" prompts. */
export function planRequiredFor(cap: PortalCapabilityKey): PortalPlan {
  if (CAPABILITIES.site.includes(cap)) return 'site'
  return 'business'
}

export function planOf(tenant: { portalPlan?: string | null } | null | undefined): PortalPlan {
  const p = tenant?.portalPlan
  return p === 'site' || p === 'business' ? p : 'free'
}

export function portalCan(
  tenant: { portalPlan?: string | null } | null | undefined,
  cap: PortalCapabilityKey,
): boolean {
  return CAPABILITIES[planOf(tenant)].includes(cap)
}
