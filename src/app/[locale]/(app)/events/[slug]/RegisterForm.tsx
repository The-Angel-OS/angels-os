'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface RegisterFormProps {
  eventId: number
  eventTitle: string
  isWaitlist: boolean
  isLateRegistration: boolean
  locationType?: string
  /** Pre-fill from logged-in user — hides name/email fields when provided */
  user?: { name?: string; email?: string } | null
  pricing?: {
    isFree?: boolean
    amount?: number
    currency?: string
  } | null
}

export function RegisterForm({
  eventId,
  eventTitle,
  isWaitlist,
  isLateRegistration,
  locationType,
  user,
  pricing,
}: RegisterFormProps) {
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get('payment')
  const paymentRef = searchParams.get('ref')

  const isLoggedIn = !!(user?.name && user?.email)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [attendanceMode, setAttendanceMode] = useState<string>(
    locationType === 'virtual' ? 'virtual' : 'in-person',
  )
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const isPaid = !isWaitlist && !isLateRegistration && Boolean(pricing && !pricing.isFree && (pricing.amount || 0) > 0)
  const ticketPrice = pricing?.amount ? Number(pricing.amount).toFixed(2) : '0.00'
  const ticketCurrency = (pricing?.currency || 'USD').toUpperCase()

  useEffect(() => {
    if (paymentStatus === 'success' && paymentRef) {
      setStatus('submitting')
      fetch('/api/payment-ops/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: paymentRef }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok) {
            setStatus('success')
          } else {
            setStatus('idle')
          }
        })
        .catch(() => {
          setStatus('idle')
        })
    } else if (paymentStatus === 'canceled') {
      setStatus('error')
      setErrorMessage('Payment was canceled. You have not been charged.')
    }
  }, [paymentStatus, paymentRef])

  const showModeSelector =
    locationType === 'hybrid' || locationType === 'virtual'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return

    setStatus('submitting')
    setErrorMessage('')

    try {
      if (isPaid) {
        // Paid Event — initiate hosted checkout (Square / PayPal)
        const res = await fetch('/api/event-ops/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            name: name.trim(),
            email: email.trim(),
            attendanceMode,
            ticketCount: 1,
          }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.checkoutUrl) {
          throw new Error(data?.error || 'Unable to start checkout. Please try again.')
        }

        window.location.href = data.checkoutUrl
        return
      }

      // Free or waitlist registration
      const res = await fetch('/api/event-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventId,
          name: name.trim(),
          email: email.trim(),
          attendanceMode,
          registrationType: isLateRegistration ? 'post-event' : 'pre-event',
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg =
          body?.errors?.[0]?.message || body?.message || 'Registration failed. Please try again.'
        throw new Error(msg)
      }

      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err.message || 'Something went wrong.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-md bg-green-500/10 p-4 text-center">
        <p className="mb-1 text-sm font-medium text-green-600 dark:text-green-400">
          {isWaitlist ? "You're on the waitlist!" : "You're registered!"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isLateRegistration
            ? `We'll keep you updated about future "${eventTitle}" events.`
            : `We'll see you at "${eventTitle}".`}
        </p>
      </div>
    )
  }

  const buttonLabel = isWaitlist
    ? 'Join Waitlist'
    : isLateRegistration
      ? 'Stay in the Loop'
      : isPaid
        ? `Get Ticket — $${ticketPrice}`
        : 'Register'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isLateRegistration && (
        <p className="text-xs text-muted-foreground">
          This event has ended, but you can register to stay updated about future events like this.
        </p>
      )}

      {isPaid && (
        <div className="rounded-md bg-muted/60 border border-border px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Ticket Price</span>
          <span className="text-sm font-bold text-foreground">
            ${ticketPrice} <span className="text-xs font-normal text-muted-foreground">{ticketCurrency}</span>
          </span>
        </div>
      )}

      {isLoggedIn ? (
        <p className="text-sm text-muted-foreground">
          Registering as <span className="font-medium text-foreground">{user!.name}</span>{' '}
          <span className="text-xs">({user!.email})</span>
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-foreground">
              Name
            </label>
            <input
              id="reg-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1 block text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </>
      )}

      {showModeSelector && (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            How will you attend?
          </label>
          <div className="flex gap-2">
            {locationType === 'hybrid' && (
              <button
                type="button"
                onClick={() => setAttendanceMode('in-person')}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  attendanceMode === 'in-person'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-muted'
                }`}
              >
                In-Person
              </button>
            )}
            <button
              type="button"
              onClick={() => setAttendanceMode('virtual')}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                attendanceMode === 'virtual'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:bg-muted'
              }`}
            >
              Virtual
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-500">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {status === 'submitting' ? (isPaid ? 'Redirecting to checkout...' : 'Registering...') : buttonLabel}
      </button>
    </form>
  )
}
