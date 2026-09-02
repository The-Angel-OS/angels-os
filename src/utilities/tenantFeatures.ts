/**
 * Optional per-portal surfaces.
 *
 * `features` answers "does this portal WANT it"; `portalPlan` answers "have they
 * PAID for it". Keep them apart — a free portal may want Works, and a Business
 * portal may not. Default is off everywhere: an empty room advertised in the nav
 * is worse than no nav item at all.
 */
export type TenantFeature = 'works' | 'pageComments'

export interface TenantWithFeatures {
  features?: { works?: boolean | null; pageComments?: boolean | null } | null
}

export function hasFeature(
  tenant: TenantWithFeatures | null | undefined,
  feature: TenantFeature,
): boolean {
  return Boolean(tenant?.features?.[feature])
}

/**
 * Business types that take donations, and so get Giving as a top-level item.
 *
 * Lives here rather than inline in the header because BOTH halves need it: the
 * client decides whether to add the platform Donate item, and the server
 * decides whether to keep a `/donate` PAGE out of the Home dropdown. Those two
 * answers have to agree — when they disagreed, a donate page on a non-giving
 * org was excluded from Home as "already promoted" and then never promoted,
 * which is a published page reachable from nowhere.
 */
export const GIVING_BUSINESS_TYPES = ['ministry', 'nonprofit'] as const

export function isGivingOrg(businessType?: string | null): boolean {
  return GIVING_BUSINESS_TYPES.includes((businessType || '') as (typeof GIVING_BUSINESS_TYPES)[number])
}
