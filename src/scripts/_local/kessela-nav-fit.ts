/**
 * Make the Kessela top bar FIT.
 *
 * Five full-length items plus an auto-injected Posts link ran off the right edge
 * and collided with the cart and avatar. The reference site carries four; we were
 * carrying six, two of which are reachable from the body copy of every page and
 * from the footer's Explore column.
 *
 * Nothing here is new machinery — labels on the Header doc, and the nav-overrides
 * bag that already supports hidden / pinned / maxInline / hideMore.
 *
 * Kept: Home (obviously) · How to Use · Buy Kessela Now! (the one that takes money).
 * Dropped from the BAR only: Results & Testimonials and Studies & Blog — both are
 * linked in the page copy and both stay in the footer, so nothing becomes
 * unreachable. Posts is hidden outright: it's the raw collection listing, and
 * Studies & Blog is the curated version of the same thing.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-nav-fit.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { setNavOverrides } from '@/utilities/navOverrides'

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'kessela' } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('No kessela tenant.')

const link = (label: string, url: string) => ({
  link: { type: 'custom' as const, label, url, newTab: false },
})

const header = await payload.find({
  collection: 'header', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true,
})
const headerId = (header.docs[0] as { id: number } | undefined)?.id
if (!headerId) throw new Error('No kessela header.')

await payload.update({
  collection: 'header',
  id: headerId,
  // "How to Use the Belt" is the longest label on the bar and the word "Belt" is
  // doing no work next to a logo that says KESSELA over a picture of one.
  data: { navItems: [link('How to Use', '/how-to-use-belt'), link('Buy Kessela Now!', '/buy-kessela-now')] } as never,
  overrideAccess: true,
})

const overrides = await setNavOverrides(payload, tenantId, {
  hidden: ['/posts'],
  pinned: ['/buy-kessela-now'],
  maxInline: 3,
  hideMore: true,
})

console.log('header navItems: How to Use · Buy Kessela Now! (Home is implicit)')
console.log('nav overrides:', JSON.stringify(overrides))
