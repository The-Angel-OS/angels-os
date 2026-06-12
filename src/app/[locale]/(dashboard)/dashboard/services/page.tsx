import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { OfferingConfigurator, type FieldDef } from '@/components/OfferingConfigurator'

const SERVICE_FIELDS: FieldDef[] = [
  { name: 'serviceId', label: 'Service ID', type: 'text', required: true, placeholder: 'pressure-washing-driveway', help: 'Stable id used in the booking flow.' },
  { name: 'label', label: 'Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'bookingType', label: 'Type', type: 'select', options: [
    { label: 'Service', value: 'service' }, { label: 'Consultation', value: 'consultation' },
    { label: 'Rental', value: 'rental' }, { label: 'Class', value: 'class' },
    { label: 'Event', value: 'event' }, { label: 'Custom', value: 'custom' },
  ] },
  { name: 'priceUsd', label: 'Price (USD)', type: 'number', required: true },
  { name: 'depositPercent', label: 'Deposit %', type: 'number', required: true, help: 'Charged up front to reserve; balance due on completion.' },
  { name: 'durationMinutes', label: 'Duration (min)', type: 'number', required: true },
  { name: 'enabled', label: 'Show on booking page', type: 'checkbox' },
]

export default async function DashboardServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })
  const { tenantId, tenantFilter } = await resolveTenantFromHeaders()

  let items: Record<string, unknown>[] = []
  try {
    const res = await payload.find({ collection: 'services' as never, where: tenantFilter, limit: 200, depth: 0, sort: 'label', overrideAccess: true })
    items = (res.docs as Record<string, unknown>[]).map((s) => ({
      id: s.id, serviceId: s.serviceId, label: s.label, description: s.description,
      bookingType: s.bookingType, priceUsd: s.priceUsd, depositPercent: s.depositPercent,
      durationMinutes: s.durationMinutes, enabled: s.enabled,
    }))
  } catch {
    // Table may not exist yet (pre-rollout) — render the empty configurator.
  }

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="mb-1 text-2xl font-bold">Services</h1>
      <p className="mb-6 text-sm text-muted-foreground">Bookable services your customers can reserve on the /book page.</p>
      {tenantId == null ? (
        <p className="text-sm text-muted-foreground">No tenant context.</p>
      ) : (
        <OfferingConfigurator
          kind="service"
          collection="services"
          titleField="label"
          fields={SERVICE_FIELDS}
          items={items}
          tenantId={tenantId}
          newDefaults={{ bookingType: 'service', depositPercent: 20, durationMinutes: 60, enabled: true }}
        />
      )}
    </div>
  )
}
