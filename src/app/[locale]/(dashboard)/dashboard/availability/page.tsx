import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardAvailabilityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const availability = await payload.find({
    collection: 'availability',
    where: tenantFilter,
    limit: 100,
    depth: 1,
    sort: 'dayOfWeek',
    overrideAccess: true,
  })

  const dayLabels: Record<string, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  }

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  // Group by provider
  const byProvider: Record<string, { name: string; slots: any[] }> = {}
  for (const slot of availability.docs as any[]) {
    const providerName =
      typeof slot.provider === 'object'
        ? slot.provider?.name || slot.provider?.email || 'Unknown'
        : 'Unknown'
    const providerId =
      typeof slot.provider === 'object' ? String(slot.provider?.id) : String(slot.provider)
    if (!byProvider[providerId]) {
      byProvider[providerId] = { name: providerName, slots: [] }
    }
    byProvider[providerId].slots.push(slot)
  }

  // Sort slots within each provider by day
  for (const provider of Object.values(byProvider)) {
    provider.slots.sort(
      (a: any, b: any) =>
        dayOrder.indexOf(a.dayOfWeek || '') - dayOrder.indexOf(b.dayOfWeek || ''),
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Availability</h1>
          <p className="text-sm text-muted-foreground">
            {availability.totalDocs} schedule{availability.totalDocs !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Link
          href="/admin/collections/availability/create?returnTo=/dashboard/availability&returnLabel=Availability"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Schedule
        </Link>
      </div>

      {availability.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="mb-2 text-lg font-medium">No availability set</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Configure your weekly schedule so clients can book appointments.
          </p>
          <Link
            href="/admin/collections/availability/create?returnTo=/dashboard/availability&returnLabel=Availability"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Set Availability
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byProvider).map(([providerId, { name, slots }]) => (
            <section key={providerId}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {name}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {slots.map((slot: any) => (
                  <Link
                    key={slot.id}
                    href={`/admin/collections/availability/${slot.id}?returnTo=/dashboard/availability&returnLabel=Availability`}
                    className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {dayLabels[slot.dayOfWeek] || slot.dayOfWeek}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          slot.isActive !== false
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-400 text-white'
                        }`}
                      >
                        {slot.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {slot.startTime || '09:00'} &ndash; {slot.endTime || '17:00'}
                    </p>
                    {slot.slotDuration && (
                      <p className="text-xs text-muted-foreground">{slot.slotDuration} min slots</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
