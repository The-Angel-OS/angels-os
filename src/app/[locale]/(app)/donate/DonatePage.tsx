'use client'

import React, { useCallback, useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STRIPE_PUBLISHABLE_KEY = `${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY)

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000] // cents

/** Inner form rendered inside Elements provider (has access to useStripe) */
function DonationForm({
  amountCents,
  donorEmail,
}: {
  amountCents: number
  donorEmail: string
}) {
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
      // If no error, Stripe redirects to return_url
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

interface DonatePageProps {
  tenantName?: string
  tenantSlug?: string
  donationsEnabled?: boolean
}

export const DonatePage: React.FC<DonatePageProps> = ({
  tenantName = 'Angel OS',
  tenantSlug = 'default',
  donationsEnabled = true,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(2500) // $25 default
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [message, setMessage] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for success redirect
  const isSuccess =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('success')
  const successAmount =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('amount')

  const amountCents = isCustom ? Math.round(parseFloat(customAmount || '0') * 100) : selectedAmount

  const createPaymentIntent = useCallback(async () => {
    if (amountCents < 100) {
      setError('Minimum donation is $1.00')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/donation-ops/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          tenantSlug,
          ...(donorEmail ? { donorEmail } : {}),
          ...(donorName ? { donorName } : {}),
          ...(message ? { message } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create payment')
        setLoading(false)
        return
      }

      setClientSecret(data.clientSecret)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [amountCents, tenantSlug, donorEmail, donorName, message])

  // ── Donations Disabled (after all hooks) ───────────────────────
  if (!donationsEnabled) {
    return (
      <div className="container mx-auto max-w-lg py-20 text-center">
        <h1 className="mb-4 text-3xl font-bold">Donations</h1>
        <p className="opacity-70">
          Donations are not currently accepted for {tenantName}. Please check back later.
        </p>
      </div>
    )
  }

  // ── Success State ─────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="container mx-auto max-w-lg py-20 text-center">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-8">
          <h1 className="mb-4 text-3xl font-bold text-green-400">Thank You</h1>
          <p className="mb-2 text-lg">
            Your donation of <strong>${((Number(successAmount) || 0) / 100).toFixed(2)}</strong> has
            been received.
          </p>
          <p className="text-sm opacity-70">
            100% goes directly to keeping the lights on, the servers running, and the community fed.
          </p>
          <p className="mt-6 text-xs opacity-50">
            A receipt has been sent to your email. God bless you.
          </p>
        </div>
      </div>
    )
  }

  // ── Payment Form State (clientSecret obtained) ────────────────
  if (clientSecret) {
    return (
      <div className="container mx-auto max-w-lg py-20">
        <h1 className="mb-2 text-3xl font-bold">Complete Your Donation</h1>
        <p className="mb-6 text-sm opacity-70">
          ${(amountCents / 100).toFixed(2)} — 100% to the Justice Fund
        </p>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#C4973B',
                colorBackground: '#1a1a2e',
                colorText: '#ffffff',
                borderRadius: '8px',
              },
            },
          }}
        >
          <DonationForm
            amountCents={amountCents}
            donorEmail={donorEmail}
          />
        </Elements>
        <button
          onClick={() => setClientSecret(null)}
          className="mt-4 text-sm underline opacity-50 hover:opacity-100"
        >
          Change amount
        </button>
      </div>
    )
  }

  // ── Amount Selection State ────────────────────────────────────
  return (
    <div className="container mx-auto max-w-2xl py-16 px-4">
      <h1 className="mb-3 text-4xl font-bold tracking-tight">Support {tenantName}</h1>

      {/* The real story */}
      <div className="mb-8 space-y-3 text-base leading-relaxed opacity-80">
        <p>
          Right now, 100% of every donation goes directly to keeping our infrastructure alive.
          We are a community household in Clearwater, FL — seven people sharing a home,
          building Angel OS together, and supporting each other through the work.
        </p>
        <p>
          No salaries. No venture capital. No platform fees.
          Every dollar keeps the lights on, the servers running, and the people fed.
        </p>
      </div>

      {/* Urgency callout */}
      <div className="mb-8 rounded-lg border border-[#C4973B]/30 bg-[#C4973B]/5 p-4">
        <p className="text-sm font-medium text-[#C4973B]">
          Your donation directly supports housing, food, and infrastructure for the team
          building this platform. This is real people doing real work.
        </p>
      </div>

      {/* Preset amounts */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {PRESET_AMOUNTS.map((amt) => (
          <button
            key={amt}
            onClick={() => {
              setSelectedAmount(amt)
              setIsCustom(false)
            }}
            className={`rounded-lg border px-4 py-3 text-lg font-semibold transition-colors ${
              !isCustom && selectedAmount === amt
                ? 'border-[#C4973B] bg-[#C4973B]/20 text-[#C4973B]'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            ${(amt / 100).toFixed(0)}
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={`rounded-lg border px-4 py-3 text-lg font-semibold transition-colors ${
            isCustom
              ? 'border-[#C4973B] bg-[#C4973B]/20 text-[#C4973B]'
              : 'border-white/10 hover:border-white/30'
          }`}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="mb-6">
          <Label htmlFor="customAmount">Custom Amount ($)</Label>
          <Input
            id="customAmount"
            type="number"
            min="1"
            step="0.01"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Enter amount"
            className="mt-1"
          />
        </div>
      )}

      {/* Optional donor info */}
      <div className="mb-6 space-y-3">
        <div>
          <Label htmlFor="donorName">Name (optional)</Label>
          <Input
            id="donorName"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="Your name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="donorEmail">Email (optional, for receipt)</Label>
          <Input
            id="donorEmail"
            type="email"
            value={donorEmail}
            onChange={(e) => setDonorEmail(e.target.value)}
            placeholder="your@email.com"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="message">Message (optional)</Label>
          <Input
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Leave a note"
            className="mt-1"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <Button
        onClick={createPaymentIntent}
        disabled={loading || amountCents < 100}
        className="w-full"
        size="lg"
      >
        {loading ? 'Setting up...' : `Continue — $${(amountCents / 100).toFixed(2)}`}
      </Button>

      <p className="mt-4 text-center text-xs opacity-40">
        Payments processed securely by Stripe. Angel OS never sees your card details.
      </p>
    </div>
  )
}
