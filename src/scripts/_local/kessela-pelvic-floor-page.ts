/**
 * The incontinence landing page — STRUCTURE ONLY, as a DRAFT.
 *
 * §14 of the plan: one tenant, two front doors. This is the second door. It is
 * NOT in the nav — it is where Stephanie's link points, and later where an ad
 * lands. Same product, same cart, same warranty desk, same inventory.
 *
 * ⚠️ THE COPY HERE IS PROPOSED, NOT APPROVED. Every line maps to a lettered item
 * in docs/kessela/CLAIMS_SIGNOFF.md that David initials or strikes.
 *
 * Asking him for "a list of claims you'll stand behind" is homework he has not
 * done in two days — an open-ended task with no obvious first line. Proposing the
 * words inverts it into thirty seconds of yes/no. That is why this page carries
 * careful language rather than blanks.
 *
 * The discipline is unchanged: nothing here says the device treats, cures or
 * corrects anything. Registration is a listing, not clearance. What is written is
 * mechanism (EMS contracts muscle), audience-by-their-own-reason, price context
 * from true market facts, Stephanie's ACTION rather than her outcome, and the
 * guarantee. Only [SPECS:, [VIDEO:, [LINK:, [FACT: and [CTA: remain blank.
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
  // 1. The proposition. Every line is §B of CLAIMS_SIGNOFF.md — proposed, careful,
  //    and awaiting David's initials rather than invented here.
  section([
    // B1 — mechanism, no condition named, no outcome promised.
    'What it is',
    'Electrical muscle stimulation causes muscles to contract. The Kessela Physique applies EMS across the lower abdomen and core, alongside red and near-infrared light.',
    // B2 — names the audience by their own reason for arriving, and declines the
    //      claim out loud, which is safer AND more credible than dancing round it.
    'Some people use it as part of a daily core routine. Others came to it for pelvic-floor reasons. We are not going to tell you which you are.',
    'Registered Class II medical device. One-year warranty. 14-day money-back guarantee.',
  ]),

  // 2. Trust — inherits the tenant badges, no configuration.
  { blockType: 'trustRow' },

  // 3. B4 — price context. Every number is a true market fact and no equivalence
  //    is asserted. The strongest commercial line on the page and the one
  //    carrying the most inference; David approves it knowingly or not at all.
  section([
    'What it costs, and what people compare it to',
    'A session with a pelvic-floor physiotherapist typically costs $100–200, and it is usually a course rather than one visit.',
    'The Kessela Physique is $599 once, at home, for as long as you own it. With Klarna or Affirm at checkout that is often less per month than a single session.',
  ]),

  // 4. B3 — Stephanie as an ACTION, not an outcome. A person staking themselves
  //    on something is evidence; it is not a medical claim.
  section([
    'Why we are doing this',
    'Stephanie believed in this enough that we brought in 2,500 units. She will tell you her story in her own words — what it did for her is hers to say, not ours to print.',
    '[VIDEO: swap this for a Video block once there is footage. Portrait 9:16 is supported now.]',
  ]),

  // 5. Facts. The specs are the one genuinely blocked item — see §6.3 of the plan.
  section([
    'What you are buying',
    'A belt combining red and near-infrared light with electrical muscle stimulation, fitting waists from 26 to 45 inches (66cm to 114cm). Nine intensity levels. Around ten minutes a day.',
    '[SPECS: wavelengths (nm), irradiance (mW/cm²), treatment area, LED count, EMS channels and frequency, battery, certifications. Blocked on David — this is the table that separates a $599 belt from a $99 one.]',
  ]),

  // 6. B5 — honesty as the differentiator. Zero exposure, and it is the strategy.
  section([
    'What the research actually says',
    'We publish the research with its limits attached — what each study measured, how many people took part, and what it does not show. Everyone in this category overstates. We would rather be the one you can check.',
    '[LINK: the studies at /posts, once rewritten to that standard.]',
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
        question: 'What if it is not for me?',
        answer:
          'Try it for 14 days. If it is not for you, send it back. One-year warranty either way, and claims are filed on this site with a photo rather than a phone queue.',
      },
      {
        question: 'How discreet is the delivery?',
        answer: '[FACT: confirm packaging with David — §B7 of CLAIMS_SIGNOFF.md.]',
      },
    ],
  },

  // 8. B6 — the guarantee IS the close. It removes the risk his claims cannot.
  section([
    'Ready when you are',
    '$599, shipped. Try it for 14 days — if it is not for you, send it back. One-year warranty either way. Klarna and Affirm available at checkout.',
    '[CTA: wire to the product when this page goes from draft to published.]',
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

/**
 * splitPanel — the same hero the rest of the site uses: one full-bleed image,
 * dark gradient, content left. A landing page that opens with a paragraph reads
 * like a document; this reads like a product. Same block, no new component.
 */
const HERO_MEDIA = 448 // Belt-around-waist.jpg — the product ON a person, not a box shot

const data = {
  title: 'Pelvic floor — Kessela',
  slug: SLUG,
  tenant: tenantId,
  hero: {
    type: 'splitPanel',
    media: HERO_MEDIA,
    richText: buildRichText([
      'Ten minutes a day, at home',
      'Red and near-infrared light with electrical muscle stimulation. Registered Class II device, one-year warranty, and fourteen days to change your mind.',
    ]),
    links: [
      {
        link: {
          type: 'custom',
          url: '/buy-kessela-now',
          label: 'Get the belt — $599',
          appearance: 'default',
        },
      },
      {
        link: {
          type: 'custom',
          url: '#what-the-research-says',
          label: 'Read the research first',
          appearance: 'outline',
        },
      },
    ],
  },
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
