'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Confirms a Square or PayPal portal plan upgrade return (?upgraded=1&ref=...).
 * Calls POST /api/payment-ops/confirm to verify the payment/subscription with
 * the provider and upgrade tenant.portalPlan server-side before refreshing.
 */
export function PlanReturnConfirm() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'verifying' | 'confirmed' | 'cancelled' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cancelled') === '1') {
      setStatus('cancelled')
      setMessage('Plan checkout was cancelled — your current plan has not changed.')
      return
    }
    if (params.get('upgraded') !== '1') return

    const ref = params.get('ref')
    if (!ref) {
      setStatus('confirmed')
      setMessage('Plan upgrade completed.')
      return
    }

    setStatus('verifying')
    fetch('/api/payment-ops/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ref,
        orderId: params.get('orderId') || params.get('token') || undefined,
        transactionId: params.get('transactionId') || undefined,
        subscriptionId: params.get('subscription_id') || undefined,
      }),
    })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok && data?.ok) {
          setStatus('confirmed')
          setMessage('Your portal plan upgrade is active!')
          router.refresh()
        } else {
          setStatus('error')
          setMessage(
            data?.error ||
              'Payment verification is still finalizing — refresh this page in a moment.',
          )
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Network error confirming upgrade. Please refresh this page.')
      })
  }, [router])

  if (status === 'idle') return null

  const tone =
    status === 'confirmed'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      : status === 'error'
        ? 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'

  return (
    <div role="status" className={`mt-4 rounded-lg border p-4 text-sm ${tone}`}>
      {status === 'verifying'
        ? 'Confirming your plan upgrade with the payment processor...'
        : message}
    </div>
  )
}
