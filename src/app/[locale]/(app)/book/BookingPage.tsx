'use client'

import React, { useMemo, useState } from 'react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SERVICE_LABELS: Record<string, string> = {
  service: 'Service Session',
  consultation: 'Consultation',
  rental: 'Equipment Rental',
  class: 'Class / Workshop',
  event: 'Event Ticket',
  custom: 'Custom',
}

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

interface BookingPageProps {
  availabilitySlots: AvailabilitySlot[]
  endeavorName: string
}

export function BookingPage({ availabilitySlots, endeavorName }: BookingPageProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [step, setStep] = useState<'date' | 'time' | 'confirm'>('date')

  // Generate next 30 days
  const dates = useMemo(() => {
    const result: Array<{ date: string; dayOfWeek: number; label: string; available: boolean }> = []
    const now = new Date()
    const maxDays = Math.max(...availabilitySlots.map((s) => s.maxAdvanceBooking), 30)

    for (let i = 0; i < maxDays; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      const dateStr = d.toISOString().split('T')[0]!

      // Check if any weekly slot matches this day of week
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

  // Generate time slots for selected date
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
      const increment = slot.slotDuration + slot.bufferTime

      for (let t = startMinutes; t + slot.slotDuration <= endMinutes; t += increment) {
        const h = Math.floor(t / 60)
        const m = t % 60
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        const ampm = h >= 12 ? 'PM' : 'AM'
        const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
        const label = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`
        times.push({ time: timeStr, label })
      }
    }

    return times
  }, [selectedDate, availabilitySlots])

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null

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
        <p className="text-muted-foreground">
          Schedule an appointment with {endeavorName}
        </p>
      </div>

      {availabilitySlots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">No Availability Set Up</h3>
          <p className="text-muted-foreground">
            This enterprise hasn&apos;t set up their booking schedule yet. Check back soon or contact
            them directly.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Step 1: Select Date */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step === 'date' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </span>
              <h2 className="text-lg font-semibold">Select a Date</h2>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}

              {/* Padding for first week alignment */}
              {dates.length > 0 &&
                Array.from({ length: dates[0]!.dayOfWeek }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}

              {/* Date buttons */}
              {dates.slice(0, 35).map((d) => (
                <button
                  key={d.date}
                  disabled={!d.available}
                  onClick={() => {
                    setSelectedDate(d.date)
                    setSelectedTime(null)
                    setStep('time')
                  }}
                  className={`rounded-lg p-2 text-center text-sm transition-colors ${
                    selectedDate === d.date
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : d.available
                        ? 'hover:bg-primary/10 cursor-pointer'
                        : 'text-muted-foreground/30 cursor-not-allowed'
                  }`}
                >
                  <div className="text-xs text-inherit opacity-70">
                    {d.label.split(' ')[0]}
                  </div>
                  <div className="font-medium">{d.label.split(' ')[1]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Select Time */}
          {selectedDate && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  step === 'time' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </span>
                <h2 className="text-lg font-semibold">
                  Select a Time — {selectedDateObj && DAY_FULL_NAMES[selectedDateObj.getDay()]},{' '}
                  {selectedDateObj?.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
              </div>

              {timeSlots.length === 0 ? (
                <p className="text-muted-foreground">No available time slots for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {timeSlots.map((t) => (
                    <button
                      key={t.time}
                      onClick={() => {
                        setSelectedTime(t.time)
                        setStep('confirm')
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

          {/* Step 3: Confirm */}
          {selectedDate && selectedTime && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  3
                </span>
                <h2 className="text-lg font-semibold">Confirm Your Booking</h2>
              </div>

              <div className="mb-6 rounded-lg bg-muted/30 p-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Enterprise:</span>
                    <p className="font-medium">{endeavorName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">
                      {selectedDateObj?.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>
                    <p className="font-medium">
                      {timeSlots.find((t) => t.time === selectedTime)?.label || selectedTime}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <p className="font-medium">
                      {availabilitySlots[0]?.slotDuration || 60} minutes
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
                <p className="mb-2 text-sm text-muted-foreground">
                  Payment integration coming soon. For now, contact the enterprise directly to confirm.
                </p>
                <span className="inline-block rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
                  Stripe Booking Checkout — Coming Soon
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
