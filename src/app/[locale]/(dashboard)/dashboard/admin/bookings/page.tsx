import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BookingsAdmin } from './BookingsAdmin'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

export default async function DashboardBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant (cached)
  const { tenantFilter } = await resolveTenantFromHeaders()
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant: any = tenantSlug ? await fetchTenantBySlug(tenantSlug) : null

  // Fetch existing availability slots
  let availabilitySlots: Array<{
    id: string
    title: string
    availabilityType: string
    dayOfWeek?: string
    startTime?: string
    endTime?: string
    slotDuration: number
    isActive: boolean
  }> = []

  try {
    const avResult = await payload.find({
      collection: 'availability',
      where: tenantFilter,
      limit: 50,
      sort: 'createdAt',
      depth: 0,
      overrideAccess: true,
    })
    availabilitySlots = avResult.docs.map((doc: any) => ({
      id: String(doc.id),
      title: doc.title || 'Untitled Slot',
      availabilityType: doc.availabilityType || 'weekly',
      dayOfWeek: doc.weeklySchedule?.dayOfWeek || undefined,
      startTime: doc.weeklySchedule?.startTime || doc.dateRange?.startTime || undefined,
      endTime: doc.weeklySchedule?.endTime || doc.dateRange?.endTime || undefined,
      slotDuration: doc.slotDuration || 60,
      isActive: doc.isActive ?? true,
    }))
  } catch {
    // Availability collection may not be populated yet
  }

  // Fetch recent bookings
  let recentBookings: Array<{
    id: string
    title: string
    bookingType: string
    status: string
    startDateTime: string
    clientName: string
  }> = []

  try {
    const bookResult = await payload.find({
      collection: 'bookings',
      where: tenantFilter,
      limit: 20,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    recentBookings = bookResult.docs.map((doc: any) => ({
      id: String(doc.id),
      title: doc.title || 'Untitled Booking',
      bookingType: doc.bookingType || 'service',
      status: doc.status || 'pending',
      startDateTime: doc.startDateTime || doc.createdAt || '',
      clientName:
        (typeof doc.client === 'object' ? doc.client?.name : '') || 'Unknown',
    }))
  } catch {
    // Bookings collection may not be populated yet
  }

  return (
    <BookingsAdmin
      availabilitySlots={availabilitySlots}
      recentBookings={recentBookings}
      tenantName={tenant?.name || 'Your Enterprise'}
    />
  )
}
