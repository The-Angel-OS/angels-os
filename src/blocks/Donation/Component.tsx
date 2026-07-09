'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { RichText } from '@/components/RichText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm({ amountCents, donorEmail }: { amountCents: number; donorEmail: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!stripe || !elements) return
      setProcessing(true)
      setError(null)

      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Payment failed')
        setProcessing(false)
        return
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/donate?success=true&amount=${amountCents}`,
          ...(donorEmail ? { receipt_email: donorEmail } : {}),
        },
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setProcessing(false)
      }
    },
    [stripe, elements, amountCents, donorEmail],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={!stripe || processing} className="w-full" size="lg">
        {processing ? 'Processing...' : `Donate $${(amountCents / 100).toFixed(2)}`}
      </Button>
    </form>
  )
}

export const DonationBlock: React.FC<{
  id?: string
  richText?: any
  presetAmounts?: string
  showDonorFields?: boolean
}> = ({ richText, presetAmounts = '5,10,25,50,100', showDonorFields = true }) => {
  const amounts = useMemo(
    () => (presetAmounts || '5,10,25,50,100').split(',').map((s) => parseInt(s.trim(), 10) * 100).filter((n) => n > 0),
    [presetAmounts],
  )

  const [step, setStep] = useState<'amount' | 'info' | 'payment' | 'success'>('amount')
  const [amountCents, setAmountCents] = useState(amounts[2] || 2500)
  const [customAmount, setCustomAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [donorMessage, setDonorMessage] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ name?: string; email?: string } | null>(null)

  // Check for success return from Stripe
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setStep('success')
      const returnedAmount = parseInt(params.get('amount') || '0', 10)
      if (returnedAmount > 0) setAmountCents(returnedAmount)
    }
  }, [])

  // Pre-fill name/email when signed in (anonymous giving stays untouched — the
  // fields just collapse to the message). A logged-in donor shouldn't retype.
  React.useEffect(() => {
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
  }

  const handleCustomAmount = (val: string) => {
    setCustomAmount(val)
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && parsed >= 1) {
      setAmountCents(Math.round(parsed * 100))
    }
  }

  const handleContinue = async () => {
    if (amountCents < 100) {
      setError('Minimum donation is $1.00')
      return
    }

    if (showDonorFields && step === 'amount') {
      setStep('info')
      return
    }

    setError(null)
    try {
      // No tenantSlug in the body: the server resolves the recipient from the
      // HOST header (x-tenant-id set by middleware) — authoritative even when
      // the payload-tenant cookie is stale or absent on a public portal.
      const res = await fetch('/api/donation-ops/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          donorName: donorName || undefined,
          donorEmail: donorEmail || undefined,
          message: donorMessage || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create payment')

      setClientSecret(data.clientSecret)
      setStep('payment')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
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
              <Label htmlFor="custom-amount">Custom amount</Label>
              <Input
                id="custom-amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => handleCustomAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              100% of every donation goes to the Justice Fund — community support, advocacy, and infrastructure. No platform fees.
            </p>
            <Button onClick={handleContinue} className="w-full" size="lg">
              Continue — ${(amountCents / 100).toFixed(2)}
            </Button>
          </div>
        )}

        {step === 'info' && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">{viewer ? 'Add a note (optional)' : 'Your info (optional)'}</h3>
            {viewer ? (
              // Signed in — name/email already known; just confirm + take a note.
              <p className="text-sm text-muted-foreground">
                Giving as <span className="font-medium text-foreground">{viewer.name || viewer.email}</span>
                {viewer.name && viewer.email ? ` · ${viewer.email}` : ''} (receipt to this email).
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="donor-name">Name</Label>
                  <Input id="donor-name" value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="donor-email">Email (for receipt)</Label>
                  <Input id="donor-email" type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="donor-message">Message</Label>
              <Input id="donor-message" value={donorMessage} onChange={(e) => setDonorMessage(e.target.value)} placeholder="Optional message" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleContinue} className="flex-1" size="lg">
                Continue — ${(amountCents / 100).toFixed(2)}
              </Button>
            </div>
          </div>
        )}

        {step === 'payment' && clientSecret && (
          <div className="rounded-lg border border-border bg-card p-6">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm amountCents={amountCents} donorEmail={donorEmail} />
            </Elements>
          </div>
        )}

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
