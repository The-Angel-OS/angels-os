import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BookingPage } from './BookingPage'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

export const metadata = {
  title: 'Book a Service',
  description: 'Schedule an appointment, consultation, or service session.',
}

export default async function BookPage({
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

  // Fetch active availability slots
  let availabilitySlots: Array<{
    id: string
    title: string
    availabilityType: string
    dayOfWeek: number | null
    startTime: string
    endTime: string
    slotDuration: number
    bufferTime: number
    maxAdvanceBooking: number
    serviceTypes: Array<{ serviceType: string; maxConcurrent: number }>
  }> = []

  try {
    const avResult = await payload.find({
      collection: 'availability',
      where: {
        and: [tenantFilter, { isActive: { equals: true } }],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    availabilitySlots = avResult.docs.map((doc: any) => ({
      id: String(doc.id),
      title: doc.title || '',
      availabilityType: doc.availabilityType || 'weekly',
      dayOfWeek:
        doc.availabilityType === 'weekly' && doc.weeklySchedule?.dayOfWeek != null
          ? Number(doc.weeklySchedule.dayOfWeek)
          : null,
      startTime:
        doc.weeklySchedule?.startTime || doc.dateRange?.startTime || '',
      endTime:
        doc.weeklySchedule?.endTime || doc.dateRange?.endTime || '',
      slotDuration: doc.slotDuration || 60,
      bufferTime: doc.bufferTime || 0,
      maxAdvanceBooking: doc.maxAdvanceBooking || 30,
      serviceTypes: (doc.serviceTypes || []).map((st: any) => ({
        serviceType: st.serviceType || 'service',
        maxConcurrent: st.maxConcurrent || 1,
      })),
    }))
  } catch {
    // Availability collection may not exist yet
  }

  // Get the Endeavor info for context
  let endeavorName = tenant?.name || 'This Enterprise'
  try {
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: tenantFilter,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (endeavors.docs?.[0]) {
      endeavorName = (endeavors.docs[0] as any).name || endeavorName
    }
  } catch {
    // Non-critical
  }

  return (
    <BookingPage
      availabilitySlots={availabilitySlots}
      endeavorName={endeavorName}
    />
  )
}
