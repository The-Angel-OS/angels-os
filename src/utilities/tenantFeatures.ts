/**
 * Optional per-portal surfaces.
 *
 * `features` answers "does this portal WANT it"; `portalPlan` answers "have they
 * PAID for it". Keep them apart — a free portal may want Works, and a Business
 * portal may not. Default is off everywhere: an empty room advertised in the nav
 * is worse than no nav item at all.
 */
export type TenantFeature = 'works'

export interface TenantWithFeatures {
  features?: { works?: boolean | null } | null
}

export function hasFeature(
  tenant: TenantWithFeatures | null | undefined,
  feature: TenantFeature,
): boolean {
  return Boolean(tenant?.features?.[feature])
}
