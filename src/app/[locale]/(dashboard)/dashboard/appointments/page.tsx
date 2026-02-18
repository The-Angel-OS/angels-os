import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export default async function DashboardAppointmentsPage({
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

  // Fetch bookings sorted by start time
  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
    },
    limit: 100,
    depth: 2,
    sort: 'startDateTime',
    overrideAccess: true,
  })

  // Group by relative date
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const nextWeek = new Date(today.getTime() + 7 * 86400000)

  const todayBookings: any[] = []
  const tomorrowBookings: any[] = []
  const thisWeekBookings: any[] = []
  const laterBookings: any[] = []
  const pastBookings: any[] = []

  for (const booking of bookings.docs as any[]) {
    const start = new Date(booking.startDateTime)
    if (start < today) {
      pastBookings.push(booking)
    } else if (start < tomorrow) {
      todayBookings.push(booking)
    } else if (start < new Date(tomorrow.getTime() + 86400000)) {
      tomorrowBookings.push(booking)
    } else if (start < nextWeek) {
      thisWeekBookings.push(booking)
    } else {
      laterBookings.push(booking)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500 text-black',
    confirmed: 'bg-green-500 text-white',
    'in-progress': 'bg-blue-500 text-white',
    completed: 'bg-gray-500 text-white',
    cancelled: 'bg-red-500 text-white',
    'no-show': 'bg-red-800 text-white',
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            {bookings.totalDocs} booking{bookings.totalDocs !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/collections/availability"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Manage Availability
          </Link>
          <Link
            href="/admin/collections/bookings/create"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Booking
          </Link>
        </div>
      </div>

      {bookings.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="mb-2 text-lg font-medium">No appointments yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Set up your availability and start accepting bookings.
          </p>
          <Link
            href="/admin/collections/availability"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Set Availability
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {todayBookings.length > 0 && (
            <BookingGroup title="Today" bookings={todayBookings} statusColors={statusColors} />
          )}
          {tomorrowBookings.length > 0 && (
            <BookingGroup
              title="Tomorrow"
              bookings={tomorrowBookings}
              statusColors={statusColors}
            />
          )}
          {thisWeekBookings.length > 0 && (
            <BookingGroup
              title="This Week"
              bookings={thisWeekBookings}
              statusColors={statusColors}
            />
          )}
          {laterBookings.length > 0 && (
            <BookingGroup title="Later" bookings={laterBookings} statusColors={statusColors} />
          )}
          {pastBookings.length > 0 && (
            <BookingGroup title="Past" bookings={pastBookings} statusColors={statusColors} />
          )}
        </div>
      )}
    </div>
  )
}

function BookingGroup({
  title,
  bookings,
  statusColors,
}: {
  title: string
  bookings: any[]
  statusColors: Record<string, string>
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title} ({bookings.length})
      </h2>
      <div className="space-y-2">
        {bookings.map((booking: any) => {
          const start = new Date(booking.startDateTime)
          const clientName =
            typeof booking.client === 'object'
              ? booking.client?.name || booking.client?.email
              : 'Unknown'
          const providerName =
            typeof booking.provider === 'object'
              ? booking.provider?.name || booking.provider?.email
              : null
          const productTitle =
            typeof booking.product === 'object' ? booking.product?.title : null

          return (
            <Link
              key={booking.id}
              href={`/admin/collections/bookings/${booking.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold">
                {start.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    {productTitle || booking.title || 'Appointment'}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[booking.status] || 'bg-gray-500 text-white'}`}
                  >
                    {booking.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {clientName}
                  {providerName && ` with ${providerName}`}
                  {' · '}
                  {start.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                {booking.duration && <p>{booking.duration} min</p>}
                {booking.location?.type && <p>{booking.location.type}</p>}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
