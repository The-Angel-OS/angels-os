'use client'

import React, { useMemo, useState } from 'react'
import { cn } from '@/utilities/cn'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  date: string // ISO date string
  time?: string | null
  venue?: string | null
  location?: string | null
  description?: string | null
  ticketUrl?: string | null
  soldOut?: boolean
  featured?: boolean
}

interface CalendarViewProps {
  events: CalendarEvent[]
  defaultView: 'list' | 'month'
  showPastEvents: boolean
  accentColor?: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDate(iso: string): Date {
  // Handle date-only strings (YYYY-MM-DD) without timezone shift
  if (iso.length === 10) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(iso)
}

function formatDate(date: Date): string {
  const day = date.getDate()
  const month = MONTH_NAMES[date.getMonth()]
  const weekday = DAY_NAMES[date.getDay()]
  return `${weekday}, ${month} ${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ─── List View ──────────────────────────────────────────────────────────────

function ListView({ events, accentColor }: { events: CalendarEvent[]; accentColor?: string | null }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No upcoming events scheduled.
      </div>
    )
  }

  // Group events by month
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; events: CalendarEvent[] }[] = []
    for (const event of events) {
      const date = parseDate(event.date)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const label = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
      let group = groups.find((g) => g.key === key)
      if (!group) {
        group = { key, label, events: [] }
        groups.push(group)
      }
      group.events.push(event)
    }
    return groups
  }, [events])

  return (
    <div className="space-y-8">
      {grouped.map((group) => (
        <div key={group.key}>
          <h3 className="text-lg font-semibold mb-4 text-foreground border-b border-border pb-2">
            {group.label}
          </h3>
          <div className="space-y-3">
            {group.events.map((event) => {
              const date = parseDate(event.date)
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))
              return (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-lg border transition-colors',
                    event.featured && !isPast
                      ? 'border-2 shadow-sm'
                      : 'border-border',
                    isPast && 'opacity-60',
                    !isPast && 'hover:bg-accent/5',
                  )}
                  style={event.featured && accentColor ? { borderColor: accentColor } : undefined}
                >
                  {/* Date badge */}
                  <div
                    className="flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white font-bold"
                    style={{ backgroundColor: accentColor || '#3B82F6' }}
                  >
                    <span className="text-xs uppercase leading-none">
                      {MONTH_NAMES[date.getMonth()].slice(0, 3)}
                    </span>
                    <span className="text-xl leading-tight">{date.getDate()}</span>
                  </div>

                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground truncate">{event.title}</h4>
                      {event.soldOut && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Sold Out
                        </span>
                      )}
                      {event.featured && !event.soldOut && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: accentColor || '#3B82F6' }}
                        >
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span>{formatDate(date)}</span>
                      {event.time && <span>{event.time}</span>}
                      {event.venue && <span>{event.venue}</span>}
                      {event.location && <span>{event.location}</span>}
                    </div>
                    {event.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {/* Ticket button */}
                  {event.ticketUrl && !event.soldOut && !isPast && (
                    <a
                      href={event.ticketUrl}
                      target={event.ticketUrl.startsWith('http') ? '_blank' : undefined}
                      rel={event.ticketUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: accentColor || '#3B82F6' }}
                    >
                      Tickets
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Month Grid View ────────────────────────────────────────────────────────

function MonthView({
  events,
  accentColor,
}: {
  events: CalendarEvent[]
  accentColor?: string | null
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Start on the month of the first event, or current month
    if (events.length > 0) {
      const first = parseDate(events[0].date)
      return { year: first.getFullYear(), month: first.getMonth() }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const { year, month } = currentMonth
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // Events for this month
  const monthEvents = useMemo(() => {
    return events.filter((e) => {
      const d = parseDate(e.date)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [events, year, month])

  const eventsForDay = (day: number) =>
    monthEvents.filter((e) => parseDate(e.date).getDate() === day)

  const prevMonth = () => {
    setCurrentMonth((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
    )
  }

  const nextMonth = () => {
    setCurrentMonth((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
    )
  }

  const today = new Date()

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground transition-colors"
          aria-label="Previous month"
        >
          &larr;
        </button>
        <h3 className="text-lg font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground transition-colors"
          aria-label="Next month"
        >
          &rarr;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Empty cells before first day */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dayEvents = eventsForDay(day)
          const isToday = isSameDay(new Date(year, month, day), today)

          return (
            <div
              key={day}
              className={cn(
                'bg-background p-2 min-h-[80px]',
                isToday && 'ring-2 ring-inset',
              )}
              style={isToday ? { ringColor: accentColor || '#3B82F6' } as React.CSSProperties : undefined}
            >
              <div
                className={cn(
                  'text-sm font-medium mb-1',
                  isToday ? 'font-bold' : 'text-muted-foreground',
                )}
                style={isToday ? { color: accentColor || '#3B82F6' } : undefined}
              >
                {day}
              </div>
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded truncate mb-0.5 text-white',
                    event.soldOut && 'opacity-60 line-through',
                  )}
                  style={{ backgroundColor: accentColor || '#3B82F6' }}
                  title={`${event.title}${event.time ? ` — ${event.time}` : ''}${event.venue ? ` @ ${event.venue}` : ''}`}
                >
                  {event.title}
                </div>
              ))}
            </div>
          )
        })}

        {/* Empty cells after last day */}
        {Array.from({ length: (7 - ((startOffset + daysInMonth) % 7)) % 7 }).map((_, i) => (
          <div key={`end-${i}`} className="bg-background p-2 min-h-[80px]" />
        ))}
      </div>
    </div>
  )
}

// ─── Main CalendarView ──────────────────────────────────────────────────────

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  defaultView,
  showPastEvents,
  accentColor,
}) => {
  const [view, setView] = useState<'list' | 'month'>(defaultView)

  // Filter and sort events
  const displayEvents = useMemo(() => {
    let filtered = [...events]
    if (!showPastEvents) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      filtered = filtered.filter((e) => parseDate(e.date) >= today)
    }
    filtered.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())
    return filtered
  }, [events, showPastEvents])

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-end mb-4">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'list'
                ? 'bg-foreground text-background'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            List
          </button>
          <button
            onClick={() => setView('month')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'month'
                ? 'bg-foreground text-background'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'list' ? (
        <ListView events={displayEvents} accentColor={accentColor} />
      ) : (
        <MonthView events={displayEvents} accentColor={accentColor} />
      )}
    </div>
  )
}
