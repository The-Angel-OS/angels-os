import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BookingPage } from './BookingPage'

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

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any = null

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = tenants.docs?.[0]
  }
  if (!tenant) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = defaults.docs?.[0]
  }

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
        isActive: { equals: true },
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
      where: {
        ...(tenant?.id ? { tenant: { equals: tenant.id } } : {}),
      },
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
