import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import React from 'react'
import { RegisterForm } from './RegisterForm'
import { RichText } from '@/components/RichText'
import { EventGallery } from './EventGallery'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()
  const events = await payload.find({
    collection: 'events',
    where: { and: [{ slug: { equals: slug } }, tenantFilter] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const event = events.docs?.[0]
  if (!event) return { title: 'Event Not Found' }
  return {
    title: event.title,
    description: `${event.eventType} — ${new Date(event.startDateTime).toLocaleDateString()}`,
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const events = await payload.find({
    collection: 'events',
    where: {
      and: [
        { slug: { equals: slug } },
        tenantFilter,
      ],
    },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })

  const event = events.docs?.[0] as any
  if (!event) notFound()

  // Count registrations
  const registrationCount = await payload.count({
    collection: 'event-registrations',
    where: {
      and: [
        { event: { equals: event.id } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    overrideAccess: true,
  })

  // Resolve logged-in user to prefill registration form
  const headersList = await headers()
  let regUser: { name?: string; email?: string } | null = null
  try {
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      regUser = {
        name: (user as any).name || undefined,
        email: (user as any).email || undefined,
      }
    }
  } catch {
    // Not logged in — form will show name/email fields
  }

  const startDate = new Date(event.startDateTime)
  const endDate = event.endDateTime ? new Date(event.endDateTime) : null
  const coverUrl =
    typeof event.coverImage === 'object' && event.coverImage?.url
      ? event.coverImage.url
      : null
  const hostName =
    typeof event.host === 'object'
      ? event.host.name || event.host.email
      : 'Unknown Host'

  // "Past" is the temporal weight of the page, and it is NOT just status:
  // status is a manual dropdown nobody remembers to flip, so an event whose end
  // time has gone by reads as past whatever the dropdown says.
  const isPast =
    event.status === 'completed' ||
    (endDate ? endDate.getTime() < Date.now() : startDate.getTime() < Date.now())

  const locationType = event.location?.type
  const isVirtual = locationType === 'virtual' || locationType === 'hybrid'
  const isInPerson = locationType === 'in-person' || locationType === 'hybrid'

  const capacity = event.capacity?.maxAttendees || 0
  const isAtCapacity = capacity > 0 && registrationCount.totalDocs >= capacity
  const reg = event.registration || {}
  const canRegister =
    reg.isOpen &&
    !isAtCapacity &&
    (event.status === 'upcoming' || event.status === 'live')
  const canWaitlist = reg.isOpen && isAtCapacity && event.capacity?.waitlistEnabled
  const canLateRegister =
    reg.allowLateRegistration && event.status === 'completed'

  const statusColors: Record<string, string> = {
    live: 'bg-red-500 text-white',
    upcoming: 'bg-blue-500 text-white',
    completed: 'bg-gray-500 text-white',
    cancelled: 'bg-red-800 text-white',
    draft: 'bg-yellow-500 text-black',
  }

  return (
    <div className="container py-12">
      {/* Hero */}
      {coverUrl && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            src={coverUrl}
            alt={event.title}
            className="h-64 w-full object-cover sm:h-80"
          />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[event.status] || 'bg-gray-500 text-white'}`}
            >
              {event.status === 'live' ? 'LIVE NOW' : event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
            </span>
            {event.pricing?.isFree !== false && (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                Free
              </span>
            )}
          </div>

          <h1 className="mb-4 text-3xl font-bold">{event.title}</h1>

          {/* Market appearance — shop + kiosk QR card */}
          {event.eventType === 'market_appearance' && event.status !== 'completed' && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">🛍️ Shop at this market</p>
                <p className="text-sm text-muted-foreground">
                  Browse products and pay on your phone — no app needed.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href="/kiosk"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open Shop
                </a>
                <a
                  href={`/kiosk/qr?event=${event.slug}`}
                  className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  Print QR
                </a>
              </div>
            </div>
          )}

          <div className="mb-6 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span>
                {startDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                at{' '}
                {startDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {endDate && (
                  <>
                    {' '}—{' '}
                    {endDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </span>
            </div>

            {event.timezone && (
              <div className="flex items-center gap-2">
                <span>🌐</span>
                <span>{event.timezone}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span>👤</span>
              <span>Hosted by {hostName}</span>
            </div>

            {isInPerson && (
              <div className="flex items-start gap-2">
                <span>📍</span>
                <span>
                  {event.location?.venueName}
                  {event.location?.address && ` — ${event.location.address}`}
                  {event.location?.address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${event.location.venueName || ''} ${event.location.address}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline"
                    >
                      Directions →
                    </a>
                  )}
                </span>
              </div>
            )}

            {isVirtual && event.location?.remotePlatform && (
              <div className="flex items-center gap-2">
                <span>💻</span>
                <span>
                  {event.location.remotePlatform.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
              </div>
            )}
          </div>

          {/* Description — this rendered the literal string "Event description
              available in admin." on the public page for every event that had
              one. The field was always richText; nothing was ever rendering it. */}
          {event.description && (
            <RichText data={event.description} enableGutter={false} className="max-w-none" />
          )}

          {/* Video — before the event this is the trailer, after it is the
              recording. Same field, and which one it is depends only on when
              you arrive. */}
          {event.videoEmbed?.embedUrl && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">
                {isPast ? 'Watch it back' : 'Preview'}
              </h2>
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border">
                <iframe
                  src={event.videoEmbed.embedUrl}
                  title={event.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          )}

          {/* Gallery — the categories (venue/speaker/promo/recap/sponsor) were
              on the collection from the start and never rendered. They are what
              lets ONE page be the pitch beforehand and the record afterwards:
              promo shots sell it, recap shots are why you come back. */}
          <EventGallery images={event.gallery} isPast={isPast} />

          {/* Tags */}
          {event.tags?.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {event.tags.map((t: any, i: number) => (
                <span
                  key={i}
                  className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {t.tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — Registration */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-lg border border-border bg-card p-6">
            <div className="mb-4 text-center">
              <p className="text-2xl font-bold">
                {registrationCount.totalDocs}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPast
                  ? 'Attended'
                  : registrationCount.totalDocs === 1
                    ? 'Attendee'
                    : 'Attendees'}
                {!isPast && capacity > 0 && ` / ${capacity}`}
              </p>
            </div>

            {event.status === 'cancelled' ? (
              <div className="rounded-md bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-400">
                This event has been cancelled.
              </div>
            ) : canRegister || canWaitlist || canLateRegister ? (
              <RegisterForm
                eventId={event.id}
                eventTitle={event.title}
                isWaitlist={!!canWaitlist}
                isLateRegistration={!!canLateRegister}
                locationType={locationType}
                user={regUser}
              />
            ) : isAtCapacity && !event.capacity?.waitlistEnabled ? (
              <div className="rounded-md bg-yellow-500/10 p-4 text-center text-sm text-yellow-600 dark:text-yellow-400">
                This event is at full capacity.
              </div>
            ) : isPast ? (
              <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
                This event has finished.
              </div>
            ) : !reg.isOpen ? (
              <div className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
                Registration is closed.
              </div>
            ) : null}

            {/* Virtual link (shown to everyone for live events) */}
            {event.status === 'live' && isVirtual && event.location?.remoteLink && (
              <div className="mt-4">
                <a
                  href={event.location.remoteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-md bg-red-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-red-600"
                >
                  Join Live
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
