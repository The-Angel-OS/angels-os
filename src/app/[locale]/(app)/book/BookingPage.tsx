'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookingDeposit } from './BookingDeposit'
import { AgreementForm } from '@/components/signatures/AgreementForm'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface AvailabilitySlot {
  id: string
  title: string
  availabilityType: string
  dayOfWeek: number | null
  startTime: string
  endTime: string
  slotDuration: number
  bufferTime: number
  maxAdvanceBooking: number
  serviceTypes: Array<{ serviceType: string; maxConcurrent: number }>
}

interface ServiceOption {
  id: string
  label: string
  description: string
  priceUSD: number
  depositPercent: number
  /** Fixed deposit in USD; wins over depositPercent. See depositUsd(). */
  depositFlatUsd?: number
  durationMinutes: number
  /** Optional service image — shown on the selection card like a product. */
  imageUrl?: string
  /** Optional rental/service agreement terms; when set, must be e-signed before deposit. */
  serviceAgreement?: string
}

interface BookingPageProps {
  availabilitySlots: AvailabilitySlot[]
  endeavorName: string
  services: ServiceOption[]
  tenantSlug?: string
  tenantId?: number | string
  publishableKey?: string
}

interface PaymentData {
  clientSecret: string
  stripeAccountId: string
  depositCents: number
  totalCents: number
  balanceCents: number
  bookingId: string
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function BookingPage({ availabilitySlots, endeavorName, services, tenantSlug, tenantId, publishableKey }: BookingPageProps) {
  const [serviceId, setServiceId] = useState<string | null>(
    services.length === 1 ? services[0]!.id : null,
  )
  // Rental/service agreement consent: keyed by serviceId so changing the selected
  // service re-requires a signature for the new terms.
  const [signedServiceId, setSignedServiceId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [step, setStep] = useState<'service' | 'date' | 'time' | 'confirm'>(
    services.length === 1 ? 'date' : 'service',
  )
  const [bookingState, setBookingState] = useState<'idle' | 'loading' | 'deposit' | 'success' | 'requested' | 'error'>('idle')

  // Mirrors depositCents() in config/bookableServices.ts — a flat deposit wins,
  // so work that is quoted on site can still take money to hold the slot.
  const depositUsd = (s: { priceUSD: number; depositPercent: number; depositFlatUsd?: number }) =>
    s.depositFlatUsd && s.depositFlatUsd > 0
      ? Math.round(s.depositFlatUsd)
      : Math.round(s.priceUSD * (s.depositPercent / 100))
  const [bookingError, setBookingError] = useState('')
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [requestInfo, setRequestInfo] = useState<{ bookingId: string; note: string; totalCents: number } | null>(null)

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  )
  const serviceDuration = selectedService?.durationMinutes ?? 60

  // When the selected service carries an agreement, it must be signed (for THIS
  // service) before the deposit/checkout can proceed.
  const agreementRequired = Boolean(selectedService?.serviceAgreement?.trim())
  const agreementSatisfied = !agreementRequired || signedServiceId === selectedService?.id

  // Generate the bookable date range (limited by maxAdvanceBooking)
  const dates = useMemo(() => {
    const result: Array<{ date: string; dayOfWeek: number; label: string; available: boolean }> = []
    const now = new Date()
    const maxDays = Math.max(...availabilitySlots.map((s) => s.maxAdvanceBooking), 30)

    for (let i = 0; i < maxDays; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      const dateStr = d.toISOString().split('T')[0]!
      const available = availabilitySlots.some(
        (s) => s.availabilityType === 'weekly' && s.dayOfWeek === dow,
      )
      result.push({
        date: dateStr,
        dayOfWeek: dow,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        available,
      })
    }
    return result
  }, [availabilitySlots])

  const labelForTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    if (h == null || m == null) return hhmm
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`
  }

  // Client-side fallback: start times that fit the service within open hours
  // (does NOT account for existing bookings — the server does that).
  const openHourSlots = useMemo(() => {
    if (!selectedDate) return []
    const dow = new Date(selectedDate + 'T00:00:00').getDay()
    const matchingSlots = availabilitySlots.filter((s) => s.availabilityType === 'weekly' && s.dayOfWeek === dow)
    const times: Array<{ time: string; label: string }> = []
    for (const slot of matchingSlots) {
      if (!slot.startTime || !slot.endTime) continue
      const [sH, sM] = slot.startTime.split(':').map(Number)
      const [eH, eM] = slot.endTime.split(':').map(Number)
      if (sH == null || sM == null || eH == null || eM == null) continue
      const startMinutes = sH * 60 + sM
      const endMinutes = eH * 60 + eM
      const increment = Math.max(15, slot.slotDuration || 60)
      for (let t = startMinutes; t + serviceDuration <= endMinutes; t += increment) {
        const timeStr = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
        times.push({ time: timeStr, label: labelForTime(timeStr) })
      }
    }
    const seen = new Set<string>()
    return times.filter((t) => (seen.has(t.time) ? false : seen.add(t.time))).sort((a, b) => a.time.localeCompare(b.time))
  }, [selectedDate, availabilitySlots, serviceDuration])

  // Server-side smart slots: duration-aware AND conflict-aware (excludes times that
  // overlap existing bookings, so a 6-hour service only offers 6 contiguous free hours).
  const [serverSlots, setServerSlots] = useState<Array<{ time: string; label: string }> | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  React.useEffect(() => {
    if (!selectedDate || !serviceId) {
      setServerSlots(null)
      return
    }
    let cancelled = false
    setSlotsLoading(true)
    fetch('/api/booking-ops/public-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, duration: serviceDuration, tenantSlug }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const arr = Array.isArray(d?.slots) ? (d.slots as Array<{ time: string }>) : null
        setServerSlots(arr ? arr.map((s) => ({ time: s.time, label: labelForTime(s.time) })) : null)
      })
      .catch(() => {
        if (!cancelled) setServerSlots(null)
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDate, serviceId, serviceDuration, tenantSlug])

  // Authoritative: the server's conflict-aware list when we have it, else open-hours.
  const timeSlots = serverSlots ?? openHourSlots

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null

  const depositCents = selectedService
    ? depositUsd(selectedService) * 100
    : 0
  const totalCents = selectedService ? Math.round(selectedService.priceUSD * 100) : 0

  const startCheckout = async () => {
    if (!selectedDate || !selectedTime || !serviceId) return
    setBookingState('loading')
    setBookingError('')

    try {
      const res = await fetch('/api/booking-ops/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date: selectedDate, time: selectedTime, serviceId }),
      })

      if (res.status === 401) {
        setBookingState('error')
        setBookingError('Please sign in to book a service.')
        return
      }

      const data = await res.json()

      if (res.status === 409) {
        // Slot was taken between browsing and confirming — bounce back to time pick
        setBookingState('error')
        setBookingError(data.error || 'That time was just taken. Please choose another slot.')
        setSelectedTime(null)
        setStep('time')
        return
      }

      if (!res.ok) {
        setBookingState('error')
        setBookingError(data.error || 'Something went wrong. Please try again.')
        return
      }

      // COD / no-deposit path — the booking stands as a request, no payment step.
      if (data.requested) {
        setRequestInfo({
          bookingId: String(data.bookingId),
          note: data.paymentNote || '',
          totalCents: data.totalCents ?? 0,
        })
        setBookingState('requested')
        return
      }

      setPayment({
        clientSecret: data.clientSecret,
        stripeAccountId: data.stripeAccountId,
        depositCents: data.depositCents,
        totalCents: data.totalCents,
        balanceCents: data.balanceCents,
        bookingId: String(data.bookingId),
      })
      setBookingState('deposit')
    } catch {
      setBookingState('error')
      setBookingError('Connection error. Please try again.')
    }
  }

  // ── Wizard steps (progress bar echoes the completed selections) ─────────────
  type StepKey = 'service' | 'date' | 'time' | 'confirm'
  const wizardSteps: Array<{ key: StepKey; label: string; value: string | null }> = [
    ...(services.length > 1
      ? [{ key: 'service' as const, label: 'Service', value: selectedService?.label ?? null }]
      : []),
    { key: 'date', label: 'Date', value: selectedDateObj ? selectedDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null },
    { key: 'time', label: 'Time', value: selectedTime ? (timeSlots.find((t) => t.time === selectedTime)?.label ?? selectedTime) : null },
    { key: 'confirm', label: 'Confirm', value: null },
  ]
  const currentIdx = wizardSteps.findIndex((s) => s.key === step)

  // Navigate back to an already-completed step via the progress bar. No-op if it's
  // the step we're already on — clicking the CURRENT chip used to reset
  // bookingState to 'idle', which unmounted the Stripe deposit form mid-payment
  // (and re-initiating then 409'd against the hold already created).
  const goToStep = (key: StepKey) => {
    if (key === step) return
    setBookingState('idle')
    setBookingError('')
    setStep(key)
  }

  const inWizard = bookingState !== 'success' && bookingState !== 'requested'

  return (
    <div className="container max-w-3xl py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="mb-2 text-3xl font-bold">Book a Service</h1>
        <p className="text-muted-foreground">Schedule with {endeavorName}</p>
      </div>

      {availabilitySlots.length === 0 || services.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">Booking Not Set Up Yet</h3>
          <p className="text-muted-foreground">
            This enterprise hasn&apos;t opened their booking schedule yet. Check back soon or contact
            them directly.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Progress bar — shows steps with the chosen value echoed; click a
              completed step to go back. */}
          {inWizard && (
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 sm:gap-2">
              {wizardSteps.map((s, i) => {
                const done = i < currentIdx && s.value != null
                const current = i === currentIdx
                // Only PAST steps navigate back; the current chip is not clickable
                // (clicking it would reset the in-progress deposit form).
                const clickable = i < currentIdx
                return (
                  <React.Fragment key={s.key}>
                    {i > 0 && <div className={`h-px flex-1 min-w-3 ${i <= currentIdx ? 'bg-primary/40' : 'bg-border'}`} />}
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && goToStep(s.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                        current ? 'bg-primary/10' : clickable ? 'hover:bg-muted' : 'opacity-50'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? 'bg-green-600 text-white' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {done ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (i + 1)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
                        {s.value && <span className="block truncate text-xs font-medium">{s.value}</span>}
                      </span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>
          )}

          {/* Step: Select Service (only when more than one) */}
          {step === 'service' && services.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'service' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  1
                </span>
                <h2 className="text-lg font-semibold">Select a Service</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => {
                  const dep = depositUsd(s)
                  const active = serviceId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServiceId(s.id)
                        setSelectedTime(null)
                        setStep('date')
                        setBookingState('idle')
                      }}
                      className={`overflow-hidden rounded-xl border text-left transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5'}`}
                    >
                      {s.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt={s.label} className="h-32 w-full object-cover" />
                      )}
                      <div className={`flex items-start justify-between gap-2 ${s.imageUrl ? 'px-4 pt-4' : 'px-4 pt-4'}`}>
                        <span className="font-semibold">{s.label}</span>
                        {/* Quote-based services (price 0) read as "free" if shown as $0. */}
                        <span className="shrink-0 font-bold">{s.priceUSD > 0 ? `$${s.priceUSD}` : 'Quote'}</span>
                      </div>
                      <p className="mt-1 px-4 text-xs text-muted-foreground">{s.description}</p>
                      <p className="mt-2 px-4 pb-4 text-xs text-muted-foreground">
                        {s.durationMinutes} min · {dep > 0 ? `$${dep} deposit to reserve${s.priceUSD > 0 ? '' : ', credited to your invoice'}` : 'no deposit — request a visit'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step: Select Date */}
          {step === 'date' && selectedService && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold">Select a Date</h2>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
                {dates.length > 0 &&
                  Array.from({ length: dates[0]!.dayOfWeek }).map((_, i) => <div key={`pad-${i}`} />)}
                {dates.slice(0, 35).map((d) => (
                  <button
                    key={d.date}
                    disabled={!d.available}
                    onClick={() => {
                      setSelectedDate(d.date)
                      setSelectedTime(null)
                      setStep('time')
                      setBookingState('idle')
                    }}
                    className={`rounded-lg p-2 text-center text-sm transition-colors ${
                      selectedDate === d.date
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : d.available
                          ? 'hover:bg-primary/10 cursor-pointer'
                          : 'text-muted-foreground/30 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-xs text-inherit opacity-70">{d.label.split(' ')[0]}</div>
                    <div className="font-medium">{d.label.split(' ')[1]}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Select Time */}
          {step === 'time' && selectedService && selectedDate && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  Select a Time — {selectedDateObj && DAY_FULL_NAMES[selectedDateObj.getDay()]},{' '}
                  {selectedDateObj?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </h2>
              </div>

              {slotsLoading && serverSlots === null ? (
                <p className="text-muted-foreground">Checking open times…</p>
              ) : timeSlots.length === 0 ? (
                <p className="text-muted-foreground">
                  No open times for a {serviceDuration >= 60 ? `${Math.round(serviceDuration / 60)}-hour` : `${serviceDuration}-min`} {selectedService?.label.toLowerCase() ?? 'service'} on this date — every slot is booked or too short. Try another day.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {timeSlots.map((t) => (
                    <button
                      key={t.time}
                      onClick={() => {
                        setSelectedTime(t.time)
                        setStep('confirm')
                        setBookingState('idle')
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedTime === t.time
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Confirm + deposit */}
          {(step === 'confirm' || bookingState === 'success' || bookingState === 'requested') && selectedService && selectedDate && selectedTime && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold">Confirm &amp; Reserve</h2>
              </div>

              <div className="mb-6 rounded-lg bg-muted/30 p-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Service:</span>
                    <p className="font-medium">{selectedService.label}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">With:</span>
                    <p className="font-medium">{endeavorName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">
                      {selectedDateObj?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <p className="font-medium">
                      {timeSlots.find((t) => t.time === selectedTime)?.label || selectedTime} · {serviceDuration} min
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3 text-sm">
                  {totalCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Service total</span>
                      <span className="font-medium">{money(totalCents)}</span>
                    </div>
                  )}
                  {depositCents > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        {/* A FLAT deposit has no percentage — printing one showed
                            "Deposit due now (20%)" on a $75 flat fee. */}
                        <span className="text-muted-foreground">
                          Deposit due now
                          {totalCents > 0 && selectedService.depositPercent
                            ? ` (${selectedService.depositPercent}%)`
                            : ''}
                        </span>
                        <span className="font-semibold">{money(depositCents)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Balance on completion</span>
                        {/* No service total means the job is QUOTED, not free —
                            subtracting gave "-$75.00", which reads as the customer
                            being owed money at the exact moment they're asked to pay. */}
                        <span className="font-medium">
                          {totalCents > depositCents ? money(totalCents - depositCents) : 'Quoted on completion'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment</span>
                      <span className="font-medium">{totalCents > 0 ? 'Due on completion' : 'No charge to request'}</span>
                    </div>
                  )}
                </div>
              </div>

              {bookingState === 'requested' ? (
                <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-6 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mb-1 text-lg font-semibold text-green-700 dark:text-green-400">
                    Booking Requested!
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Your {selectedService.label.toLowerCase()} with {endeavorName} is requested for the time above.
                    They&apos;ll confirm with you shortly.{requestInfo?.note ? ` ${requestInfo.note}` : ''}
                  </p>
                  {requestInfo?.bookingId && (
                    <p className="text-xs text-muted-foreground">Booking ID: {requestInfo.bookingId}</p>
                  )}
                  <Link href="/dashboard" className="mt-4 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    View in Dashboard
                  </Link>
                </div>
              ) : bookingState === 'success' ? (
                <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-6 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mb-1 text-lg font-semibold text-green-700 dark:text-green-400">
                    Reserved!
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Your {selectedService.label.toLowerCase()} with {endeavorName} is booked. Deposit
                    received — the balance is due on completion. A confirmation email is on its way.
                  </p>
                  {payment?.bookingId && (
                    <p className="text-xs text-muted-foreground">Booking ID: {payment.bookingId}</p>
                  )}
                  <Link href="/dashboard" className="mt-4 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    View in Dashboard
                  </Link>
                </div>
              ) : bookingState === 'deposit' && payment ? (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Pay the {money(payment.depositCents)} deposit to lock in your slot.
                  </p>
                  <BookingDeposit
                    clientSecret={payment.clientSecret}
                    stripeAccountId={payment.stripeAccountId}
                    amountLabel={money(payment.depositCents)}
                    publishableKey={publishableKey}
                    onSuccess={() => {
                      setBookingState('success')
                      // Server-verify the deposit + lock the booking (clears the
                      // 15-min hold so a paid slot can't expire). Fire-and-forget:
                      // the UI already shows success; confirmation is idempotent.
                      void fetch('/api/booking-ops/confirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId: payment.bookingId }),
                      }).catch(() => {})
                    }}
                  />
                </div>
              ) : (
                <div>
                  {bookingError && (
                    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                      {bookingError}
                      {bookingError.includes('sign in') && (
                        <div className="mt-2">
                          <Link href="/login" className="font-medium text-primary underline">Sign in</Link>
                          {' or '}
                          <Link href="/create-account" className="font-medium text-primary underline">create an account</Link>
                        </div>
                      )}
                    </div>
                  )}
                  {agreementRequired && selectedService.serviceAgreement && (
                    <div className="mb-4 rounded-lg border border-border bg-background p-4">
                      {agreementSatisfied ? (
                        <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Agreement signed — you can proceed to the deposit.
                        </p>
                      ) : (
                        <AgreementForm
                          documentRef={`service-agreement:${selectedService.id}`}
                          documentType="agreement"
                          documentTitle={`${selectedService.label} — Rental Agreement`}
                          terms={selectedService.serviceAgreement}
                          tenantSlug={tenantSlug}
                          tenantId={tenantId}
                          submitLabel="Sign Agreement"
                          acknowledgeLabel="I have read and agree to the terms of this rental/service agreement."
                          onSigned={() => setSignedServiceId(selectedService.id)}
                        />
                      )}
                    </div>
                  )}
                  <button
                    onClick={startCheckout}
                    disabled={bookingState === 'loading' || !agreementSatisfied}
                    title={!agreementSatisfied ? 'Please sign the agreement above first' : undefined}
                    className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {bookingState === 'loading'
                      ? (depositCents > 0 ? 'Reserving…' : 'Requesting…')
                      : !agreementSatisfied
                        ? 'Sign the agreement to continue'
                        : depositCents > 0
                          ? `Continue — ${money(depositCents)} deposit`
                          : 'Request Booking'}
                  </button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {depositCents > 0
                      ? 'Constitutional commerce — balance due on completion · 5% to the Justice Fund'
                      : totalCents > 0
                        ? 'No deposit required — payment is collected on completion (cash, check, or Zelle).'
                        : 'No payment required to request this booking.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
