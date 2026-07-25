/**
 * Harpazo Electric (Ron Courtney, Shepherdstown WV) — site copy + service catalog.
 *
 * Deliberately driven through executeToolCall, NOT direct payload writes: every
 * step here is a call LEO can make on its own with the same arguments. If a step
 * needs something the tools can't express, that's a missing tool, not a reason
 * to reach for the DB. Idempotent — services match by label, pages by slug.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { executeToolCall } from '@/utilities/leo-data-tools'

const payload = await getPayload({ config })
const SLUG = 'harpazo'
// Ambient ctx is deliberately NOT harpazo — proves tenantSlug is what steers it.
const ctx = { payload, userId: 3, roles: ['super_admin'] }

const call = async (tool: string, input: Record<string, unknown>) => {
  const out = await executeToolCall(tool, input, ctx)
  console.log(`${tool}: ${out.split('\n')[0]}`)
  if (/^Error/i.test(out)) console.log(out.slice(0, 300))
}

// Trading name first: generateMeta suffixes EVERY page title with branding
// siteName, so "Harpazo" alone rendered "… | Harpazo" in search results.
await call('set_portal_branding', {
  tenantSlug: SLUG,
  siteName: 'Harpazo Electric',
  tagline: 'Licensed electrical work in the WV Eastern Panhandle — permitted, inspected, done right.',
  // His mobile IS the business line, and his voicemail says to text.
  contactPhone: '+1 304-283-1259',
})

const AREA =
  'Serving Shepherdstown, Martinsburg, Charles Town, Harpers Ferry, and the WV Eastern Panhandle, plus nearby Washington County MD.'

// ── Services ────────────────────────────────────────────────────────────────
// Prices are intentionally ABSENT: Ron has not quoted any, and a wrong number
// on a live site is worse than a blank one. He sets them from the dashboard.
const services: Array<{ name: string; description: string; category: string; durationMinutes?: number }> = [
  // Residential
  { name: 'Panel Upgrade & Replacement', description: 'Service panel upgrades and replacements, 100A to 200A. Permitted and inspected.', category: 'residential', durationMinutes: 480 },
  { name: 'Outlet & Switch Installation', description: 'New outlets and switches, replacements, GFCI and AFCI protection where code requires it.', category: 'residential', durationMinutes: 120 },
  { name: 'Ceiling Fan Installation', description: 'Ceiling fan mounting and wiring, including fan-rated box replacement.', category: 'residential', durationMinutes: 120 },
  { name: 'EV Charger Installation (Level 2)', description: 'Level 2 home charger installation with the dedicated circuit and load calculation it needs.', category: 'residential', durationMinutes: 240 },
  { name: 'Smoke & CO Detector Installation', description: 'Hardwired, interconnected smoke and carbon monoxide detectors to current code.', category: 'residential', durationMinutes: 180 },
  { name: 'Whole-Home Rewiring', description: 'Full rewire for older homes — knob-and-tube or aluminum replacement, staged to keep the house livable.', category: 'residential' },
  // Light commercial
  { name: 'Code Compliance Inspection', description: 'Walkthrough and written report on code issues before an inspection, sale, or tenant turnover.', category: 'light-commercial', durationMinutes: 120 },
  { name: 'Tenant Build-Out', description: 'Electrical for tenant build-outs and remodels — circuits, lighting, data rough-in.', category: 'light-commercial' },
  { name: 'Lighting Upgrade', description: 'LED retrofits and lighting upgrades that cut the power bill and the relamping.', category: 'light-commercial' },
  { name: 'Commercial Service Upgrade', description: 'Service and panel upgrades for shops, offices, and light industrial.', category: 'light-commercial' },
  // Specialty
  { name: 'Generator Hookup & Transfer Switch', description: 'Standby and portable generator hookups with a proper transfer switch — no backfeed, no risk to line crews.', category: 'specialty', durationMinutes: 480 },
  { name: 'Landscape & Outdoor Lighting', description: 'Outdoor, landscape, and security lighting rated for the weather it lives in.', category: 'specialty', durationMinutes: 240 },
  { name: 'Smart Home Device Integration', description: 'Smart switches, thermostats, doorbells, and hubs — wired in and actually working.', category: 'specialty', durationMinutes: 180 },
  // The two that make the phone ring
  { name: 'Service Call / Diagnostic', description: 'Something not working? Flat-rate visit to find the fault and quote the fix.', category: 'residential', durationMinutes: 60 },
  { name: 'Emergency Electrical Service', description: 'No power, burning smell, sparking panel — urgent response.', category: 'residential', durationMinutes: 120 },
]

for (const s of services) {
  await call('configure_service', { ...s, tenantSlug: SLUG })
}

// ── Site copy ───────────────────────────────────────────────────────────────
await call('update_page', {
  tenantSlug: SLUG,
  pageSlug: 'services',
  title: 'Electrical Services',
  status: 'published',
  metaTitle: 'Electrician in Shepherdstown, WV',
  metaDescription:
    'Licensed electrician serving Shepherdstown, Martinsburg, and Charles Town WV. Panel upgrades, EV chargers, generator hookups, rewiring, and service calls.',
  content: [
    'Residential, light-commercial, and specialty electrical work — all to code.',
    '',
    'RESIDENTIAL',
    'Panel upgrades and replacements (100A–200A). Outlets and switch installation. Ceiling fans. Level 2 EV charger installation. Hardwired smoke and CO detectors. Whole-home rewiring for older houses.',
    '',
    'LIGHT COMMERCIAL',
    'Code compliance inspections. Tenant build-outs. Lighting and LED upgrades. Service upgrades.',
    '',
    'SPECIALTY',
    'Generator hookups and transfer switches. Landscape and outdoor lighting. Smart home device integration.',
    '',
    `Licensed and insured. All work to code. ${AREA}`,
  ].join('\n'),
})

await call('update_page', {
  tenantSlug: SLUG,
  pageSlug: 'home',
  title: 'Harpazo Electric',
  status: 'published',
  metaTitle: 'Harpazo Electric — Licensed Electrician, Shepherdstown WV',
  metaDescription:
    'Ron Courtney, licensed electrician in the WV Eastern Panhandle. Panel upgrades, EV charger installation, generator hookups, rewiring. Permitted and inspected.',
  content: [
    'Licensed electrical work in the Eastern Panhandle — done right, permitted, and inspected.',
    '',
    'Panel upgrades, EV chargers, generator hookups, rewiring, and the service call you need today. Residential and light commercial.',
    '',
    AREA,
    '',
    'Book online, or text 304-283-1259 and talk to the person who will actually do the work.',
  ].join('\n'),
})

const t = await payload.find({ collection: 'tenants', where: { slug: { equals: SLUG } }, limit: 1, depth: 0, overrideAccess: true })
const tenantId = Number((t.docs[0] as { id: number }).id)
const svc = await payload.count({ collection: 'services', where: { tenant: { equals: tenantId } }, overrideAccess: true })
console.log(`\nharpazo services: ${svc.totalDocs}`)

// The three pages that still carried the old Clearwater FL positioning.
await call('update_page', {
  tenantSlug: SLUG,
  pageSlug: 'about',
  title: 'About',
  status: 'published',
  metaTitle: 'About Ron Courtney — Licensed Electrician, Shepherdstown WV',
  metaDescription: `Ron Courtney, licensed electrician. ${AREA}`,
  content: [
    "Harpazo Electric is Ron Courtney — a licensed electrician working out of Shepherdstown, West Virginia.",
    '',
    'You get the person who does the work. No dispatcher, no rotating crew, no quote from someone who never sees the job. Panels, rewiring, generators, EV chargers, and the service call that can’t wait until next week.',
    '',
    'Every job is permitted and inspected where code requires it. That is not a selling point, it is the job.',
    '',
    AREA,
  ].join('\n'),
})

await call('update_page', {
  tenantSlug: SLUG,
  pageSlug: 'book',
  title: 'Book an Electrician',
  status: 'published',
  metaTitle: 'Book an Electrician — Shepherdstown, WV',
  metaDescription: `Book licensed electrical work online. ${AREA}`,
  content: [
    'Pick a service and a time that works. You will get a confirmation, and Ron will call if anything about the job needs sorting out first.',
    '',
    'Not sure what you need? Book the Service Call / Diagnostic and we will figure it out on site.',
    '',
    AREA,
  ].join('\n'),
})

await call('update_page', {
  tenantSlug: SLUG,
  pageSlug: 'contact',
  title: 'Contact',
  status: 'published',
  metaTitle: 'Contact Harpazo Electric — Shepherdstown, WV',
  metaDescription: `Get in touch about electrical work. ${AREA}`,
  content: [
    'Text 304-283-1259 — that is the fastest way to reach Ron, and the way he prefers.',
    '',
    'Call the same number if you would rather talk, or send a message here and he will get back to you.',
    '',
    'For anything urgent — no power, a burning smell, a sparking panel — call, do not text.',
    '',
    AREA,
  ].join('\n'),
})
