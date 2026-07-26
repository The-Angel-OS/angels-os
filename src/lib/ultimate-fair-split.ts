/**
 * Angel OS economic model — 95/5.
 *
 * **You keep 95%. The platform keeps 5% of money it helps you move, and nothing
 * when nothing sells.**
 *
 * This file used to declare 60/20/15/5 — a 40% platform take — and it was not
 * decorative: getStripeApplicationFeeCents fed it straight into Stripe
 * `application_fee_amount` on booking deposits and commerce checkout. On a
 * tradesperson's $75 deposit that sent $30 to the platform and $45 to the person
 * who did the work, off a direct charge with their name on the receipt. Nobody
 * had chosen that number out loud; it was a constant nobody re-read. (260725.)
 *
 * THE APPLIED RATE IS NOT HERE. It is a runtime setting, so pricing can change
 * without a deploy and what an owner is shown can never drift from what they are
 * charged:
 *
 *   @see src/utilities/platformFee.ts — getPlatformFeeBps / feeCents
 *
 * What remains here is the DEFAULT, for surfaces that describe the model rather
 * than bill against it.
 */
import { DEFAULT_PLATFORM_FEE_BPS } from '@/utilities/platformFee'

/** The default split, derived from the default fee so the two cannot disagree. */
export const ULTIMATE_FAIR_SPLIT = {
  PROVIDER: (10000 - DEFAULT_PLATFORM_FEE_BPS) / 10000,
  PLATFORM: DEFAULT_PLATFORM_FEE_BPS / 10000,
} as const

export type SplitRecipient = keyof typeof ULTIMATE_FAIR_SPLIT

export interface TransactionSplit {
  amount: number
  recipient: SplitRecipient
  percentage: number
}

/**
 * Split a gross amount at a given rate. Pass the CONFIGURED rate from
 * getPlatformFeeBps wherever real money is involved; the default is only for
 * illustrative surfaces.
 */
export function calculateUltimateFairSplit(
  amountCents: number,
  platformBps: number = DEFAULT_PLATFORM_FEE_BPS,
): TransactionSplit[] {
  const platform = Math.round((amountCents * platformBps) / 10000)
  return [
    {
      recipient: 'PROVIDER',
      amount: amountCents - platform,
      percentage: (10000 - platformBps) / 10000,
    },
    { recipient: 'PLATFORM', amount: platform, percentage: platformBps / 10000 },
  ]
}

/**
 * @deprecated Read the configured rate instead — getPlatformFeeBps() — so a fee
 * change never needs a deploy. Kept so any straggling importer is findable.
 */
export function getPlatformApplicationFeePercent(): number {
  return ULTIMATE_FAIR_SPLIT.PLATFORM
}
