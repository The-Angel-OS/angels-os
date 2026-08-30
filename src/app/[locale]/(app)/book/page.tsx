import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BookingPage } from './BookingPage'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { resolveServices } from '@/utilities/resolveServices'
import { generateTenantRouteMeta } from '@/utilities/generateMeta'

// Tenant-branded unfurl (og:title/image/url) — a shared /book link previews as
// THIS portal, not the bare platform.
export async function generateMetadata(): Promise<Metadata> {
  return generateTenantRouteMeta({
    title: 'Book a Service',
    description: 'Schedule an appointment, consultation, or service session.',
    path: '/book',
  })
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

  // No plan gate here. Booking is free on every plan; the deposit is what's
  // monetised — see PLAN_FEE_BPS, which already prices a free portal's deposit
  // at 5%. Gating the whole page showed a stranger an upgrade pitch aimed at
  // the owner, and a portal with no Stripe simply takes the booking as a
  // REQUEST (booking-checkout.ts: `needsPayment` requires connectEnabled).

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

  // Can this business actually take money? booking-checkout has always known —
  // `needsPayment` requires connectEnabled — but the PAGE did not, so a portal
  // with no Stripe still told the customer "Deposit due now $100.00" and then
  // quietly took the booking as a request and charged nothing. The server was
  // right and the screen was lying. Same source of truth on both sides now.
  const connect = (tenant as { stripeConnect?: Record<string, unknown> } | null)?.stripeConnect
  const connectEnabled = Boolean(connect?.stripeAccountId && connect?.stripeChargesEnabled)

  // DB-first (with static fallback) so owner-configured services — incl. a
  // per-service rental/waiver agreement — drive the booking flow.
  const resolved = await resolveServices(payload, {
    tenantSlug: tenant?.slug,
    tenantId: tenant?.id,
  })
  const services = resolved.map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    priceUSD: s.priceUSD,
    depositPercent: s.depositPercent,
    depositFlatUsd: s.depositFlatUsd,
    durationMinutes: s.durationMinutes,
    pricingModel: s.pricingModel,
    hourlyRateUSD: s.hourlyRateUSD,
    minimumMinutes: s.minimumMinutes,
    serviceAgreement: s.serviceAgreement,
    imageUrl: s.imageUrl,
  }))

  return (
    <BookingPage
      availabilitySlots={availabilitySlots}
      endeavorName={endeavorName}
      services={services}
      connectEnabled={connectEnabled}
      tenantSlug={tenant?.slug ?? undefined}
      tenantId={tenant?.id ?? undefined}
      // Runtime key from the server — NEXT_PUBLIC_* is empty in a self-host Docker
      // build, which showed "Payments aren't configured" on the deposit step.
      publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
    />
  )
}
