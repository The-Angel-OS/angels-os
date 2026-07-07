/**
 * guardianUsage — the free-tier decision layer for guardian-angel backstores.
 *
 * The monetization model, stated plainly: EVERY Nimue user gets a guardian-angel
 * tenant (their own data store) for FREE. We don't paywall the door — we meter
 * usage and only pass costs through once a user crosses a free allowance. Ernesto
 * stays free forever; someone who hammers image analysis all day eventually
 * crosses the line and gets an honest "you're over — add a card or bring your own
 * key" nudge. Jump-ship-friendly by design: it's THEIR store from day one.
 *
 * This module answers ONE question — "is this tenant within its free allowance,
 * and by how much?" — reading the existing cost-events ledger. It is the load-
 * bearing primitive under the Nimue usage banner, the Stripe upsell, and any
 * future gating on the claim endpoint.
 *
 * CONFIG-FREE FOR THE 99%: no schema change, no per-tenant settings UI. Pinned-
 * free tenants and the allowance are env-driven; a tenant with its OWN provider
 * key (BYOK) is $0 to the platform automatically (the ledger already excludes
 * byok cost from platformCostCents).
 *
 *   GUARDIAN_ANGEL_FREE_TENANTS       CSV of tenant slugs pinned free forever
 *                                     (e.g. "ernesto,clearwater"). Case-insensitive.
 *   GUARDIAN_ANGEL_FREE_MONTHLY_CENTS Platform-cost allowance before pass-through
 *                                     kicks in (default 100 = $1.00 of our spend).
 *
 * @see src/utilities/costLedger.ts — the per-tenant cost aggregation this reads
 * @see src/endpoints/claim-guardian-angel.ts — provisions the backstore
 * @see [[project_guardian_angel_monetization]] [[project_token_economy]]
 */
import type { Payload } from 'payload'
import { getCostLedgerSummary } from '@/utilities/costLedger'

export type GuardianPlan = 'free_pinned' | 'metered' | 'byok'
export type GuardianStatus = 'free_pinned' | 'within_free' | 'over_free' | 'byok'

export interface GuardianUsage {
  tenantId: number | string
  tenantSlug?: string
  plan: GuardianPlan
  status: GuardianStatus
  /** True when the user is riding for free (pinned, within allowance, or pure BYOK). */
  free: boolean
  windowDays: number
  /** Platform-paid cost we're absorbing this window (excludes the tenant's BYOK usage). */
  platformCostCents: number
  /** Cost served via the tenant's OWN key — $0 to us, shown for transparency. */
  byokCostCents: number
  /** Free allowance of platform cost before pass-through. null = unlimited (pinned). */
  allowanceCents: number | null
  /** How much of the allowance remains (0 when over; null when unlimited). */
  remainingCents: number | null
  /** Platform cost beyond the allowance — the amount we'd pass through. 0 when within. */
  overageCents: number
  /** 0..1 fraction of allowance consumed (0 when unlimited). For a progress bar. */
  fraction: number
  /** Whether the cost ledger was actually readable (false → table missing / new node). */
  ledgerAvailable: boolean
}

const DEFAULT_FREE_MONTHLY_CENTS = 100 // $1.00 of platform spend per rolling window

function pinnedFreeSlugs(): Set<string> {
  return new Set(
    (process.env.GUARDIAN_ANGEL_FREE_TENANTS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

function freeMonthlyCents(): number {
  const raw = Number(process.env.GUARDIAN_ANGEL_FREE_MONTHLY_CENTS)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_FREE_MONTHLY_CENTS
}

/**
 * Compute a tenant's guardian-angel free-tier standing over a rolling window.
 *
 * Pure read; fail-soft (a missing ledger yields within_free with $0 spend, never
 * throws). `tenantSlug` is optional but lets us honor the pinned-free allowlist
 * without a second lookup — pass it when you already have it.
 */
export async function getGuardianUsage(
  payload: Payload,
  tenantId: number | string,
  opts: { tenantSlug?: string; days?: number } = {},
): Promise<GuardianUsage> {
  const windowDays = Math.max(1, Math.min(90, Math.round(opts.days ?? 30)))
  const slug = (opts.tenantSlug || '').trim().toLowerCase()

  const ledger = await getCostLedgerSummary(payload, tenantId, { days: windowDays })
  const platformCostCents = ledger.totals.platformCostCents
  const byokCostCents = ledger.totals.byokCostCents

  // 1) Pinned free forever (Ernesto) — never metered, never passed through.
  if (slug && pinnedFreeSlugs().has(slug)) {
    return {
      tenantId,
      tenantSlug: opts.tenantSlug,
      plan: 'free_pinned',
      status: 'free_pinned',
      free: true,
      windowDays,
      platformCostCents,
      byokCostCents,
      allowanceCents: null,
      remainingCents: null,
      overageCents: 0,
      fraction: 0,
      ledgerAvailable: ledger.available,
    }
  }

  // 2) Pure BYOK — the tenant serves everything on its own key, so platform cost
  //    is ~$0 and there's nothing to pass through. Only claim this when there's
  //    real BYOK usage and no platform cost, otherwise fall through to metered.
  if (byokCostCents > 0 && platformCostCents === 0) {
    return {
      tenantId,
      tenantSlug: opts.tenantSlug,
      plan: 'byok',
      status: 'byok',
      free: true,
      windowDays,
      platformCostCents,
      byokCostCents,
      allowanceCents: null,
      remainingCents: null,
      overageCents: 0,
      fraction: 0,
      ledgerAvailable: ledger.available,
    }
  }

  // 3) Metered — free up to the allowance, pass-through beyond it.
  const allowanceCents = freeMonthlyCents()
  const overageCents = Math.max(0, Math.round((platformCostCents - allowanceCents) * 1000) / 1000)
  const remainingCents = Math.max(0, Math.round((allowanceCents - platformCostCents) * 1000) / 1000)
  const fraction = allowanceCents > 0 ? Math.min(1, platformCostCents / allowanceCents) : 1
  const within = platformCostCents <= allowanceCents

  return {
    tenantId,
    tenantSlug: opts.tenantSlug,
    plan: 'metered',
    status: within ? 'within_free' : 'over_free',
    free: within,
    windowDays,
    platformCostCents,
    byokCostCents,
    allowanceCents,
    remainingCents,
    overageCents,
    fraction,
    ledgerAvailable: ledger.available,
  }
}

/** A short, human-facing line Nimue can drop into a banner. */
export function describeGuardianUsage(u: GuardianUsage): string {
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`
  switch (u.status) {
    case 'free_pinned':
      return 'Your guardian angel is free, always. 🕯️'
    case 'byok':
      return 'Running on your own key — $0 to the platform.'
    case 'within_free':
      return u.allowanceCents == null
        ? "You're within your free tier."
        : `Within your free tier — ${dollars(u.remainingCents ?? 0)} of room left this month.`
    case 'over_free':
      return `You've used ${dollars(u.platformCostCents)} this month, past the ${dollars(
        u.allowanceCents ?? 0,
      )} free tier. Add a card or bring your own key to keep going.`
  }
}
