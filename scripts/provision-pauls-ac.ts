/**
 * Provision "Paul's A/C Repair" — an HVAC service business from a Craigslist ad —
 * as a DRAFT endeavor on the kendev.co commercial Diocese.
 *
 * Usage: PAYLOAD_SKIP_PUSH=true pnpm tsx scripts/provision-pauls-ac.ts
 *
 * Additive only (findOrCreate + existence checks) — never reseeds, preserves all
 * other tenants. Mirrors scripts/provision-stalcup.ts (the proven pattern).
 * Real data only — everything below is from the ad; license #, phone, area verbatim.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import {
  findOrCreateTenant,
  findOrCreateSystemAgent,
  findOrCreateTenantMembership,
} from '../src/endpoints/seed/seed-helpers'
import { createSpaceFromTemplate } from '../src/utilities/spaceProvisioning'
import { createDefaultTenantPages } from '../src/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '../src/utilities/createDefaultTenantNavigation'
import { buildRichText } from '../src/utilities/buildRichText'

const SPEC = {
  name: "Paul's A/C Repair",
  slug: 'pauls-ac-repair',
  domain: 'pauls-ac-repair.kendev.co',
  tagline: 'Repair, don’t replace — same-day A/C service across Tampa Bay.',
  description:
    "Air-conditioning repair specialist with 40+ years of experience. Repairs, recharges, and installs — straight-cool & heat pumps, mini-splits, all brands (except window units). $60 service call, WAIVED when we do the repair. All work warrantied. Same-day service guaranteed. FL license CAC1818479. Serving all of Hillsborough & Pinellas counties.",
  phone: '813-951-2584',
  address: '8302 Garrison Circle, Tampa, FL',
  license: 'CAC1818479',
  operator: { name: 'Paul', email: 'kenneth@kendev.co', role: 'owner' },
  region: 'Tampa Bay, FL',
  // Service catalog (products, kind=service) — the ad's real offerings.
  services: [
    { title: 'A/C Service Call', slug: 'service-call', price: 60,
      description: ['$60 diagnostic service call — WAIVED if we perform any repair. Same-day, guaranteed.'] },
    { title: 'A/C Repair', slug: 'ac-repair', price: 0,
      description: ['Expert repair of capacitors, contactors, compressors, blower motors, condensers, valves and more. Fix it for a fraction of the cost of replacement. Call for a quote.'] },
    { title: 'Refrigerant Recharge (R-22 / R-410A)', slug: 'refrigerant-recharge', price: 0,
      description: ['Leak check and refrigerant recharge — R-22 and R-410A. Call for a quote.'] },
    { title: 'System Install', slug: 'system-install', price: 0,
      description: ['New straight-cool and heat-pump installs, all major brands (Trane, Carrier, Bryant, Goodman, ICP, Tempstar). Call for a quote.'] },
    { title: 'Mini-Split Service', slug: 'mini-split-service', price: 0,
      description: ['Mini-split (ductless) repair and install. Call for a quote.'] },
  ],
}

async function main() {
  const payload = await getPayload({ config })
  const req = { payload } as any

  console.log(`\n═══ Provisioning: ${SPEC.name} (${SPEC.slug}) on kendev ═══\n`)

  // 1. Tenant
  const tenant = await findOrCreateTenant(payload, req, {
    name: SPEC.name,
    slug: SPEC.slug,
    domain: SPEC.domain,
    type: 'tenant',
    branding: { siteName: SPEC.name, tagline: SPEC.tagline },
  })
  const tenantId = tenant.id as number
  console.log(`✓ Tenant: ${tenant.name} id=${tenantId}`)

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      status: 'active',
      businessType: 'service',
      storefront: {
        description: SPEC.description,
        contact: { email: SPEC.operator.email, phone: SPEC.phone, address: SPEC.address },
      },
    } as any,
    overrideAccess: true,
  })
  console.log(`✓ Tenant configured (service business, contact, license in description)`)

  // 2. Space
  const { spaceId } = await createSpaceFromTemplate(payload, 'service-provider', tenantId, `${SPEC.name} HQ`, req)
  console.log(`✓ Space id=${spaceId}`)

  // 3. Default pages + nav
  try {
    await createDefaultTenantPages(payload, tenantId, { siteName: SPEC.name, tagline: SPEC.tagline })
    console.log(`✓ Default pages`)
  } catch (err) { console.warn(`⚠ Pages (non-fatal): ${err}`) }
  try {
    await createDefaultTenantNavigation(payload, tenantId)
    console.log(`✓ Default navigation`)
  } catch (err) { console.warn(`⚠ Nav (non-fatal): ${err}`) }

  // 4. LEO agent
  await findOrCreateSystemAgent(payload, req, {
    tenantId, tenantSlug: SPEC.slug, agentType: 'leo', displayName: 'Nimue',
    personality: 'Warm, practical, no-nonsense — a dispatcher who gets a tech to your door fast.',
  })
  console.log(`✓ LEO agent`)

  // 5. Endeavor record (network visible)
  try {
    const existing = await payload.find({ collection: 'endeavors', where: { tenant: { equals: tenantId } }, limit: 1, overrideAccess: true })
    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'endeavors',
        data: {
          name: SPEC.name,
          endeavorType: 'service-provider',
          tagline: SPEC.tagline,
          description: SPEC.description,
          status: 'active',
          region: SPEC.region,
          operator: SPEC.operator,
          federation: { networkVisible: true },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      console.log(`✓ Endeavor record (network visible)`)
    } else { console.log(`✓ Endeavor already exists`) }
  } catch (err) { console.warn(`⚠ Endeavor (non-fatal): ${err}`) }

  // 6. Link admin
  const admin = await payload.find({ collection: 'users', where: { email: { equals: 'kenneth@kendev.co' } }, limit: 1, overrideAccess: true })
  if (admin.docs[0]) {
    await findOrCreateTenantMembership(payload, req, { userId: admin.docs[0].id, tenantId, role: 'tenant_admin' })
    console.log(`✓ Admin linked as tenant_admin`)
  }

  // 7. Service catalog (products)
  for (const s of SPEC.services) {
    const existing = await payload.find({ collection: 'products', where: { slug: { equals: s.slug }, tenant: { equals: tenantId } }, limit: 1, overrideAccess: true })
    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'products',
        data: {
          title: s.title, slug: s.slug, description: buildRichText(s.description),
          price: s.price, currency: 'usd', _status: 'published', tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
      console.log(`  ✓ Service: ${s.title}`)
    }
  }

  console.log(`\n═══ Done. Draft site: https://${SPEC.domain} ═══\n`)
  process.exit(0)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
