/**
 * Angel OS Stripe Connect Configuration
 *
 * Custom Stripe Connect integration for the Ultimate Fair economic engine.
 * Fee split: 60% Provider | 20% Platform | 15% Ops | 5% Justice Fund
 *
 * Integration steps:
 * 1. Create Stripe Connect platform account
 * 2. Providers onboard as Connected Accounts (OAuth or Express)
 * 3. In checkout: create PaymentIntent with transfer_data (destination: connected_account_id)
 *    and application_fee_amount = 40% of total (Platform + Ops + Justice Fund)
 * 4. Provider receives 60% via automatic transfer
 *
 * @see src/lib/ultimate-fair-split.ts for split constants
 */

import { getPlatformApplicationFeePercent } from './ultimate-fair-split'

/**
 * Calculate application_fee_amount for Stripe PaymentIntent (in cents).
 * This is the platform's share (40%) retained from each transaction.
 */
export function getStripeApplicationFeeCents(amountCents: number): number {
  const platformPercent = getPlatformApplicationFeePercent()
  return Math.round(amountCents * platformPercent)
}

/**
 * Stripe Connect mode: 'direct' (provider receives payment, we take fee)
 * or 'destination' (payment goes to us, we transfer to provider).
 */
export const STRIPE_CONNECT_MODE = 'direct' as const
