import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { OfferingConfigurator, type FieldDef } from '@/components/OfferingConfigurator'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

const SERVICE_FIELDS: FieldDef[] = [
  { name: 'serviceId', label: 'Service ID', type: 'text', required: true, placeholder: 'hourly-handyman', help: 'Stable id used in the booking flow.' },
  { name: 'label', label: 'Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'bookingType', label: 'Type', type: 'select', options: [
    { label: 'Service', value: 'service' }, { label: 'Consultation', value: 'consultation' },
    { label: 'Rental', value: 'rental' }, { label: 'Class', value: 'class' },
    { label: 'Event', value: 'event' }, { label: 'Custom', value: 'custom' },
  ] },
  { name: 'pricingModel', label: 'Pricing', type: 'select', options: [
    { label: 'Fixed price (per job)', value: 'fixed' },
    { label: 'Hourly (time on the clock)', value: 'hourly' },
    { label: 'Per unit (sq ft / window / visit)', value: 'per_unit' },
  ] },
  // Fixed
  { name: 'priceUsd', label: 'Price (USD)', type: 'number', showWhen: { field: 'pricingModel', in: ['fixed'] } },
  // Hourly — Ronald's model
  { name: 'hourlyRateUsd', label: 'Hourly rate (USD)', type: 'number', help: 'Only time actually on the clock is billed.', showWhen: { field: 'pricingModel', in: ['hourly'] } },
  { name: 'billingIncrementMinutes', label: 'Bill increment (min)', type: 'number', help: '1 = bill exact minutes; 15 = round to the quarter-hour.', showWhen: { field: 'pricingModel', in: ['hourly'] } },
  { name: 'minimumMinutes', label: 'Minimum (min)', type: 'number', help: 'Optional minimum billable time per visit.', showWhen: { field: 'pricingModel', in: ['hourly'] } },
  // Per unit
  { name: 'unitLabel', label: 'Unit', type: 'text', placeholder: 'sq ft, window, visit', showWhen: { field: 'pricingModel', in: ['per_unit'] } },
  { name: 'unitRateUsd', label: 'Price per unit (USD)', type: 'number', showWhen: { field: 'pricingModel', in: ['per_unit'] } },
  // Booking + costs
  { name: 'depositPercent', label: 'Deposit %', type: 'number', help: 'Charged up front to reserve; balance due on completion.' },
  { name: 'durationMinutes', label: 'Scheduled time (min)', type: 'number', help: 'Time held on the calendar (hourly actual can differ).' },
  { name: 'allowsExtraCosts', label: 'Allow materials / extra costs on the bill', type: 'checkbox' },
  { name: 'enabled', label: 'Show on booking page', type: 'checkbox' },
]

export default async function DashboardServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantId, tenantFilter } = await resolveTenantFromHeaders()

  let items: Record<string, unknown>[] = []
  try {
    const res = await payload.find({ collection: 'services' as never, where: tenantFilter, limit: 200, depth: 0, sort: 'label', overrideAccess: true })
    items = (res.docs as Record<string, unknown>[]).map((s) => ({
      id: s.id, serviceId: s.serviceId, label: s.label, description: s.description,
      bookingType: s.bookingType, pricingModel: s.pricingModel, priceUsd: s.priceUsd,
      hourlyRateUsd: s.hourlyRateUsd, billingIncrementMinutes: s.billingIncrementMinutes,
      minimumMinutes: s.minimumMinutes, unitLabel: s.unitLabel, unitRateUsd: s.unitRateUsd,
      allowsExtraCosts: s.allowsExtraCosts, depositPercent: s.depositPercent,
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
          newDefaults={{ bookingType: 'service', pricingModel: 'fixed', billingIncrementMinutes: 15, allowsExtraCosts: true, depositPercent: 20, durationMinutes: 60, enabled: true }}
        />
      )}
    </div>
  )
}
