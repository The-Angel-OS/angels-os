import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BookingPage } from './BookingPage'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getBookableServices } from '@/config/bookableServices'

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

  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantFilter } = await resolveTenantFromHeaders()

  // Run both independent queries in parallel
  const [avResult, endeavorResult] = await Promise.all([
    payload.find({
      collection: 'availability',
      where: { and: [tenantFilter, { isActive: { equals: true } }] },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null),
    payload.find({
      collection: 'endeavors',
      where: tenantFilter,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null),
  ])

  const availabilitySlots = (avResult?.docs || []).map((doc: any) => ({
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

  const endeavorName = (endeavorResult?.docs?.[0] as any)?.name || tenant?.name || 'This Enterprise'

  const services = getBookableServices(tenant?.slug).map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    priceUSD: s.priceUSD,
    depositPercent: s.depositPercent,
    durationMinutes: s.durationMinutes,
  }))

  return (
    <BookingPage
      availabilitySlots={availabilitySlots}
      endeavorName={endeavorName}
      services={services}
    />
  )
}
