'use client'

import React from 'react'

/**
 * Legacy BookingDeposit wrapper (Stripe Elements removed).
 * Booking deposits now redirect through Square or PayPal hosted checkout.
 */
export function BookingDeposit({
  checkoutUrl,
  amountLabel,
}: {
  checkoutUrl?: string
  amountLabel: string
}) {
  if (!checkoutUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        Redirecting to secure deposit checkout for {amountLabel}...
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = checkoutUrl
      }}
      className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      Pay {amountLabel} deposit & reserve
    </button>
  )
}
