/**
 * Angel OS Stripe Connect Configuration — Direct Charges
 *
 * Uses Stripe Connect DIRECT CHARGES model:
 * - PaymentIntent created ON the connected account (seller)
 * - Platform takes application_fee_amount (40% of total)
 * - Seller appears on customer receipts (Enterprise sovereignty)
 * - Seller handles refunds and disputes
 * - Buyers may be unaware of the platform (white-label)
 *
 * Fee split (Ultimate Fair Split):
 *   60% Provider (stays on connected account)
 *   20% Platform Partner (Celersoft — via application_fee)
 *   15% Operational Overhead (infrastructure, AI, support — via application_fee)
 *    5% Justice Fund (community guild support — via application_fee)
 *
 * Direct charges flow:
 * 1. Seller onboards as Connect Express account
 * 2. In checkout: create PaymentIntent ON connected account with
 *    application_fee_amount = 40% of total
 * 3. Payment goes directly to seller. Platform receives application_fee
 *    as an automatic transfer from seller → platform.
 * 4. Seller's business name appears on customer's bank statement.
 *
 * @see https://docs.stripe.com/connect/direct-charges
 * @see src/lib/ultimate-fair-split.ts for split constants
 * @see src/lib/angel-os-stripe-adapter.ts for implementation
 */

import { getPlatformApplicationFeePercent } from './ultimate-fair-split'

/**
 * Calculate application_fee_amount for Stripe PaymentIntent (in cents).
 * This is the platform's share (40%) retained from each transaction.
 * For direct charges, this is taken from the seller's connected account
 * and transferred to the platform account automatically.
 */
export function getStripeApplicationFeeCents(amountCents: number): number {
  const platformPercent = getPlatformApplicationFeePercent()
  return Math.round(amountCents * platformPercent)
}

/**
 * Stripe Connect charge model.
 *
 * 'direct' — PaymentIntent created ON the connected account.
 *            Seller collects payment directly. Platform takes application_fee.
 *            Seller appears on receipts. Seller handles refunds/disputes.
 */
export const STRIPE_CONNECT_MODE = 'direct' as const
