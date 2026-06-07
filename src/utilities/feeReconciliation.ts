/**
 * feeReconciliation — make the platform fee HONEST against real cost.
 *
 * The non-extractive principle: the platform's slice exists to cover what it
 * actually costs to run a tenant (AI + infra + storage + telephony). Cost
 * telemetry turns the fee from a black-box rake into a provable, transparent
 * number. Where fee revenue exceeds cost, the surplus is owed onward to the
 * Justice Fund — the platform keeps cost-recovery, not profit. Where cost
 * exceeds revenue, the platform is investing in the tenant (the bootstrap ethos:
 * early tenants are investors, not customers).
 *
 * The core is a PURE function over already-computed numbers so it's trivial to
 * test and free of DB coupling; the endpoint feeds it the AI summary, the ledger
 * summary, and the tenant's collected fees.
 *
 * @see src/utilities/aiCostTelemetry.ts — AI cost (Messages.metadata)
 * @see src/utilities/costLedger.ts — non-AI cost (cost-events)
 * @see src/utilities/bootstrapFees.ts — fee revenue + refund promise
 */

export type ReconciliationVerdict = 'platform-investing' | 'cost-recovered' | 'surplus-to-justice'

export interface FeeReconciliation {
  scope: 'tenant' | 'platform'
  windowDays: number
  /** Platform-paid AI cost over the window (from message telemetry). */
  aiCostCents: number
  /** Platform-paid non-AI cost over the window (infra + storage + telephony). */
  nonAiCostCents: number
  /** Total platform-paid cost over the window. */
  costCents: number
  /** Bootstrap fees collected to date (lifetime, refundable while promised). */
  feeRevenueToDateCents: number
  /** feeRevenue / cost; null when cost is 0 (nothing to cover). */
  coverageRatio: number | null
  /** Fee revenue beyond cost — owed onward to the Justice Fund. */
  surplusCents: number
  /** Cost beyond fee revenue — platform investment in the tenant. */
  shortfallCents: number
  /** Non-extractive recommendation: route the surplus to the Justice Fund. */
  recommendedJusticeContributionCents: number
  verdict: ReconciliationVerdict
  note: string
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Pure reconciliation math. All inputs in cents.
 *
 * @param aiCostCents       platform-paid AI cost over the window
 * @param nonAiCostCents    platform-paid non-AI ledger cost over the window
 * @param feeRevenueToDateCents  bootstrap fees collected (lifetime)
 */
export function computeFeeReconciliation(args: {
  scope?: 'tenant' | 'platform'
  windowDays: number
  aiCostCents: number
  nonAiCostCents: number
  feeRevenueToDateCents: number
}): FeeReconciliation {
  const scope = args.scope ?? 'tenant'
  const aiCostCents = round3(Math.max(0, args.aiCostCents || 0))
  const nonAiCostCents = round3(Math.max(0, args.nonAiCostCents || 0))
  const costCents = round3(aiCostCents + nonAiCostCents)
  const feeRevenueToDateCents = round3(Math.max(0, args.feeRevenueToDateCents || 0))

  const surplusCents = round3(Math.max(0, feeRevenueToDateCents - costCents))
  const shortfallCents = round3(Math.max(0, costCents - feeRevenueToDateCents))
  const coverageRatio = costCents > 0 ? round3(feeRevenueToDateCents / costCents) : null

  let verdict: ReconciliationVerdict
  let note: string
  if (shortfallCents > 0) {
    verdict = 'platform-investing'
    note = `The platform is absorbing ${fmt(shortfallCents)} beyond fees collected — an investment in this ${scope === 'platform' ? 'network' : 'tenant'}, consistent with the bootstrap promise.`
  } else if (surplusCents > 0) {
    verdict = 'surplus-to-justice'
    note = `Fees exceed cost by ${fmt(surplusCents)}. Non-extractive: that surplus is owed onward to the Justice Fund, not kept as profit.`
  } else {
    verdict = 'cost-recovered'
    note = 'Fees collected exactly cover cost — the platform slice is honest and break-even.'
  }

  return {
    scope,
    windowDays: args.windowDays,
    aiCostCents,
    nonAiCostCents,
    costCents,
    feeRevenueToDateCents,
    coverageRatio,
    surplusCents,
    shortfallCents,
    recommendedJusticeContributionCents: surplusCents,
    verdict,
    note,
  }
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Sum platform-paid non-AI cost from a cost-ledger summary (excludes the
 * `intelligence` category, which is counted from message telemetry to avoid
 * double-counting AI once it also flows into the ledger).
 */
export function nonAiPlatformCostFromLedger(
  ledger: { available?: boolean; byCategory?: Array<{ category: string; platformCostCents: number }> } | null | undefined,
): number {
  if (!ledger?.available || !Array.isArray(ledger.byCategory)) return 0
  return round3(
    ledger.byCategory
      .filter((c) => c.category !== 'intelligence')
      .reduce((sum, c) => sum + (c.platformCostCents || 0), 0),
  )
}
