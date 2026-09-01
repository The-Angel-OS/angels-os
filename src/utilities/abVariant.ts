/**
 * abVariant — the whole A/B testing apparatus.
 *
 * The platform already wrote down every page view (`site-visits`) and already
 * had a middleware that touches every request. An A/B test is those two facts
 * plus one cookie, so that is all this is:
 *
 *   1. Middleware assigns a visitor to bucket `a` or `b` once, in a first-party
 *      cookie, and forwards it as `x-ab-variant` so the very first render — the
 *      one that matters, because it is the landing page — already knows.
 *   2. Every site-visit row carries the bucket.
 *   3. The report asks: of the people in each bucket, how many later reached the
 *      goal page? Both halves of that question are already in `site_visits`.
 *
 * A "conversion" is therefore *a visit to a goal path* — /thank-you,
 * /order-confirmation, whatever the portal's success page is. That definition
 * costs nothing to collect and is the one every analytics product started with.
 *
 * ponytail: ONE global experiment, no registry, no per-experiment targeting, no
 * server-side flag store. Ken changes something on the site, waits, reads the
 * report. The ceiling is that two concurrent experiments would contaminate each
 * other — when a second one is genuinely needed, the cookie becomes
 * `aos_ab=<experiment>:<bucket>` and the column becomes the same string; nothing
 * else in the pipeline changes.
 *
 * Conversion is also page-view-shaped, so it cannot weight by revenue. Bind the
 * goal to Orders when a portal is optimising for money rather than for signups.
 *
 * @see src/middleware.ts — assignment
 * @see src/utilities/recordSiteVisit.ts — persistence
 * @see src/endpoints/site-log-report.ts — the `variants` report
 */

export const AB_COOKIE = 'aos_ab'
export const AB_HEADER = 'x-ab-variant'
export const AB_VARIANTS = ['a', 'b'] as const
export type AbVariant = (typeof AB_VARIANTS)[number]

/** 180 days: long enough that a returning visitor stays in one bucket for the life of a test. */
export const AB_COOKIE_MAX_AGE = 180 * 24 * 60 * 60

/**
 * Goal paths that count as a conversion when nothing is specified.
 *
 * These are the success pages the platform itself generates. A portal with its
 * own success page passes `?goal=/its-path` to the report instead — which is
 * why this is a default and not a constant baked into the SQL.
 */
export const DEFAULT_GOAL_PATHS = [
  '/thank-you',
  '/order-confirmation',
  '/checkout/success',
  '/welcome',
]

/** Only ever `a` or `b`. Anything else — a hand-edited cookie — is not a bucket. */
export function isAbVariant(v: unknown): v is AbVariant {
  return typeof v === 'string' && (AB_VARIANTS as readonly string[]).includes(v)
}

/**
 * Assign a bucket. 50/50, uniform, and deliberately random rather than hashed
 * from the IP: a hash of a visitor identifier is stable but *correlated* — every
 * visitor behind one corporate NAT lands in the same bucket, which is exactly
 * the bias an experiment is trying to avoid.
 */
export function assignVariant(rand: number = Math.random()): AbVariant {
  return rand < 0.5 ? 'a' : 'b'
}

/** The bucket already assigned to this request, or null if this visitor is new. */
export function readVariant(cookieValue: string | null | undefined): AbVariant | null {
  return isAbVariant(cookieValue) ? cookieValue : null
}

/**
 * Standard normal CDF, Abramowitz & Stegun 26.2.17 (|error| < 7.5e-8).
 *
 * Needed because JavaScript has no erf. Seven decimal places is far past what a
 * conversion-rate readout can justify.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

export interface VariantArm {
  variant: string
  visitors: number
  conversions: number
}

export interface AbVerdict {
  /** Conversion rate per arm, as a fraction. */
  rates: Record<string, number>
  /** Relative lift of B over A, as a fraction. Null when A converted nobody. */
  lift: number | null
  /** Two-sided p-value from a two-proportion z-test. Null when the test cannot run. */
  pValue: number | null
  significant: boolean
  /** Why the answer is not yet trustworthy — shown verbatim to the operator. */
  note: string
}

/**
 * The smallest sample this will call a result on.
 *
 * Not statistics — judgement. A z-test on 40 visitors will happily report
 * p=0.03 off a handful of clicks, and an operator who ships that change has
 * been actively misled. Refusing to render a verdict below this is the single
 * most useful thing an A/B feature does for someone who is not a statistician.
 */
export const MIN_VISITORS_PER_ARM = 100

/**
 * Two-proportion z-test between exactly two arms.
 *
 * Returns a verdict rather than a bare number, because the honest answer to
 * most real experiments is "not yet" and that has to be sayable.
 */
export function abVerdict(arms: VariantArm[], alpha = 0.05): AbVerdict {
  const rates: Record<string, number> = {}
  for (const a of arms) rates[a.variant] = a.visitors > 0 ? a.conversions / a.visitors : 0

  const a = arms.find((x) => x.variant === 'a')
  const b = arms.find((x) => x.variant === 'b')
  const base: AbVerdict = { rates, lift: null, pValue: null, significant: false, note: '' }

  if (!a || !b) return { ...base, note: 'Needs traffic in both variants before it can compare them.' }

  const lift = rates.a > 0 ? (rates.b - rates.a) / rates.a : null

  if (a.visitors < MIN_VISITORS_PER_ARM || b.visitors < MIN_VISITORS_PER_ARM) {
    const short = Math.min(a.visitors, b.visitors)
    return {
      ...base,
      lift,
      note: `Too early — ${short} visitors in the smaller variant, and a result is not worth acting on below ${MIN_VISITORS_PER_ARM}.`,
    }
  }

  const pooled = (a.conversions + b.conversions) / (a.visitors + b.visitors)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.visitors + 1 / b.visitors))
  if (!Number.isFinite(se) || se === 0) {
    return { ...base, lift, note: 'No conversions in either variant yet.' }
  }

  const z = (rates.b - rates.a) / se
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))
  const significant = pValue < alpha

  return {
    rates,
    lift,
    pValue,
    significant,
    note: significant
      ? `${rates.b > rates.a ? 'B' : 'A'} is ahead, and the gap is unlikely to be chance (p=${pValue.toFixed(3)}).`
      : `No clear winner yet (p=${pValue.toFixed(3)}). Keep it running or accept that the change does not matter.`,
  }
}
