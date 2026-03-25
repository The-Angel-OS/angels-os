'use client'

import React, { useState } from 'react'
import Link from 'next/link'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BOOKING_TYPE_LABELS: Record<string, string> = {
  service: 'Service Session',
  consultation: 'Consultation',
  rental: 'Equipment Rental',
  class: 'Class/Workshop',
  event: 'Event Ticket',
  custom: 'Custom',
}

interface AvailabilitySlot {
  id: string
  title: string
  availabilityType: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  slotDuration: number
  isActive: boolean
}

interface BookingRecord {
  id: string
  title: string
  bookingType: string
  status: string
  startDateTime: string
  clientName: string
}

interface BookingsAdminProps {
  availabilitySlots: AvailabilitySlot[]
  recentBookings: BookingRecord[]
  tenantName: string
}

export function BookingsAdmin({
  availabilitySlots,
  recentBookings,
  tenantName,
}: BookingsAdminProps) {
  const [showForm, setShowForm] = useState(false)
  const activeSlots = availabilitySlots.filter((s) => s.isActive)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings &amp; Availability</h1>
          <p className="text-muted-foreground">
            Manage appointment slots and view bookings for {tenantName}.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {showForm ? 'Close' : '+ Add Availability'}
        </button>
      </div>

      {/* Add Availability Form */}
      {showForm && <NewAvailabilityGuide />}

      {/* Weekly Schedule Overview */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Weekly Schedule</h2>
        {activeSlots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mb-1 font-semibold">No Availability Set</h3>
            <p className="text-sm text-muted-foreground">
              Set up your weekly availability to start accepting bookings.
              Click &quot;+ Add Availability&quot; above or create slots in the{' '}
              <Link href="/admin/collections/availability" className="text-primary underline">
                admin panel
              </Link>.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DAY_NAMES.map((day, idx) => {
              const daySlots = activeSlots.filter(
                (s) => s.availabilityType === 'weekly' && s.dayOfWeek === String(idx),
              )
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 ${
                    daySlots.length > 0
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/50 bg-muted/10'
                  }`}
                >
                  <h3 className="mb-2 text-sm font-semibold">{day}</h3>
                  {daySlots.length > 0 ? (
                    <div className="space-y-1">
                      {daySlots.map((slot) => (
                        <div key={slot.id} className="flex items-center justify-between text-sm">
                          <span>
                            {slot.startTime} — {slot.endTime}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {slot.slotDuration}min
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not available</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* All Availability Slots */}
      {availabilitySlots.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">All Availability Slots</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Schedule</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {availabilitySlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{slot.title}</td>
                    <td className="py-3 pr-4 capitalize text-muted-foreground">
                      {slot.availabilityType}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {slot.dayOfWeek != null && DAY_NAMES[Number(slot.dayOfWeek)]}{' '}
                      {slot.startTime && slot.endTime && `${slot.startTime}–${slot.endTime}`}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{slot.slotDuration} min</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          slot.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {slot.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Edit slots in the{' '}
            <Link href="/admin/collections/availability" className="text-primary underline">
              admin panel
            </Link>
            .
          </p>
        </div>
      )}

      {/* Recent Bookings */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Bookings</h2>
        {recentBookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-muted-foreground">
              No bookings yet. Once customers book services, they will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Booking</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Client</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{booking.title}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{booking.clientName}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {booking.startDateTime
                        ? new Date(booking.startDateTime).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function NewAvailabilityGuide() {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
      <h3 className="mb-3 text-lg font-semibold">Setting Up Availability</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Create availability slots to define when you can accept bookings.
        The easiest way is through the Payload admin panel:
      </p>
      <ol className="mb-4 space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <span>
            Go to{' '}
            <Link href="/admin/collections/availability/create" className="text-primary underline">
              Create Availability
            </Link>{' '}
            in the admin panel
          </span>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            2
          </span>
          <span>Choose &quot;Recurring Weekly&quot; for regular hours (e.g., Mon-Fri 9am-5pm)</span>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            3
          </span>
          <span>Set your slot duration (30min, 60min, etc.) and buffer time between appointments</span>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            4
          </span>
          <span>Add exceptions for holidays or blackout dates</span>
        </li>
      </ol>
      <Link
        href="/admin/collections/availability/create"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Create Availability Slot
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Link>
    </div>
  )
}

function BookingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    'no-show': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  )
}
