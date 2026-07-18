'use client'

import { useCallback, useState } from 'react'

/**
 * Set-up-autopay button. Starts an ACH subscription checkout for the renter's
 * rent plan via the shared membership-ops/checkout endpoint (rent plans default
 * to the ACH rail server-side), then redirects to Stripe-hosted Checkout where
 * the renter confirms their bank and accepts the recurring mandate.
 */
export function AutopayButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/membership-ops/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, rail: 'ach' }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start autopay. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not start autopay. Please try again.')
      setLoading(false)
    }
  }, [planId])

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? 'Starting…' : 'Set up autopay'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
