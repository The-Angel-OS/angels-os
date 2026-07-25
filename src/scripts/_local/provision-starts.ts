/**
 * One-off: stand up the Start-S Mobile Auto Mechanic (Vlad) portal + service slate.
 * Reachable at start-s.payloadnuke.com. Idempotent.
 * Run in container: node_modules/.bin/payload run src/scripts/_local/provision-starts.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { provisionPortal } from '@/utilities/provisionPortal'

const payload = await getPayload({ config })

const result = await provisionPortal(
  payload,
  {
    name: 'Start-S Mobile Auto Mechanic',
    slug: 'start-s',
    domain: 'start-s.payloadnuke.com',
    endeavorType: 'service-provider',
    type: 'business',
    tagline: 'Honesty & Integrity · Quality & Reliability · Care & Warranty',
    description:
      'Mobile Auto Mechanic "Start - S" LLC — we come to you. Brakes, AC, tune-ups, starters, alternators, suspension, minor engine repairs & more. Certified by Mainstream Engineering Corporation. Text 727-339-9328 (Vlad) with your car info and what happened.',
    primaryColor: '#B91C1C',
    secondaryColor: '#111827',
  },
  { actingUserId: 3 },
)
console.log('PROVISIONED', JSON.stringify({ id: result.tenant.id, slug: result.tenant.slug, url: result.url }))

// Service slate — from Vlad's flyer; prices unlisted so hourly/quote-based estimates
const services = [
  { serviceId: 'brake-system', label: 'Brake System Repair', priceUsd: 150, description: 'Pads, rotors, calipers, lines. Labor only — parts priced by vehicle.' },
  { serviceId: 'ac-service', label: 'A/C Service & Repair', priceUsd: 120, description: 'A/C diagnosis, recharge, and component replacement.' },
  { serviceId: 'tune-up', label: 'Tune-Up', priceUsd: 120, description: 'Plugs, filters, fluids check. Labor only.' },
  { serviceId: 'water-pump', label: 'Water Pump Replacement', priceUsd: 175, description: 'Water pump replacement with coolant refill. Labor only.' },
  { serviceId: 'power-steering-pump', label: 'Power Steering Pump Replacement', priceUsd: 150, description: 'Power steering pump replacement and system bleed. Labor only.' },
  { serviceId: 'suspension', label: 'Suspension Repair', pricingModel: 'hourly' as const, hourlyRateUsd: 95, description: 'Shocks, struts, control arms — quoted after inspection.' },
  { serviceId: 'starter-replacement', label: 'Starter Replacement', priceUsd: 150, description: 'Starter replacement. Labor only.' },
  { serviceId: 'alternator-replacement', label: 'Alternator Replacement', priceUsd: 150, description: 'Alternator replacement. Labor only.' },
  { serviceId: 'oil-antifreeze', label: 'Oil & Antifreeze Change', priceUsd: 60, description: 'Oil change and antifreeze service at your location.' },
  { serviceId: 'minor-engine-repair', label: 'Minor Engine Repairs', pricingModel: 'hourly' as const, hourlyRateUsd: 95, description: 'Gaskets, timing chains & belts, oil pump, crankshaft seal — quoted after diagnosis.' },
  { serviceId: 'ignition-system', label: 'Ignition System Repair', priceUsd: 120, description: 'Coils, plugs, ignition modules. Labor only.' },
  { serviceId: 'fuel-system', label: 'Fuel System Repair', pricingModel: 'hourly' as const, hourlyRateUsd: 95, description: 'Fuel pumps, injectors, filters — quoted after diagnosis.' },
  { serviceId: 'mobile-service-call', label: 'Mobile Service Call / General Labor', pricingModel: 'hourly' as const, hourlyRateUsd: 95, description: 'We come to you. Please text 727-339-9328 with full information about your car and what happened.' },
]

for (const s of services) {
  const existing = await payload.find({
    collection: 'services',
    where: { and: [{ tenant: { equals: result.tenant.id } }, { serviceId: { equals: s.serviceId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length) {
    console.log('SERVICE exists', s.serviceId)
    continue
  }
  await payload.create({
    collection: 'services',
    data: {
      tenant: Number(result.tenant.id),
      pricingModel: 'fixed',
      bookingType: 'service',
      enabled: true,
      ...s,
    } as any,
    overrideAccess: true,
  })
  console.log('SERVICE created', s.serviceId)
}

console.log('DONE — https://start-s.payloadnuke.com — accepts Zelle, Venmo, CashApp, Apple Pay, cards, checks, cash')
process.exit(0)
