/**
 * Bookable services + house hours for the PayneMediaCo demo portal.
 *
 * Only ONE price here is real: $399 for a one-hour beach wedding, which Chris
 * publishes himself in his Craigslist ad. Everything else in that ad says "text
 * or call for a custom quote", so everything else here is priced at nothing and
 * booked as a REQUEST. Inventing a number for his engagement sessions would be
 * the same mistake as inventing his FAQ copy — worse, because a wrong price in
 * front of his customers is a wrong price he has to honour or walk back.
 *
 * He has no Stripe Connect, so nothing can be charged regardless: booking-checkout
 * takes a booking with no connected account as a request. That is the demo — his
 * calendar starts working before any money plumbing exists.
 *
 * Run: node_modules/.bin/payload run src/scripts/_local/book-paynemediaco.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

const t = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'paynemediaco' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = t.docs[0] as { id: number } | undefined
if (!tenant) {
  console.log('TENANT_NOT_FOUND paynemediaco')
  process.exit(1)
}
const tenantId = tenant.id

type Svc = {
  serviceId: string
  label: string
  description: string
  bookingType: 'service' | 'consultation'
  durationMinutes: number
  priceUsd?: number
  depositPercent?: number
}

const SERVICES: Svc[] = [
  {
    serviceId: 'beach-wedding-1hr',
    label: 'Beach Wedding — 1 Hour',
    description:
      'One hour of coverage for a beach ceremony. Photos delivered within a week. His published starting rate.',
    bookingType: 'service',
    durationMinutes: 60,
    priceUsd: 399,
    // A deposit only becomes a charge once Stripe Connect is on. Until then this
    // number is what the booking WOULD hold, shown honestly and collected never.
    depositPercent: 25,
  },
  {
    serviceId: 'wedding-full-day',
    label: 'Wedding — Full Day',
    description:
      'Full-day wedding coverage, photography and film. Priced per wedding — tell us the date and venue and we will send a quote.',
    bookingType: 'service',
    durationMinutes: 480,
  },
  {
    serviceId: 'engagement-session',
    label: 'Engagement Session',
    description: 'An hour or two on location before the wedding. Quoted to the session.',
    bookingType: 'service',
    durationMinutes: 120,
  },
  {
    serviceId: 'aerial-drone',
    label: 'Aerial Drone Photography & Video',
    description:
      'Licensed aerial coverage, on its own or added to a wedding or engagement booking.',
    bookingType: 'service',
    durationMinutes: 60,
  },
  {
    serviceId: 'consultation',
    label: 'Talk It Through — Free Consultation',
    description:
      'Twenty minutes about your date, your venue and what you want. No charge, no obligation.',
    bookingType: 'consultation',
    durationMinutes: 20,
  },
]

for (const s of SERVICES) {
  const existing = await payload.find({
    collection: 'services',
    where: { and: [{ serviceId: { equals: s.serviceId } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const data = {
    tenant: tenantId,
    serviceId: s.serviceId,
    label: s.label,
    description: s.description,
    bookingType: s.bookingType,
    pricingModel: 'fixed',
    ...(s.priceUsd != null ? { priceUsd: s.priceUsd } : {}),
    ...(s.depositPercent != null ? { depositPercent: s.depositPercent } : { depositPercent: 0 }),
    durationMinutes: s.durationMinutes,
    enabled: true,
  }
  const doc = existing.docs[0] as { id: number | string } | undefined
  if (doc) {
    await (payload.update as never as (a: unknown) => Promise<unknown>)({
      collection: 'services', id: doc.id, data, overrideAccess: true,
    })
    console.log('SERVICE updated', s.serviceId, s.priceUsd != null ? `$${s.priceUsd}` : 'quote')
  } else {
    await (payload.create as never as (a: unknown) => Promise<unknown>)({
      collection: 'services', data, overrideAccess: true,
    })
    console.log('SERVICE created', s.serviceId, s.priceUsd != null ? `$${s.priceUsd}` : 'quote')
  }
}

// House hours — no `provider`. A sole proprietor IS the business, and this portal
// has no claimed owner yet; requiring a named provider is exactly what used to
// ship prospect demos with a dead /book page.
//
// Wide on purpose. A wedding photographer works when weddings happen, which is
// evenings and weekends, and a demo that offers Tuesday 9-to-5 looks like an
// accountant's calendar.
const HOURS: Array<{ day: string; start: string; end: string }> = [
  { day: '0', start: '09:00', end: '20:00' },
  { day: '1', start: '10:00', end: '19:00' },
  { day: '2', start: '10:00', end: '19:00' },
  { day: '3', start: '10:00', end: '19:00' },
  { day: '4', start: '10:00', end: '19:00' },
  { day: '5', start: '09:00', end: '21:00' },
  { day: '6', start: '08:00', end: '21:00' },
]

// `weeklySchedule` is a GROUP, not an array — one Availability document holds one
// day. Seven days means seven rows, which is also why the collection's admin
// columns are `dayOfWeek, startTime, endTime` rather than a schedule summary.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

for (const h of HOURS) {
  const title = `Studio Hours — ${DAY_NAMES[Number(h.day)]}`
  const existingAv = await payload.find({
    collection: 'availability',
    where: { and: [{ title: { equals: title } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const avData = {
    tenant: tenantId,
    title,
    availabilityType: 'weekly',
    weeklySchedule: { dayOfWeek: h.day, startTime: h.start, endTime: h.end },
    slotDuration: 60,
    capacity: 1,
    bufferTime: 30,
    minAdvanceBooking: 24,
    maxAdvanceBooking: 365,
    serviceTypes: [{ serviceType: 'service' }, { serviceType: 'consultation' }],
    isActive: true,
  }
  const av = existingAv.docs[0] as { id: number | string } | undefined
  if (av) {
    await (payload.update as never as (a: unknown) => Promise<unknown>)({
      collection: 'availability', id: av.id, data: avData, overrideAccess: true,
    })
    console.log('AVAILABILITY updated', title)
  } else {
    await (payload.create as never as (a: unknown) => Promise<unknown>)({
      collection: 'availability', data: avData, overrideAccess: true,
    })
    console.log('AVAILABILITY created', title)
  }
}

console.log('DONE https://paynemediaco.spacesangels.com/book')
process.exit(0)
