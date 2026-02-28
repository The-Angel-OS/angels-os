import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'
import { RegisterForm } from './RegisterForm'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const events = await payload.find({
    collection: 'events',
    where: { slug: { equals: slug } },
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

  // Resolve tenant
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
    where: {
      and: [
        { slug: { equals: slug } },
        ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
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
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span>
                  {event.location?.venueName}
                  {event.location?.address && ` — ${event.location.address}`}
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

          {/* Description */}
          {event.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                {/* Rich text would need a RichText renderer; for now show a placeholder */}
                Event description available in admin.
              </p>
            </div>
          )}

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
                {registrationCount.totalDocs === 1 ? 'Attendee' : 'Attendees'}
                {capacity > 0 && ` / ${capacity}`}
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
