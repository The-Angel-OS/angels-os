'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RichText } from '@/components/RichText'
import { PaymentRailSelector, type PaymentRailId } from '@/components/payments/PaymentRailSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MIN_DONATION_CENTS = 500

export const DonationBlock: React.FC<{
  id?: string
  richText?: any
  presetAmounts?: string
  showDonorFields?: boolean
}> = ({ richText, presetAmounts = '5,10,25,50,100', showDonorFields = true }) => {
  const amounts = useMemo(
    () =>
      (presetAmounts || '5,10,25,50,100')
        .split(',')
        .map((s) => parseInt(s.trim(), 10) * 100)
        .filter((n) => n >= MIN_DONATION_CENTS),
    [presetAmounts],
  )

  const [step, setStep] = useState<'amount' | 'info' | 'verifying' | 'success'>('amount')
  const [amountCents, setAmountCents] = useState(amounts[2] || amounts[0] || 2500)
  const [customAmount, setCustomAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [donorMessage, setDonorMessage] = useState('')
  const [provider, setProvider] = useState<PaymentRailId | null>(null)
  const [hasProviders, setHasProviders] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyParams, setVerifyParams] = useState<{
    ref: string
    orderId?: string
    transactionId?: string
    subscriptionId?: string
  } | null>(null)
  const [viewer, setViewer] = useState<{ name?: string; email?: string } | null>(null)
  const [breakdown, setBreakdown] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/donation-ops/routing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ok && typeof d.breakdown === 'string') setBreakdown(d.breakdown)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const confirmReturn = useCallback(
    async (opts: {
      ref: string
      orderId?: string
      transactionId?: string
      subscriptionId?: string
    }) => {
      setStep('verifying')
      setError(null)
      try {
        const res = await fetch('/api/payment-ops/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(opts),
        })
        const data = (await res.json()) as {
          ok?: boolean
          pending?: boolean
          amountCents?: number
          error?: string
        }
        if (res.ok && data.ok) {
          if (data.amountCents && data.amountCents > 0) setAmountCents(data.amountCents)
          setStep('success')
          return
        }
        setError(
          data.error ||
            (data.pending
              ? 'Payment is still finalizing — please retry verification in a few seconds.'
              : 'Could not verify your donation yet.'),
        )
      } catch {
        setError('Network error verifying donation. Please click Retry Verification.')
      }
    },
    [],
  )

  // Handle return from Square or PayPal hosted checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cancelled') === 'true') {
      setError('Checkout was cancelled — you were not charged.')
      return
    }
    if (params.get('success') === 'true') {
      const returnedAmount = parseInt(params.get('amount') || '0', 10)
      if (returnedAmount > 0) setAmountCents(returnedAmount)
      const ref = params.get('ref')
      if (!ref) {
        setStep('success')
        return
      }
      const nextParams = {
        ref,
        orderId: params.get('orderId') || params.get('token') || undefined,
        transactionId: params.get('transactionId') || undefined,
        subscriptionId: params.get('subscription_id') || undefined,
      }
      setVerifyParams(nextParams)
      void confirmReturn(nextParams)
    }
  }, [confirmReturn])

  // Pre-fill name/email when signed in
  useEffect(() => {
    let cancelled = false
    fetch('/api/users/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u = d?.user as { name?: string; email?: string } | undefined
        if (cancelled || !u?.email) return
        setViewer({ name: u.name, email: u.email })
        setDonorName((prev) => prev || u.name || '')
        setDonorEmail((prev) => prev || u.email || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelectAmount = (cents: number) => {
    setAmountCents(cents)
    setCustomAmount('')
    setError(null)
  }

  const handleCustomAmount = (val: string) => {
    setCustomAmount(val)
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && parsed > 0) {
      setAmountCents(Math.round(parsed * 100))
    }
  }

  const startHostedDonation = async () => {
    if (amountCents < MIN_DONATION_CENTS) {
      setError(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/donation-ops/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          donorName: donorName || undefined,
          donorEmail: donorEmail || undefined,
          message: donorMessage || undefined,
          provider: provider || undefined,
        }),
      })

      const data = (await res.json()) as { checkoutUrl?: string; error?: string }
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Failed to start donation checkout')
      }

      window.location.href = data.checkoutUrl
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const handleContinue = async () => {
    if (amountCents < MIN_DONATION_CENTS) {
      setError(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`)
      return
    }

    if (showDonorFields && step === 'amount') {
      setError(null)
      setStep('info')
      return
    }

    await startHostedDonation()
  }

  if (step === 'verifying') {
    return (
      <div className="container">
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold">Confirming your gift...</h2>
          <p className="text-sm text-muted-foreground">
            {error || 'Verifying payment confirmation with the processor.'}
          </p>
          {error && verifyParams && (
            <Button onClick={() => void confirmReturn(verifyParams)}>Retry Verification</Button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="container">
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
          <div className="mb-4 text-5xl">&#10084;&#65039;</div>
          <h2 className="mb-2 text-2xl font-bold">Thank You!</h2>
          <p className="text-muted-foreground">
            Your gift of <strong>${(amountCents / 100).toFixed(2)}</strong> has been received.
            Thank you for your generosity.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="mx-auto max-w-lg space-y-6">
        {richText && <RichText data={richText} enableGutter={false} />}

        {step === 'amount' && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">Choose an amount</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {amounts.map((cents) => (
                <Button
                  key={cents}
                  variant={amountCents === cents && !customAmount ? 'default' : 'outline'}
                  onClick={() => handleSelectAmount(cents)}
                  className="text-base"
                >
                  ${cents / 100}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-amount">Custom amount ($5.00 minimum)</Label>
              <Input
                id="custom-amount"
                type="number"
                min="5"
                step="0.01"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => handleCustomAmount(e.target.value)}
              />
            </div>
            {!showDonorFields && (
              <PaymentRailSelector
                value={provider}
                onChange={setProvider}
                onLoaded={(info) => setHasProviders(info.providers.length > 0)}
                disabled={submitting}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {breakdown ||
                'Your gift is processed securely via Square or PayPal, with a receipt to your email.'}
            </p>
            <Button
              onClick={handleContinue}
              disabled={submitting || (!showDonorFields && !hasProviders)}
              className="w-full"
              size="lg"
            >
              {!showDonorFields && submitting
                ? 'Redirecting...'
                : `Continue — $${(amountCents / 100).toFixed(2)}`}
            </Button>
          </div>
        )}

        {step === 'info' && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {viewer ? 'Add a note (optional)' : 'Your info (optional)'}
            </h3>
            {viewer ? (
              <p className="text-sm text-muted-foreground">
                Giving as{' '}
                <span className="font-medium text-foreground">{viewer.name || viewer.email}</span>
                {viewer.name && viewer.email ? ` · ${viewer.email}` : ''} (receipt to this email).
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="donor-name">Name</Label>
                  <Input
                    id="donor-name"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="donor-email">Email (for receipt)</Label>
                  <Input
                    id="donor-email"
                    type="email"
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="donor-message">Message</Label>
              <Input
                id="donor-message"
                value={donorMessage}
                onChange={(e) => setDonorMessage(e.target.value)}
                placeholder="Optional message"
              />
            </div>

            <PaymentRailSelector
              value={provider}
              onChange={setProvider}
              onLoaded={(info) => setHasProviders(info.providers.length > 0)}
              disabled={submitting}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('amount')}
                className="flex-1"
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                onClick={handleContinue}
                className="flex-1"
                size="lg"
                disabled={submitting || !hasProviders}
              >
                {submitting ? 'Redirecting...' : `Give $${(amountCents / 100).toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
