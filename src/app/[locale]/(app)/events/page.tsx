import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import React from 'react'
import Link from 'next/link'

export const metadata = {
  description: 'Upcoming events, meetups, workshops, and livestreams.',
  title: 'Events',
}

export default async function EventsPage() {
  const payload = await getPayload({ config: configPromise })

  // Resolve tenant from middleware-injected header
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }

  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  const events = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 50,
    overrideAccess: true,
    where: {
      and: [
        { status: { in: ['upcoming', 'live', 'completed'] } },
        ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
      ],
    },
    sort: 'startDateTime',
  })

  // Group events by status
  const liveEvents = events.docs.filter((e: any) => e.status === 'live')
  const upcomingEvents = events.docs.filter((e: any) => e.status === 'upcoming')
  const pastEvents = events.docs.filter((e: any) => e.status === 'completed')

  return (
    <div className="container py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Events</h1>
      </div>

      {events.docs.length === 0 ? (
        <p className="text-muted-foreground">No events yet. Check back soon!</p>
      ) : (
        <div className="space-y-10">
          {liveEvents.length > 0 && (
            <EventSection title="Live Now" events={liveEvents} badge="live" />
          )}
          {upcomingEvents.length > 0 && (
            <EventSection title="Upcoming" events={upcomingEvents} badge="upcoming" />
          )}
          {pastEvents.length > 0 && (
            <EventSection title="Past Events" events={pastEvents} badge="completed" />
          )}
        </div>
      )}
    </div>
  )
}

function EventSection({
  title,
  events,
  badge,
}: {
  title: string
  events: any[]
  badge: string
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event: any) => (
          <EventCard key={event.id} event={event} badge={badge} />
        ))}
      </div>
    </section>
  )
}

function EventCard({ event, badge }: { event: any; badge: string }) {
  const startDate = new Date(event.startDateTime)
  const coverUrl =
    typeof event.coverImage === 'object' && event.coverImage?.url
      ? event.coverImage.url
      : null

  const locationType = event.location?.type
  const locationLabel =
    locationType === 'virtual'
      ? 'Virtual'
      : locationType === 'hybrid'
        ? 'Hybrid'
        : event.location?.venueName || 'In-Person'

  const badgeColors: Record<string, string> = {
    live: 'bg-red-500 text-white',
    upcoming: 'bg-blue-500 text-white',
    completed: 'bg-gray-500 text-white',
  }

  const badgeLabels: Record<string, string> = {
    live: 'LIVE',
    upcoming: event.eventType?.charAt(0).toUpperCase() + event.eventType?.slice(1),
    completed: 'Past',
  }

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
    >
      {/* Cover image */}
      <div className="relative aspect-[16/9] bg-muted">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">
            {event.eventType === 'meetup'
              ? '🤝'
              : event.eventType === 'workshop'
                ? '🔧'
                : event.eventType === 'livestream'
                  ? '📺'
                  : event.eventType === 'conference'
                    ? '🎤'
                    : '📅'}
          </div>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[badge] || 'bg-gray-500 text-white'}`}
        >
          {badgeLabels[badge] || badge}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground group-hover:text-primary">
          {event.title}
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          {startDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}{' '}
          at{' '}
          {startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{locationLabel}</span>
          {event.pricing?.isFree !== false && (
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
              Free
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
