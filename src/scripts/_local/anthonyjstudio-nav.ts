/**
 * Anthony J Studio's navigation — modelled on kessela-nav.ts.
 *
 * Same problem, same fix: the menu DERIVES itself and the seeded header is just
 * "Home", so Galleries and Contact — the two links a photography lead-capture
 * site actually needs up front — collapsed into "More" behind platform routes.
 *
 * Pin the five CMS pages, raise the inline cap to fit them, and hide the
 * platform-wide routes (Learn / Works / Discovery) a working studio shouldn't
 * advertise. Spaces is deliberately NOT pinned: it stays available under "More"
 * rather than competing with the galleries for bar space.
 *
 * Run: pnpm payload run src/scripts/_local/anthonyjstudio-nav.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { setNavOverrides } from '@/utilities/navOverrides'
import { navLink } from '@/utilities/defaultNavItems'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'anthonyjstudio' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) {
  console.error('No anthonyjstudio tenant.')
  process.exit(1)
}

// Short labels — the bar also carries a tenant switcher, presence pill, avatar
// and cart, and Kessela's lesson was that long labels clip mid-word at ~938px.
const NAV = [
  navLink('Home', '/'),
  navLink('Galleries', '/galleries'),
  navLink('About', '/about'),
  navLink('FAQ', '/faq'),
  navLink('Contact', '/contact'),
]

const headers = await payload.find({
  collection: 'header',
  where: { tenant: { equals: tenantId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const header = headers.docs?.[0] as { id: number } | undefined

if (header) {
  await update({ collection: 'header', id: header.id, data: { navItems: NAV }, overrideAccess: true })
  console.log(`header: ${NAV.length} items set`)
} else {
  await create({ collection: 'header', data: { tenant: tenantId, navItems: NAV }, overrideAccess: true })
  console.log(`header: created with ${NAV.length} items`)
}

const FOOTER = [
  navLink('Galleries', '/galleries'),
  navLink('About the Studio', '/about'),
  navLink('FAQ', '/faq'),
  navLink('Contact', '/contact'),
]

const footers = await payload.find({
  collection: 'footer',
  where: { tenant: { equals: tenantId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const footer = footers.docs?.[0] as { id: number } | undefined
if (footer) {
  await update({ collection: 'footer', id: footer.id, data: { navItems: FOOTER }, overrideAccess: true })
  console.log(`footer: ${FOOTER.length} items set`)
}

await setNavOverrides(payload, tenantId, {
  pinned: NAV.map((n) => n.link.url),
  hidden: ['/learn', '/works', '/federation/discover'],
  // Six inline: the five pinned pages plus Posts once the shoot diaries publish.
  // Spaces lands past the cap, which is exactly where it belongs here.
  maxInline: 6,
})
console.log('overrides: pinned 5, hid 3, maxInline 6')

console.log('\nDone. https://anthonyjstudio.spacesangels.com')
process.exit(0)
