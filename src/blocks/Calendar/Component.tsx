import React from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { cn } from '@/utilities/cn'
import { RichText } from '@/components/RichText'
import { CalendarView, type CalendarEvent } from './CalendarView.client'

interface CalendarBlockProps {
  id?: string | number
  className?: string
  heading?: string | null
  description?: SerializedEditorState | null
  sourceType?: 'manual' | 'products' | null
  events?: Array<{
    title: string
    date: string
    time?: string | null
    venue?: string | null
    location?: string | null
    description?: string | null
    ticketUrl?: string | null
    soldOut?: boolean | null
    featured?: boolean | null
    id?: string | null
  }> | null
  productCategory?: string | null
  maxEvents?: number | null
  defaultView?: 'list' | 'month' | null
  showPastEvents?: boolean | null
  accentColor?: string | null
}

export const CalendarBlock: React.FC<CalendarBlockProps> = ({
  className,
  heading,
  description,
  sourceType,
  events: manualEvents,
  defaultView,
  showPastEvents,
  accentColor,
  maxEvents,
}) => {
  // Normalize manual events to CalendarEvent[]
  let calendarEvents: CalendarEvent[] = []

  if (sourceType === 'manual' && manualEvents) {
    calendarEvents = manualEvents
      .filter((e) => e.title && e.date)
      .map((e, i) => ({
        id: e.id || `event-${i}`,
        title: e.title,
        date: e.date,
        time: e.time,
        venue: e.venue,
        location: e.location,
        description: e.description,
        ticketUrl: e.ticketUrl,
        soldOut: Boolean(e.soldOut),
        featured: Boolean(e.featured),
      }))
  }

  // For product-sourced events, the client component will fetch via API
  // (handled below in the CalendarView)

  const limit = maxEvents ?? 20
  if (calendarEvents.length > limit) {
    calendarEvents = calendarEvents.slice(0, limit)
  }

  return (
    <div className={cn('mx-auto my-8 w-full max-w-5xl', className)}>
      {heading && (
        <h2 className="text-2xl font-bold text-foreground mb-2">{heading}</h2>
      )}
      {description && (
        <div className="mb-6">
          <RichText data={description} enableGutter={false} enableProse={false} />
        </div>
      )}
      <CalendarView
        events={calendarEvents}
        defaultView={defaultView || 'list'}
        showPastEvents={Boolean(showPastEvents)}
        accentColor={accentColor}
      />
    </div>
  )
}
