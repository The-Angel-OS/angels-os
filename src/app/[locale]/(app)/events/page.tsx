import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { CollectionHero } from '@/components/CollectionHero'
import React from 'react'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Angel OS'
  return {
    title: `Events | ${siteName}`,
    description: `Meetups, workshops, and experiences from ${siteName}.`,
  }
}

export default async function EventsPage() {
  const payload = await getPayload({ config: configPromise })
  const { tenantFilter, tenant } = await resolveTenantFromHeaders()
  const heroImage = tenantHeroImage(tenant)

  let events: { docs: any[]; totalDocs: number } = { docs: [], totalDocs: 0 }
  try {
    events = await payload.find({
      collection: 'events',
      depth: 1,
      limit: 50,
      overrideAccess: true,
      where: {
        and: [
          { status: { in: ['upcoming', 'live', 'completed'] } },
          tenantFilter,
        ],
      },
      sort: 'startDateTime',
    })
  } catch (error) {
    console.error('[EventsPage] Failed to fetch events:', error)
  }

  // Group events by status
  const liveEvents = events.docs.filter((e: any) => e.status === 'live')
  const upcomingEvents = events.docs.filter((e: any) => e.status === 'upcoming')
  const pastEvents = events.docs.filter((e: any) => e.status === 'completed')

  return (
    <div className="container py-8">
      <CollectionHero
        title="Events"
        subtitle="Meetups, workshops, and experiences"
        icon="📅"
        image={heroImage}
      />

      {events.docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-4xl mb-4">📅</p>
          <p className="text-lg font-medium text-foreground">No events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back soon — we&apos;re planning something special.
          </p>
        </div>
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
            {event.eventType === 'market_appearance'
              ? '🌵'
              : event.eventType === 'meetup'
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
        {/* Market appearance: show address + shop link */}
        {event.eventType === 'market_appearance' && event.location?.address && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            📍 {event.location.address}
          </p>
        )}
        {event.eventType === 'market_appearance' && badge !== 'completed' && (
          <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            🛍️ Shop at this market →
          </span>
        )}
      </div>
    </Link>
  )
}
