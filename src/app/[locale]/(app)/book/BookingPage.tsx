'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookingDeposit } from './BookingDeposit'

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
  durationMinutes: number
}

interface BookingPageProps {
  availabilitySlots: AvailabilitySlot[]
  endeavorName: string
  services: ServiceOption[]
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

export function BookingPage({ availabilitySlots, endeavorName, services }: BookingPageProps) {
  const [serviceId, setServiceId] = useState<string | null>(
    services.length === 1 ? services[0]!.id : null,
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [step, setStep] = useState<'service' | 'date' | 'time' | 'confirm'>(
    services.length === 1 ? 'date' : 'service',
  )
  const [bookingState, setBookingState] = useState<'idle' | 'loading' | 'deposit' | 'success' | 'error'>('idle')
  const [bookingError, setBookingError] = useState('')
  const [payment, setPayment] = useState<PaymentData | null>(null)

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  )
  const serviceDuration = selectedService?.durationMinutes ?? 60

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

  // Generate start times for the chosen date that fit the selected service duration
  const timeSlots = useMemo(() => {
    if (!selectedDate) return []
    const dateObj = new Date(selectedDate + 'T00:00:00')
    const dow = dateObj.getDay()
    const matchingSlots = availabilitySlots.filter(
      (s) => s.availabilityType === 'weekly' && s.dayOfWeek === dow,
    )

    const times: Array<{ time: string; label: string }> = []
    for (const slot of matchingSlots) {
      if (!slot.startTime || !slot.endTime) continue
      const [startH, startM] = slot.startTime.split(':').map(Number)
      const [endH, endM] = slot.endTime.split(':').map(Number)
      if (startH == null || startM == null || endH == null || endM == null) continue

      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM
      // Start-time granularity = the availability rule's slot size (e.g. 60 min);
      // the booking itself occupies the selected service's duration.
      const increment = Math.max(15, slot.slotDuration || 60)

      for (let t = startMinutes; t + serviceDuration <= endMinutes; t += increment) {
        const h = Math.floor(t / 60)
        const m = t % 60
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        const ampm = h >= 12 ? 'PM' : 'AM'
        const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
        times.push({ time: timeStr, label: `${displayH}:${String(m).padStart(2, '0')} ${ampm}` })
      }
    }
    // De-dup (overlapping rules) and sort
    const seen = new Set<string>()
    return times.filter((t) => (seen.has(t.time) ? false : seen.add(t.time))).sort((a, b) => a.time.localeCompare(b.time))
  }, [selectedDate, availabilitySlots, serviceDuration])

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null

  const depositCents = selectedService
    ? Math.round(selectedService.priceUSD * (selectedService.depositPercent / 100) * 100)
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

  const stepNum = (s: 'service' | 'date' | 'time' | 'confirm') =>
    ({ service: 1, date: services.length === 1 ? 1 : 2, time: services.length === 1 ? 2 : 3, confirm: services.length === 1 ? 3 : 4 })[s]

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
          {/* Step: Select Service (only when more than one) */}
          {services.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'service' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  1
                </span>
                <h2 className="text-lg font-semibold">Select a Service</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => {
                  const dep = Math.round(s.priceUSD * (s.depositPercent / 100))
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
                      className={`rounded-xl border p-4 text-left transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{s.label}</span>
                        <span className="shrink-0 font-bold">${s.priceUSD}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.durationMinutes} min · ${dep} deposit to reserve
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step: Select Date */}
          {selectedService && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'date' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {stepNum('date')}
                </span>
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
          {selectedService && selectedDate && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'time' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {stepNum('time')}
                </span>
                <h2 className="text-lg font-semibold">
                  Select a Time — {selectedDateObj && DAY_FULL_NAMES[selectedDateObj.getDay()]},{' '}
                  {selectedDateObj?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </h2>
              </div>

              {timeSlots.length === 0 ? (
                <p className="text-muted-foreground">No available start times for this date.</p>
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
          {selectedService && selectedDate && selectedTime && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {stepNum('confirm')}
                </span>
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
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Service total</span>
                    <span className="font-medium">{money(totalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deposit due now ({selectedService.depositPercent}%)</span>
                    <span className="font-semibold">{money(depositCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Balance on completion</span>
                    <span className="font-medium">{money(totalCents - depositCents)}</span>
                  </div>
                </div>
              </div>

              {bookingState === 'success' ? (
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
                    onSuccess={() => setBookingState('success')}
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
                  <button
                    onClick={startCheckout}
                    disabled={bookingState === 'loading'}
                    className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {bookingState === 'loading' ? 'Reserving…' : `Continue — ${money(depositCents)} deposit`}
                  </button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Constitutional commerce — balance due on completion · 5% to the Justice Fund
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
