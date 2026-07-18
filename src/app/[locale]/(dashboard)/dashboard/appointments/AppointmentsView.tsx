'use client'

/**
 * AppointmentsView — List / Calendar toggle for the appointments dashboard.
 *
 * The server page renders the grouped list (passed as `list`) and hands us a
 * lightweight, serialized `bookings` array for the month-grid calendar view.
 * Self-contained (no external calendar lib) so it works under the artifact/CSP
 * constraints and reuses the booking data already fetched server-side.
 */

import React, { useMemo, useState } from 'react'

export interface CalBooking {
  id: string | number
  title: string
  /** ISO start datetime. */
  start: string
  status: string
  /** Optional second line (service · client). */
  subtitle?: string
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-green-500',
  'in-progress': 'bg-blue-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-500',
  'no-show': 'bg-red-800',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function AppointmentsView({ list, bookings }: { list: React.ReactNode; bookings: CalBooking[] }) {
  const [view, setView] = useState<'list' | 'calendar'>('list')

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border border-border bg-muted/40 p-1">
        {(['list', 'calendar'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={[
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'list' ? list : <MonthCalendar bookings={bookings} />}
    </div>
  )
}

function MonthCalendar({ bookings }: { bookings: CalBooking[] }) {
  // Anchor the initial month on the earliest upcoming booking, else today.
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    const upcoming = bookings
      .map((b) => new Date(b.start))
      .filter((d) => d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const anchor = upcoming ?? now
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  })
  const [selected, setSelected] = useState<string | null>(null)

  // Bucket bookings by day key.
  const byDay = useMemo(() => {
    const m = new Map<string, CalBooking[]>()
    for (const b of bookings) {
      const k = dayKey(new Date(b.start))
      const arr = m.get(k)
      if (arr) arr.push(b)
      else m.set(k, [b])
    }
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    return m
  }, [bookings])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = dayKey(new Date())

  // Build a 6-row grid of dates (leading/trailing blanks as nulls).
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const goMonth = (delta: number) => {
    setSelected(null)
    setCursor(new Date(year, month + delta, 1))
  }
  const goToday = () => {
    const now = new Date()
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelected(todayKey)
  }

  const selectedBookings = selected ? byDay.get(selected) ?? [] : []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => goMonth(-1)} aria-label="Previous month"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted">‹</button>
          <button type="button" onClick={goToday}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Today</button>
          <button type="button" onClick={() => goMonth(1)} aria-label="Next month"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-[92px] bg-background/40" />
          const k = dayKey(date)
          const dayBookings = byDay.get(k) ?? []
          const isToday = k === todayKey
          const isSelected = k === selected
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(isSelected ? null : k)}
              className={[
                'min-h-[92px] bg-background p-1.5 text-left align-top transition-colors hover:bg-muted/50',
                isSelected ? 'ring-2 ring-inset ring-primary' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  isToday ? 'bg-primary font-bold text-primary-foreground' : 'text-foreground',
                ].join(' ')}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayBookings.slice(0, 3).map((b) => (
                  <div key={b.id} className="flex items-center gap-1 truncate text-[11px] leading-tight">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[b.status] || 'bg-gray-400'}`} />
                    <span className="truncate text-muted-foreground">
                      {fmtTime(b.start)} {b.title}
                    </span>
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <div className="text-[11px] text-muted-foreground">+{dayBookings.length - 3} more</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">
            {new Date(selected.split('-').map(Number)[0], selected.split('-').map(Number)[1], selected.split('-').map(Number)[2])
              .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          {selectedBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedBookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-md border border-border/60 p-2.5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[b.status] || 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{b.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {fmtTime(b.start)}
                      {b.subtitle ? ` · ${b.subtitle}` : ''} · {b.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
