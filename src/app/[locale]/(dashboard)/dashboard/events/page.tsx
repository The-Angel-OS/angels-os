import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export default async function DashboardEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

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
      ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
    },
    limit: 100,
    depth: 1,
    sort: '-startDateTime',
    overrideAccess: true,
  })

  const liveEvents = events.docs.filter((e: any) => e.status === 'live')
  const upcomingEvents = events.docs.filter((e: any) => e.status === 'upcoming')
  const draftEvents = events.docs.filter((e: any) => e.status === 'draft')
  const pastEvents = events.docs.filter(
    (e: any) => e.status === 'completed' || e.status === 'cancelled',
  )

  const statusColors: Record<string, string> = {
    live: 'bg-red-500 text-white',
    upcoming: 'bg-blue-500 text-white',
    draft: 'bg-yellow-500 text-black',
    completed: 'bg-gray-500 text-white',
    cancelled: 'bg-red-800 text-white',
  }

  const typeEmojis: Record<string, string> = {
    meetup: '🤝',
    workshop: '🔧',
    livestream: '📺',
    conference: '🎤',
    screening: '🎬',
    custom: '📅',
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">
            {events.totalDocs} event{events.totalDocs !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/collections/events/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Event
        </Link>
      </div>

      {events.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="mb-2 text-lg font-medium">No events yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first event to start engaging your community.
          </p>
          <Link
            href="/admin/collections/events/create"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {liveEvents.length > 0 && (
            <EventGroup
              title="Live Now"
              events={liveEvents}
              statusColors={statusColors}
              typeEmojis={typeEmojis}
            />
          )}
          {upcomingEvents.length > 0 && (
            <EventGroup
              title="Upcoming"
              events={upcomingEvents}
              statusColors={statusColors}
              typeEmojis={typeEmojis}
            />
          )}
          {draftEvents.length > 0 && (
            <EventGroup
              title="Drafts"
              events={draftEvents}
              statusColors={statusColors}
              typeEmojis={typeEmojis}
            />
          )}
          {pastEvents.length > 0 && (
            <EventGroup
              title="Past"
              events={pastEvents}
              statusColors={statusColors}
              typeEmojis={typeEmojis}
            />
          )}
        </div>
      )}
    </div>
  )
}

function EventGroup({
  title,
  events,
  statusColors,
  typeEmojis,
}: {
  title: string
  events: any[]
  statusColors: Record<string, string>
  typeEmojis: Record<string, string>
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title} ({events.length})
      </h2>
      <div className="space-y-2">
        {events.map((event: any) => {
          const startDate = new Date(event.startDateTime)
          const hostName =
            typeof event.host === 'object'
              ? event.host?.name || event.host?.email
              : null

          return (
            <Link
              key={event.id}
              href={`/admin/collections/events/${event.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                {typeEmojis[event.eventType] || '📅'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{event.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[event.status] || 'bg-gray-500 text-white'}`}
                  >
                    {event.status === 'live' ? 'LIVE' : event.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
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
                  {hostName && ` · ${hostName}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">
                  {event.eventType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.location?.type || 'in-person'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
