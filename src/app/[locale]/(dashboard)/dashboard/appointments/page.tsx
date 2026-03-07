import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
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
  const { tenantFilter } = await resolveTenantFromHeaders()

  // Fetch bookings sorted by start time
  const bookings = await payload.find({
    collection: 'bookings',
    where: tenantFilter,
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
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Your calendar is clear!</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Set your available hours and let clients book time with you. Appointments will show up here as they come in.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/availability"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Set Your Availability
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;Help me set up my booking schedule&quot;
            </Link>
          </div>
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
