/**
 * Feature flags — capabilities that are BUILT and demonstrated but toggled OFF
 * until the platform needs them. The doctrine (260711): consolidate on the single
 * spacesangels.com node; keep the federation / cross-Enterprise code intact but
 * dormant behind these switches. Flip a flag ON via env when the capability is
 * genuinely needed (a real second operator, a load ceiling) — the mechanism is
 * already proven, so enabling is a config change, not a rebuild.
 *
 * NEXT_PUBLIC_ prefix so client surfaces (the dashboard nav) can read them too.
 * Default OFF: a plain single-node, multi-tenant deployment.
 */
const on = (v?: string): boolean => v === 'on' || v === 'true' || v === '1'

export const FEATURES = {
  /** Cross-Enterprise federation: discovery, node-to-node gossip, the Federation
   *  command-center tab. The code stays wired; this only surfaces it. */
  federation: on(process.env.NEXT_PUBLIC_FEATURE_FEDERATION),
  /** The cross-federation Endeavors directory browser (/dashboard/endeavors).
   *  Fetches peer nodes' holons — only meaningful when federation is live. */
  endeavorBrowser: on(process.env.NEXT_PUBLIC_FEATURE_ENDEAVOR_BROWSER),
} as const

export type FeatureFlag = keyof typeof FEATURES
