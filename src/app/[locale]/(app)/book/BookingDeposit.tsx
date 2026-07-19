'use client'

import React, { useMemo, useState, type FormEvent } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Build-time fallback (Vercel bakes NEXT_PUBLIC_*); on a self-host Docker build
// this is empty, so prefer the runtime `publishableKey` prop from the server.
const BUILD_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

// Stripe.js instances are cached per connected account — the booking deposit is a
// Direct Charge on the seller's account, so Elements must target that account.
const stripeCache = new Map<string, Promise<Stripe | null>>()
function getStripe(connectedAccountId: string, publishableKey: string): Promise<Stripe | null> {
  const cacheKey = `${publishableKey}:${connectedAccountId}`
  let p = stripeCache.get(cacheKey)
  if (!p) {
    p = loadStripe(publishableKey, { stripeAccount: connectedAccountId })
    stripeCache.set(cacheKey, p)
  }
  return p
}

function DepositForm({ amountLabel, onSuccess }: { amountLabel: string; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    if (stripeError) {
      setError(stripeError.message || 'Payment failed. Please try again.')
      setLoading(false)
      return
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess()
      return
    }
    setError('Payment did not complete. Please try again.')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Processing…' : `Pay ${amountLabel} deposit & reserve`}
      </button>
    </form>
  )
}

export function BookingDeposit({
  clientSecret,
  stripeAccountId,
  amountLabel,
  publishableKey,
  onSuccess,
}: {
  clientSecret: string
  stripeAccountId: string
  amountLabel: string
  publishableKey?: string
  onSuccess: () => void
}) {
  const stripeKey = publishableKey || BUILD_PUBLISHABLE_KEY
  const stripePromise = useMemo(
    () => (stripeKey ? getStripe(stripeAccountId, stripeKey) : Promise.resolve(null)),
    [stripeAccountId, stripeKey],
  )

  if (!stripeKey) {
    return (
      <p className="text-sm text-muted-foreground">
        Payments aren’t configured in this environment.
      </p>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { borderRadius: '8px' } } }}
    >
      <DepositForm amountLabel={amountLabel} onSuccess={onSuccess} />
    </Elements>
  )
}
