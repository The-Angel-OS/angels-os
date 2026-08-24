/**
 * Where Did Everyone Go — the join surface.
 *
 * The portal now has a free "Reader" plan, but nothing on the site offered it:
 * two pages (Home, and Contact in draft) and a nav bar whose only member-facing
 * link was /dashboard. A plan nobody can reach is not a plan.
 *
 * So: a /join page carrying the Membership block, and two nav changes.
 *
 * Nav, and the reasoning, because it is a judgement call Ken may want to undo:
 *  - ADD "Join" — the whole point.
 *  - ADD "Community" (/spaces) — the thing being joined should be visible before
 *    you join it.
 *  - DROP "Events" — there are zero events. A link to an empty room reads worse
 *    than no link; put it back the day there is an event.
 *  - DROP "Dashboard" — a signed-in surface advertised to signed-out readers.
 *
 * Run: pnpm payload run src/scripts/_local/wdeg-join-page.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { navLink } from '@/utilities/defaultNavItems'
import { h, p, rich } from './_lexical'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'wheredideveryonego' } },
  limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('no wheredideveryonego tenant')

const layout = [
  {
    blockType: 'content',
    columns: [
      {
        size: 'full',
        richText: rich([
          p(
            'Where Did Everyone Go is a book, and the questions it asks are not the kind you finish alone. This is where the reading carries on — people working through the same chapters, at their own pace, out loud.',
          ),
          h('h3', 'What joining gets you'),
          p(
            'The community room, where the conversation happens. A note when there is something new to read. And your own place to ask the thing you have been turning over.',
          ),
          p('It is free. There is no card, and there is nothing to cancel.'),
        ]),
        enableLink: false,
      },
    ],
  },
  {
    blockType: 'membership',
    richText: rich([h('h2', 'Join the reading'), p('Pick your place and sign in — that is the whole of it.')]),
    ctaText: 'Join',
  },
]

const existing = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'join' } }] },
  limit: 1, depth: 0, overrideAccess: true, draft: true,
})

const data = {
  title: 'Join',
  slug: 'join',
  tenant: tenantId,
  _status: 'published',
  layout,
  meta: {
    title: 'Join — Where Did Everyone Go',
    description: 'Read the book alongside other people. Free to join.',
  },
}

const page = existing.docs?.[0] as { id: number } | undefined
if (page) {
  await update({ collection: 'pages', id: page.id, data, overrideAccess: true })
  console.log(`page /join updated (${page.id})`)
} else {
  const made = await create({ collection: 'pages', data, overrideAccess: true })
  console.log(`page /join created (${made.id})`)
}

const headers = await payload.find({
  collection: 'header', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true,
})
const header = headers.docs?.[0] as { id: number } | undefined
if (!header) throw new Error('no header for tenant 11')

await update({
  collection: 'header',
  id: header.id,
  data: {
    navItems: [
      navLink('Home', '/'),
      navLink('Read', '/posts'),
      navLink('Community', '/spaces'),
      navLink('Join', '/join'),
      navLink('Shop', '/shop'),
      navLink('Donate', '/donate'),
    ],
  },
  overrideAccess: true,
})
console.log('nav: Home · Read · Community · Join · Shop · Donate')
