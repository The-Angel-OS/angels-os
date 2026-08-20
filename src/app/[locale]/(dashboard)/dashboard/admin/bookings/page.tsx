import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BookingsAdmin } from './BookingsAdmin'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantFilter } = await resolveTenantFromHeaders()

  // Run both independent queries in parallel
  const [avResult, bookResult] = await Promise.all([
    payload.find({
      collection: 'availability',
      where: tenantFilter,
      limit: 50,
      sort: 'createdAt',
      depth: 0,
      overrideAccess: true,
    }).catch(() => null),
    payload.find({
      collection: 'bookings',
      where: tenantFilter,
      limit: 20,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    }).catch(() => null),
  ])

  const availabilitySlots = (avResult?.docs || []).map((doc: any) => ({
    id: String(doc.id),
    title: doc.title || 'Untitled Slot',
    availabilityType: doc.availabilityType || 'weekly',
    dayOfWeek: doc.weeklySchedule?.dayOfWeek || undefined,
    startTime: doc.weeklySchedule?.startTime || doc.dateRange?.startTime || undefined,
    endTime: doc.weeklySchedule?.endTime || doc.dateRange?.endTime || undefined,
    slotDuration: doc.slotDuration || 60,
    capacity: doc.capacity || 1,
    isActive: doc.isActive ?? true,
  }))

  const recentBookings = (bookResult?.docs || []).map((doc: any) => ({
    id: String(doc.id),
    title: doc.title || 'Untitled Booking',
    bookingType: doc.bookingType || 'service',
    status: doc.status || 'pending',
    startDateTime: doc.startDateTime || doc.createdAt || '',
    clientName:
      (typeof doc.client === 'object' ? doc.client?.name : '') || 'Unknown',
  }))

  return (
    <BookingsAdmin
      availabilitySlots={availabilitySlots}
      recentBookings={recentBookings}
      tenantName={tenant?.name || 'Your Enterprise'}
    />
  )
}
