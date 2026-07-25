/** One-off: replace start-s (tenant 24) services with Vlad's real 7-item price list. Idempotent. */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const t = await payload.find({ collection: 'tenants', where: { slug: { equals: 'start-s' } }, limit: 1, depth: 0, overrideAccess: true })
const tenantId = Number((t.docs[0] as { id: number }).id)

const services = [
  { serviceId: 'brake-job-complete', label: 'Complete Brake Job', priceUsd: 195, description: '4 Wheel Brake Pads + 4 Rotors. Labor only — parts not included.' },
  { serviceId: 'ac-compressor-replacement', label: 'A/C Compressor Replacement', priceUsd: 300, description: 'Includes compressor replacement + A/C Recharge. Labor only — parts not included.' },
  { serviceId: 'radiator-replacement', label: 'Radiator Replacement', priceUsd: 175, description: 'Includes Coolant Bleed. Labor only — parts not included.' },
  { serviceId: 'ac-recharge', label: 'A/C Recharge', priceUsd: 99, description: 'Standard A/C system recharge. Labor only — parts not included.' },
  { serviceId: 'starter-replacement', label: 'Starter Replacement', priceUsd: 150, description: 'Installation of new starter motor. Labor only — parts not included.' },
  { serviceId: 'front-pads-only', label: 'Front Pads Only', priceUsd: 99, description: 'Replacement of front brake pads. Labor only — parts not included.' },
  { serviceId: 'pre-purchase-inspection', label: 'Pre-Purchase Inspection', priceUsd: 99, description: 'Comprehensive inspection before purchasing a vehicle. Starting at — price may vary by vehicle.' },
]

const keep = new Set(services.map((s) => s.serviceId))
const existing = await payload.find({ collection: 'services', where: { tenant: { equals: tenantId } }, limit: 100, depth: 0, overrideAccess: true })
for (const doc of existing.docs as Array<{ id: number; serviceId?: string }>) {
  if (!keep.has(doc.serviceId || '')) {
    await payload.delete({ collection: 'services', id: doc.id, overrideAccess: true })
    console.log('removed', doc.serviceId)
  }
}

for (const s of services) {
  const found = (existing.docs as Array<{ id: number; serviceId?: string }>).find((d) => d.serviceId === s.serviceId)
  if (found) {
    await payload.update({ collection: 'services', id: found.id, data: s as any, overrideAccess: true })
    console.log('updated', s.serviceId)
  } else {
    await payload.create({
      collection: 'services',
      data: { tenant: tenantId, pricingModel: 'fixed', bookingType: 'service', enabled: true, ...s } as any,
      overrideAccess: true,
    })
    console.log('created', s.serviceId)
  }
}
console.log('DONE — 7 services on start-s')
process.exit(0)
