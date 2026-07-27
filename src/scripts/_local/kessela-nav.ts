/**
 * Mirror Kessela's own navigation.
 *
 * Their bar is: How to Use the Belt · Results & Testimonials · Studies & Blog ·
 * Buy Kessela Now!  Ours showed "HOME" and "MORE", because the menu DERIVES
 * itself from what the endeavor has and the seeded header is deliberately just
 * Home — everything else collapsed past the inline cap.
 *
 * This is exactly what the override layer is for: derivation can't know an
 * owner's intent about ORDER and PROMINENCE. So pin their four, raise the
 * inline cap to fit them, and hide the platform routes a product site shouldn't
 * advertise.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-nav.ts
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
  where: { slug: { equals: 'kessela' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) {
  console.error('No kessela tenant.')
  process.exit(1)
}

/** Their bar, in their order. */
const NAV = [
  navLink('Home', '/'),
  navLink('How to Use the Belt', '/how-to-use-belt'),
  navLink('Results & Testimonials', '/results-testimonials'),
  navLink('Studies & Blog', '/studies-blog'),
  navLink('Buy Kessela Now!', '/buy-kessela-now'),
]

// ── The header document ─────────────────────────────────────────────────────
const headers = await payload.find({
  collection: 'header',
  where: { tenant: { equals: tenantId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const header = headers.docs?.[0] as { id: number } | undefined

if (header) {
  await update({
    collection: 'header',
    id: header.id,
    data: { navItems: NAV },
    overrideAccess: true,
  })
  console.log(`header: ${NAV.length} items set`)
} else {
  await create({
    collection: 'header',
    data: { tenant: tenantId, navItems: NAV },
    overrideAccess: true,
  })
  console.log(`header: created with ${NAV.length} items`)
}

// ── The footer: their utility links ─────────────────────────────────────────
const FOOTER = [
  navLink('Shipping & Delivery', '/shipping-delivery'),
  navLink('Refund & Returns', '/refund-returns'),
  navLink('Warranty & Claims', '/warranty'),
  navLink('Contact Us', '/contact'),
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
  await update({
    collection: 'footer',
    id: footer.id,
    data: { navItems: FOOTER },
    overrideAccess: true,
  })
  console.log(`footer: ${FOOTER.length} items set`)
}

// ── Overrides: pin their bar, hide what a product site shouldn't advertise ──
await setNavOverrides(payload, tenantId, {
  pinned: NAV.map((n) => n.link.url),
  // Learn/Works are platform-wide mission content; a corporate product site
  // shouldn't carry them in its primary bar.
  hidden: ['/learn', '/works', '/federation/discover'],
  // Five links fit comfortably; the default cap is what pushed them into "More".
  maxInline: 6,
})
console.log('overrides: pinned 5, hid 3, maxInline 6')

console.log('\nDone. https://kessela.spacesangels.com')
process.exit(0)
