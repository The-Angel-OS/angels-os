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
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">No events scheduled yet</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Events bring your community together. Create a meetup, workshop, or livestream and watch your audience grow.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/events/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Your First Event
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;Help me plan my first community event&quot;
            </Link>
          </div>
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
              <div className="flex shrink-0 items-center gap-2 text-right">
                {event.videoEmbed?.videoUrl && (
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600" title="Has video">
                    &#x1F3AC;
                  </span>
                )}
                {Array.isArray(event.gallery) && event.gallery.length > 0 && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600" title="Gallery">
                    &#x1F5BC; {event.gallery.length}
                  </span>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {event.eventType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.location?.type || 'in-person'}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
