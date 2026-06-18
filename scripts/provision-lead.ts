/**
 * Generalized lead → draft site provisioner. Stands up a complete branded draft
 * endeavor on the kendev.co commercial Diocese from a SPEC built off a Craigslist
 * ad (the Arctic Cool pattern, parameterized). Additive/findOrCreate — safe.
 *
 * Usage: PAYLOAD_SKIP_PUSH=true PAYLOAD_DISABLE_DEPENDENCY_CHECKER=true pnpm tsx scripts/provision-lead.ts
 * Swap the SPEC for the next lead.
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

// ─────────────────────────────────────────────────────────────────────────────
const SPEC = {
  name: "Doc's Moving",
  slug: 'docs-moving',
  tagline: 'Professional Hourly Muscle — local & long-distance movers across Tampa Bay.',
  description:
    "Doc's Moving — professional hourly muscle for local and long-distance moves across Tampa, Clearwater, St. Pete, Sarasota and all of Hillsborough, Pinellas & Pasco. Residential and commercial moves, clean-outs, junk removal, and specialty items (pianos, gun safes, hot tubs). Fully insured, no hidden fees, no deposit. Whether it's a 1-bedroom studio or an 8-bedroom ranch — consider your job done. Call or text for a quote: 727-807-0800.",
  phone: '727-807-0800',
  address: 'Tampa Bay, FL',
  region: 'Tampa Bay, FL',
  operator: { name: "Doc's Moving", email: 'kenneth@kendev.co', role: 'owner' },
  bookingType: 'service' as const,
  pricingModel: 'hourly' as const, // "Professional Hourly Muscle"
  heroH2: "Moving day? Consider it done.",
  intro:
    'Professional hourly muscle for local and long-distance moves across Tampa Bay. Fully insured, no hidden fees, no deposit — from a 1-bedroom studio to an 8-bedroom ranch.',
  servicesHeading: 'What We Move',
  whyHeading: 'Why Doc’s',
  why: ['Fully Insured', 'No Hidden Fees — No Deposit', 'Local & Long-Distance', 'Same Pros, Every Job', 'Cash / Zelle / Venmo / CashApp'],
  cta: 'Call or text for a quote: 727-807-0800 (or 813-409-5297).',
  services: [
    { serviceId: 'residential-moving', label: 'Residential Moving', desc: 'Homes and apartments, local or long-distance — packed, carried, and placed with care.' },
    { serviceId: 'commercial-moving', label: 'Commercial Moving', desc: 'Offices and businesses moved efficiently with minimal downtime.' },
    { serviceId: 'clean-outs', label: 'Clean Outs', desc: 'Full property clean-outs — fast and thorough.' },
    { serviceId: 'junk-removal', label: 'Junk Removal', desc: 'Haul-away and disposal of unwanted items.' },
    { serviceId: 'disassemble-reassemble', label: 'Disassemble & Reassemble', desc: 'Furniture and beds taken apart and rebuilt at the destination.' },
    { serviceId: 'specialty-moves', label: 'Specialty Moves — Pianos, Gun Safes, Hot Tubs', desc: 'Heavy and high-value specialty items moved by experienced pros.' },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

const txt = (t: string, bold = false) => ({ type: 'text', detail: 0, format: bold ? 1 : 0, mode: 'normal', style: '', text: t, version: 1 })
const para = (...n: any[]) => ({ type: 'paragraph', children: n, direction: 'ltr', format: '', indent: 0, version: 1 })
const heading = (tag: string, t: string) => ({ type: 'heading', tag, children: [txt(t)], direction: 'ltr', format: '', indent: 0, version: 1 })
const list = (items: string[]) => ({ type: 'list', listType: 'bullet', tag: 'ul', start: 1, direction: 'ltr', format: '', indent: 0, version: 1, children: items.map((t, i) => ({ type: 'listitem', value: i + 1, direction: 'ltr', format: '', indent: 0, version: 1, children: [txt(t)] })) })
const homeRichText = () => ({
  root: {
    type: 'root', direction: 'ltr', format: '', indent: 0, version: 1,
    children: [
      heading('h2', SPEC.heroH2),
      para(txt(SPEC.intro)),
      heading('h3', SPEC.servicesHeading),
      list(SPEC.services.map((s) => s.label)),
      heading('h3', SPEC.whyHeading),
      list(SPEC.why),
      para(txt(SPEC.cta, true)),
    ],
  },
})

async function main() {
  const payload = await getPayload({ config })
  const req = { payload } as any
  console.log(`\n═══ Provisioning lead: ${SPEC.name} (${SPEC.slug}) ═══\n`)

  const tenant = await findOrCreateTenant(payload, req, {
    name: SPEC.name, slug: SPEC.slug, domain: `${SPEC.slug}.kendev.co`, type: 'tenant',
    branding: { siteName: SPEC.name, tagline: SPEC.tagline },
  })
  const tenantId = tenant.id as number
  console.log(`✓ Tenant id=${tenantId}`)

  await payload.update({
    collection: 'tenants', id: tenantId,
    data: { status: 'active', businessType: 'service', domain: `${SPEC.slug}.kendev.co`,
      domains: [{ domain: `${SPEC.slug}.kendev.co` }],
      storefront: { description: SPEC.description, contact: { email: SPEC.operator.email, phone: SPEC.phone, address: SPEC.address } } } as any,
    overrideAccess: true,
  })

  const { spaceId } = await createSpaceFromTemplate(payload, 'service-provider', tenantId, `${SPEC.name} HQ`, req)
  console.log(`✓ Space id=${spaceId}`)

  try { await createDefaultTenantPages(payload, tenantId, { siteName: SPEC.name, tagline: SPEC.tagline }); console.log('✓ Pages') } catch (e) { console.warn('⚠ pages', e) }
  try { await createDefaultTenantNavigation(payload, tenantId); console.log('✓ Nav') } catch (e) { console.warn('⚠ nav', e) }

  await findOrCreateSystemAgent(payload, req, { tenantId, tenantSlug: SPEC.slug, agentType: 'leo', displayName: 'Nimue', personality: 'Friendly, dependable dispatcher who books a crew fast.' })
  console.log('✓ LEO')

  try {
    const ex = await payload.find({ collection: 'endeavors', where: { tenant: { equals: tenantId } }, limit: 1, overrideAccess: true })
    if (ex.docs.length === 0) {
      await payload.create({ collection: 'endeavors', data: { name: SPEC.name, endeavorType: 'service-provider', tagline: SPEC.tagline, description: SPEC.description, status: 'active', region: SPEC.region, operator: SPEC.operator, federation: { networkVisible: true }, tenant: tenantId } as any, overrideAccess: true })
      console.log('✓ Endeavor')
    }
  } catch (e) { console.warn('⚠ endeavor', e) }

  const admin = await payload.find({ collection: 'users', where: { email: { equals: 'kenneth@kendev.co' } }, limit: 1, overrideAccess: true })
  if (admin.docs[0]) { await findOrCreateTenantMembership(payload, req, { userId: admin.docs[0].id, tenantId, role: 'tenant_admin' }); console.log('✓ Admin linked') }

  for (const s of SPEC.services) {
    const ex = await payload.find({ collection: 'services', where: { and: [{ tenant: { equals: tenantId } }, { serviceId: { equals: s.serviceId } }] }, limit: 1, overrideAccess: true })
    if (ex.docs.length) continue
    await payload.create({ collection: 'services', data: { tenant: tenantId, serviceId: s.serviceId, label: s.label, description: s.desc, bookingType: SPEC.bookingType, pricingModel: SPEC.pricingModel, hourlyRateUsd: 0, priceUsd: 0, depositPercent: 0, durationMinutes: 120, allowsExtraCosts: true, enabled: true } as any, overrideAccess: true })
    console.log('  ✓ Service:', s.label)
  }

  // Home content + meta
  const pages = await payload.find({ collection: 'pages', where: { and: [{ tenant: { equals: tenantId } }, { title: { equals: 'Home' } }] }, limit: 1, depth: 0, overrideAccess: true })
  const p = pages.docs[0] as any
  if (p) {
    let done = false
    const layout = (p.layout || []).map((b: any) => {
      if (!done && b.blockType === 'content' && b.columns?.[0]) { done = true; return { ...b, columns: b.columns.map((c: any, i: number) => (i === 0 ? { ...c, richText: homeRichText() } : c)) } }
      return b
    })
    await payload.update({ collection: 'pages', id: p.id, data: { layout, meta: { ...(p.meta || {}), title: `${SPEC.name} — ${SPEC.tagline}`, description: SPEC.tagline } } as any, overrideAccess: true })
    console.log('✓ Home content + meta')
  }

  console.log(`\n═══ Done. https://${SPEC.slug}.kendev.co ═══\n`)
  process.exit(0)
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
