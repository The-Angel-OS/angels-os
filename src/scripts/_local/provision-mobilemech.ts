/**
 * One-off: stand up the Mobile Mechanic prospect portal + service slate.
 * Reachable at mobilmech1.payloadnuke.com. Idempotent.
 * Run in container: node_modules/.bin/payload run src/scripts/_local/provision-mobilemech.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { provisionPortal } from '@/utilities/provisionPortal'

const payload = await getPayload({ config })

const result = await provisionPortal(
  payload,
  {
    name: 'Mobile Mechanic',
    slug: 'mobilmech1',
    domain: 'mobilmech1.payloadnuke.com',
    endeavorType: 'service-provider',
    type: 'business',
    tagline: 'Honest Service. Fair Prices. We Come to You!',
    description:
      'Mobile Mechanic — we bring the shop to you. Diagnostics, brakes, AC, starters & more. Serving Pasco, Pinellas & Hernando Counties. Call/text 727-707-3450.',
    primaryColor: '#1D4ED8',
    secondaryColor: '#F59E0B',
  },
  { actingUserId: 3 },
)
console.log('PROVISIONED', JSON.stringify({ id: result.tenant.id, slug: result.tenant.slug, url: result.url }))

// Service slate — prices from their flyer (labor only), estimates where unlisted
const services = [
  { serviceId: 'complete-brake-job', label: 'Complete Brake Job (4 pads + 4 rotors)', priceUsd: 195, description: '4-wheel brake pads + 4 rotors. Labor only — parts priced by vehicle.' },
  { serviceId: 'front-pads-only', label: 'Front Brake Pads Only', priceUsd: 99, description: 'Front pads replacement. Labor only.' },
  { serviceId: 'ac-compressor', label: 'A/C Compressor Replacement + Recharge', priceUsd: 300, description: 'Compressor replacement with recharge. Labor only.' },
  { serviceId: 'ac-recharge', label: 'A/C Recharge', priceUsd: 99, description: 'A/C system recharge and performance check.' },
  { serviceId: 'radiator-replacement', label: 'Radiator Replacement', priceUsd: 175, description: 'Radiator replacement, includes coolant bleed. Labor only.' },
  { serviceId: 'starter-replacement', label: 'Starter Replacement', priceUsd: 150, description: 'Starter replacement. Labor only.' },
  { serviceId: 'alternator-replacement', label: 'Alternator Replacement', priceUsd: 150, description: 'Alternator replacement. Labor only.' },
  { serviceId: 'battery-replacement', label: 'Battery Replacement', priceUsd: 49, description: 'Battery test and replacement at your location.' },
  { serviceId: 'pre-purchase-inspection', label: 'Pre-Purchase Vehicle Inspection', priceUsd: 99, description: 'Full inspection before you buy. Starting at — may vary by vehicle.' },
  { serviceId: 'diagnostics', label: 'Check Engine / No-Start Diagnostics', priceUsd: 89, description: 'Professional scanner diagnosis of check-engine lights and no-start conditions.' },
  { serviceId: 'water-pump-thermostat', label: 'Water Pump / Thermostat Replacement', priceUsd: 175, description: 'Cooling system repair. Labor only — quoted by vehicle.' },
  { serviceId: 'suspension-steering', label: 'Suspension & Steering Repair', pricingModel: 'hourly' as const, hourlyRateUsd: 95, description: 'Shocks, struts, tie rods, control arms — quoted after inspection.' },
  { serviceId: 'tune-up', label: 'Tune-Up', priceUsd: 120, description: 'Plugs, filters, fluids check. Labor only.' },
  { serviceId: 'mobile-service-call', label: 'Mobile Service Call / General Labor', pricingModel: 'hourly' as const, hourlyRateUsd: 95, description: 'We come to your home, work, or roadside. All makes & models — domestic, foreign, import.' },
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

console.log('DONE — https://mobilmech1.payloadnuke.com (login = text auth, no email needed)')
process.exit(0)
