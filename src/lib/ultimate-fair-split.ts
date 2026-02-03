/**
 * Angel OS "Ultimate Fair" Economic Engine
 *
 * Platform fee split at point of sale:
 * - 60%: Provider (e.g., Hays Cactus Farm)
 * - 20%: Platform Partner (Celersoft)
 * - 15%: Operational Overhead & Hosting
 * - 5%: The Justice Fund (Community/Guild support)
 */

export const ULTIMATE_FAIR_SPLIT = {
  PROVIDER: 0.6,
  PLATFORM_PARTNER: 0.2,
  OPERATIONAL_OVERHEAD: 0.15,
  JUSTICE_FUND: 0.05,
} as const

export type SplitRecipient = keyof typeof ULTIMATE_FAIR_SPLIT

export interface TransactionSplit {
  amount: number
  recipient: SplitRecipient
  percentage: number
}

/**
 * Calculate the split for a given transaction amount (in cents).
 * Returns amounts in cents for each recipient.
 */
export function calculateUltimateFairSplit(amountCents: number): TransactionSplit[] {
  return (Object.entries(ULTIMATE_FAIR_SPLIT) as [SplitRecipient, number][]).map(
    ([recipient, percentage]) => ({
      amount: Math.round(amountCents * percentage),
      recipient,
      percentage,
    }),
  )
}

/**
 * Get the application fee amount for Stripe Connect (Platform Partner + Overhead + Justice Fund).
 * This is the portion retained by the platform (40%).
 */
export function getPlatformApplicationFeePercent(): number {
  return (
    ULTIMATE_FAIR_SPLIT.PLATFORM_PARTNER +
    ULTIMATE_FAIR_SPLIT.OPERATIONAL_OVERHEAD +
    ULTIMATE_FAIR_SPLIT.JUSTICE_FUND
  )
}
