/**
 * The gated briefing page for David — kessela.spacesangels.com/brief
 *
 * Written as a PAGE rather than an email on purpose: David judges on appearance
 * in seconds, hates long messages, and a link he has to sign in to reach is also
 * a live demonstration of the members-only gating we're selling him. The text
 * message points here; the page carries the detail.
 *
 * `access: 'authenticated'` — signed-in users only, and `showInNav: false` so it
 * never appears in the public menu. @see src/utilities/pageAccess.ts
 *
 * Run: pnpm payload run src/scripts/_local/kessela-brief-page.ts
 * Idempotent — matched by slug and updated.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildRichText } from '@/utilities/buildRichText'

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

/** One content block from a heading + lines. */
const section = (lines: string[]) => ({
  blockType: 'content',
  columns: [{ size: 'full', richText: buildRichText(lines) }],
})

const layout = [
  section([
    'Where we are',
    'Recording transcribed, plan written. Short version: the site sells, the studies are a blog as of this morning, and there are two numbers I need from you before any of the money math is real.',
    'This page is signed-in only. That is the same gating your customers would get on a members area — you are looking at the feature, not a mockup of it.',
  ]),
  section([
    'The two numbers',
    'Landed cost per unit. Not what you sell it for — what it costs you, delivered. Two figures if you have them: what the 2,500 cost, and what the next 2,500 would cost. Every ad-spend and ROI number I give you is invented until I have this. I am not asking what you make. I am asking what I am allowed to spend to win a customer, and that comes out of cost, not price.',
    'The claims list. What you will stand behind, in writing. Three buckets: will stand behind, believe but cannot document, never say. Plus whatever the manufacturer’s instructions-for-use actually states.',
    'On incontinence specifically: that is a bigger market than fat loss, it is less crowded, and it does not need before-and-after photos that Meta bans anyway. I want to lead with it. That is exactly why it has to be built on something that holds.',
  ]),
  section([
    'And a spec sheet, when you can',
    'Wavelengths, irradiance, treatment area, EMS channels and frequency, session length, certifications, warranty terms.',
    'This is the direct answer to your own point about comparing a Ferrari to a tricycle. Nobody knows because the page has adjectives where it needs numbers. A $99 belt and a $599 Kessela look identical in a search result. A spec table is the only thing that separates them, and it is cheap to build once the numbers exist.',
  ]),
  section([
    'Stephanie',
    'Ready whenever. I would ask for 45 minutes rather than 10 — right now the entire reason you bought 2,500 units lives in one person’s head, and I would like it written down.',
  ]),
  section([
    'Getting set up — let’s do this in person',
    'To run this properly a few accounts need to exist in your name, on your card, so you own them outright and nothing depends on me:',
    'Google API key (maps, mail, calendar, AI). A Linux server — roughly $35–40 a month, which carries the whole stack. Voice-call minutes for the phone line. Domain and email. Payment processing you already have.',
    'These are all small and all fiddly, and doing them over the phone is miserable. An hour in your office and they are done. I can be there tomorrow afternoon, or Thursday morning — Thursday afternoon and Friday I am booked.',
    'One thing to say plainly: I have moved to Dunnellon, so I am an hour and fifteen minutes out rather than around the corner. Our arrangement was always meant to be remote, and everything above works remotely — you offered a screen-share code and that covers most of it. But account setup and a card are worth doing face to face, and I am happy to make the drive whenever it actually helps.',
  ]),
  section([
    'One thing worth pinning down',
    'You said 10% of everything sold and that the 10% does not change. I want to make sure we mean the same thing so it never becomes a conversation later: does that cover only what goes through the site, or your in-person and cash sales too? Gross or net of processing? And does it ride along to the books and the pet line, or is it Kessela only?',
    'I am not angling for more. I would rather have it written in one sentence now than discover we remembered it differently at unit 900.',
  ]),
  section([
    'What I am doing meanwhile',
    'Rewriting the eight studies properly — real citation, what the study did, what it found, and what it does not show. That last part is the whole point: everyone in this category overstates, so being the one honest source is what makes a stranger trust a $599 purchase.',
    'Building the warranty and returns front door, so 2,500 units do not become 2,500 phone calls.',
    'Mapping creator outreach — and not to red-light-therapy channels, which are a race to the bottom on price. Pelvic floor, postpartum and menopause audiences are the actual buyer and almost nobody is competing for them.',
  ]),
]

const data = {
  title: 'Where we are — Kenneth',
  slug: 'brief',
  tenant: tenantId,
  access: 'authenticated',
  showInNav: false,
  _status: 'published',
  layout,
} as Record<string, unknown>

const existing = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'brief' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (existing.docs?.[0]) {
  await update({ collection: 'pages', id: (existing.docs[0] as { id: number }).id, data, overrideAccess: true })
  console.log('updated /brief')
} else {
  await create({ collection: 'pages', data, overrideAccess: true })
  console.log('created /brief')
}
console.log('https://kessela.spacesangels.com/brief  (signed-in only, hidden from nav)')
process.exit(0)
