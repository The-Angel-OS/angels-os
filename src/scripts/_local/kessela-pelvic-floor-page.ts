/**
 * The incontinence landing page — STRUCTURE ONLY, as a DRAFT.
 *
 * §14 of the plan: one tenant, two front doors. This is the second door. It is
 * NOT in the nav — it is where Stephanie's link points, and later where an ad
 * lands. Same product, same cart, same warranty desk, same inventory.
 *
 * ⚠️ EVERY CLAIM IS A PLACEHOLDER. An incontinence landing page IS the claim —
 * it is not a design that happens to mention one. Nothing here asserts what the
 * device does, because David has not sent the claims list. What IS written is
 * either already on kessela.com in his own words (specs, warranty, returns, the
 * FAQ) or is structural.
 *
 * When the claims list arrives, replacing the [CLAIM: ...] lines is a paste, not
 * a build.
 *
 * Deliberately `_status: 'draft'` — it 404s publicly until someone decides
 * otherwise, which is the correct default for a page like this.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-pelvic-floor-page.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildRichText } from '@/utilities/buildRichText'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any

const SLUG = 'pelvic-floor'

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

const section = (lines: string[]) => ({
  blockType: 'content',
  columns: [{ size: 'full', richText: buildRichText(lines) }],
})

const layout: Array<Record<string, unknown>> = [
  // 1. The proposition. Blank until the claims list lands.
  section([
    '[CLAIM: headline — what this is for, in her words, once David has said what he will stand behind]',
    '[CLAIM: one sentence under the headline. Who it is for and what changes. Nothing here yet.]',
    'Registered Class II medical device. One-year warranty. 14-day money-back guarantee.',
  ]),

  // 2. Trust — inherits the tenant badges, no configuration.
  { blockType: 'trustRow' },

  // 3. Price framing — the §3.4 argument, and it needs no medical claim at all.
  section([
    'What it costs, and what it replaces',
    'A course of pelvic-floor physiotherapy typically runs $100–$200 a session, and is usually a course rather than one visit. The Kessela Physique is $599 once, used at home, for as long as you own it.',
    'With Klarna or Affirm at checkout, that is a monthly figure rather than a single decision — often less than the cost of one session a month.',
    '[CLAIM: if David will stand behind a usage expectation — e.g. "most people use it daily for ten minutes" — it goes here. Otherwise this line is deleted.]',
  ]),

  // 4. Stephanie. The single most valuable asset on this page.
  section([
    'Why we are doing this',
    '[STEPHANIE: her story, in her own words. NOT a results claim — the story of why she went and found 2,500 of these. A person staking themselves on something is evidence in a way a bullet point is not, and it is not a medical claim.]',
    '[VIDEO: replace this section with a MediaText block once there is footage. Portrait is fine — the aspect control is on the roadmap.]',
  ]),

  // 5. What it actually is. Specs are facts, not claims — but we do not have them.
  section([
    'What you are buying',
    'A belt combining red and near-infrared light with electrical muscle stimulation (EMS), fitting waists from 26 to 45 inches (66cm to 114cm). Nine intensity levels. Ten minutes a day.',
    '[SPECS: wavelengths in nm, irradiance in mW/cm², treatment area, LED count, EMS channels and frequency, battery and session length, certifications. Blocked on David — this is the table that separates a $599 belt from a $99 one, and it is the direct answer to his own "Ferrari to a tricycle" complaint.]',
  ]),

  // 6. Evidence, stated honestly. The differentiator.
  section([
    'What the research actually says',
    'We publish the studies with their limits attached — what each one measured, how many people took part, and what it does not show. Everyone in this category overstates. We would rather be the one source you can check.',
    '[LINK: the eight studies at /posts once they have been rewritten to that standard — real citation, what they did, what they found, what it does NOT show.]',
  ]),

  // 7. The objections that actually stop a purchase.
  {
    blockType: 'faq',
    heading: 'Questions people ask before buying',
    openFirst: true,
    items: [
      {
        question: 'Will it fit me?',
        answer:
          'The Kessela Physique comes in one size with a belt measurement of 26 inches to 45 inches (66cm to 114cm).',
      },
      {
        question: 'Is it safe to use?',
        answer:
          'The Kessela Physique utilizes only clinically proven technology that has been shown to be safe and non invasive. With multiple settings to choose from, it is easy to find the most comfortable setting for you. If at any time you feel the belt is too intense, lower the setting or stop use for a day to allow your muscles to recover.',
      },
      {
        question: 'What does it feel like?',
        answer:
          'Users may experience a gentle warmth, which is emitted by the therapeutic LEDs, as well as a slight tingling and tightness from the EMS electrodes. Increasing the intensity will increase the EMS power levels and at higher levels, users may consider this an unusual sensation while the muscles are contracting and working out.',
      },
      {
        question: 'What if it does not work for me?',
        answer:
          'There is a 14-day money-back guarantee, and a one-year warranty on the device. If something goes wrong you can file a claim on this site with a photo, and it goes straight to the team rather than into a phone queue.',
      },
      {
        question: 'How discreet is the delivery?',
        answer:
          '[CLAIM/FACT: confirm packaging with David. For this audience it is a genuine purchase objection and a cheap one to answer well.]',
      },
    ],
  },

  // 8. The ask.
  section([
    'Ready when you are',
    '$599, shipped, with a 14-day money-back guarantee and a one-year warranty. Klarna and Affirm available at checkout.',
    '[CTA: Buy — wire to the product once this page is being published rather than drafted.]',
  ]),
]

const existing = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: SLUG } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const prior = existing.docs?.[0] as { id: number; _status?: string } | undefined

const data = {
  title: 'Pelvic floor — Kessela',
  slug: SLUG,
  tenant: tenantId,
  // Not a menu item. This is a destination for a link someone was given.
  showInNav: false,
  // Stays a draft until the claims list exists and a human decides to publish.
  _status: prior?._status ?? 'draft',
  layout,
} as Record<string, unknown>

if (prior) {
  await update({ collection: 'pages', id: prior.id, data, overrideAccess: true })
  console.log(`updated /${SLUG} (${prior._status})`)
} else {
  await create({ collection: 'pages', data, overrideAccess: true })
  console.log(`created /${SLUG} as a DRAFT`)
}

console.log('\nPreview in admin. It 404s publicly until published — on purpose.')
console.log('Search the layout for [CLAIM:, [SPECS:, [STEPHANIE:, [VIDEO:, [LINK:, [CTA:')
process.exit(0)
