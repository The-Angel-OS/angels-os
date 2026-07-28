/**
 * Kessela's FAQ, in their words, as a real accordion — and their badge copy.
 *
 * Their site already answers the two questions that stand between a stranger and
 * $599 ("will it fit me", "is it safe"). Ours had them as a flat wall of imported
 * text. This puts them in the FAQ block, which also emits FAQPage JSON-LD, so the
 * questions can surface directly in Google results.
 *
 * The trust-row wording is theirs too — I had written generic labels; theirs are
 * more specific and already in market. Mirroring their claims is not the same as
 * inventing new ones, which is the line until David sends the claims list.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-faq.ts
 * Idempotent — an existing faq / trustRow block is updated in place.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout } from './_updatePageLayout'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

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

const FAQ = {
  blockType: 'faq',
  heading: 'Frequently Asked Questions',
  openFirst: true,
  items: [
    {
      question: 'What does a treatment feel like?',
      answer:
        'Users may experience a gentle warmth, which is emitted by the therapeutic LEDs, as well as a slight tingling and tightness from the EMS electrodes. Increasing the intensity will increase the EMS power levels and at higher levels, users may consider this an unusual sensation while the muscles are contracting and working out.',
    },
    {
      question: 'How often should I use the Kessela Physique?',
      answer:
        'We recommend consistent daily use for the best results. For beginners, use the Kessela Physique once daily on the Electrical Muscle Stimulation (EMS) boost setting for 2-10 minute sessions. For intermediate to experienced users, use the EMS boost setting 3-10 minute sessions back to back once or twice daily. If you begin to feel aches, please stop using and take a day to two to recover. During rest periods, your muscles grow stronger.\n\nThe Red & Infrared Light Mode with no EMS stimulation can be used multiple times daily, with treatments lasting between 15 minutes to 1 hour. Many customers use the Kessela belt for 3-10 minute sessions with the Electrical Muscle Stimulation turned on for the abs and then use just the red and infrared light on the sides and back of the trunk (core) for additional sessions to enhance the results.',
    },
    {
      question: 'Will the Kessela Physique fit my waist?',
      answer:
        'The Kessela Physique comes in one size with a belt measurement of 26 inches to 45 inches (66cm to 114cm).',
    },
    {
      question: 'Is it safe to use?',
      answer:
        'The Kessela Physique utilizes only clinically proven technology that has been shown to be safe and non invasive. With multiple settings to choose from, it is easy to find the most comfortable setting for you. If at any time you feel the belt is too intense, lower the setting or stop use for a day to allow your muscles to recover.',
    },
    {
      question: 'How do I use the electrode gel with the Kessela Physique?',
      answer:
        'The Electrode Gel ensures a safe passage of the electrodes to the body and should be applied with every use. To apply, put a small amount on each of the four-carbon electrode pads, and spread the gel around the entire pad with your finger. The glob should be no bigger than a pea. If you feel the need to apply more gel at any time, stop the use of the belt and reapply more gel to each of the four-carbon electrodes.\n\nThe gel should be wiped off after each daily use with gentle PH water or plain water. No chemicals should be used to clean your Kessela Belt. Electrode Gel is only required when using the Boost Settings. No gel is needed when using the Red Light Mode only.',
    },
  ],
}

/** Their wording, not mine. Already in market on kessela.com. */
const TRUST = {
  blockType: 'trustRow',
  items: [
    { icon: 'star', label: 'Trusted A+ Business', detail: 'BBB accredited' },
    { icon: 'return', label: '14-Day Money-Back', detail: 'Backed by a 14-day money-back guarantee' },
    { icon: 'rosette', label: 'Warranty Guarantee', detail: 'Backed by a 100% warranty' },
    { icon: 'shield', label: 'FDA Registered', detail: 'Class II medical device status' },
  ],
  footnote:
    'FDA registration is a device listing — it is not FDA clearance or approval.',
}

// FAQ goes on the FAQ page and the buy page: the objections it answers are the
// ones a buyer has with a card already in their hand.
for (const slug of ['frequently-asked-questions', 'buy-kessela-now']) {
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const page = res.docs?.[0] as unknown as
    | { id: number; layout?: Array<Record<string, unknown>> }
    | undefined
  if (!page) {
    console.log(`  SKIP /${slug}`)
    continue
  }
  const layout = Array.isArray(page.layout) ? [...page.layout] : []
  const at = layout.findIndex((b) => b?.blockType === 'faq')
  if (at >= 0) layout[at] = { ...layout[at], ...FAQ }
  else layout.push(FAQ)
  console.log(`  ${at >= 0 ? 'updated' : 'added'} FAQ on /${slug}`)
  await updatePageLayout(payload, page as never, layout, 'pages')
}

// Retitle the trust row wherever it already sits.
for (const slug of ['home', 'buy-kessela-now']) {
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const page = res.docs?.[0] as unknown as
    | { id: number; layout?: Array<Record<string, unknown>> }
    | undefined
  if (!page) continue
  const layout = Array.isArray(page.layout) ? [...page.layout] : []
  const at = layout.findIndex((b) => b?.blockType === 'trustRow')
  if (at < 0) continue
  layout[at] = { ...layout[at], ...TRUST }
  await updatePageLayout(payload, page as never, layout, 'pages')
  console.log(`  trust row reworded on /${slug}`)
}

console.log('\nhttps://kessela.spacesangels.com/frequently-asked-questions')
process.exit(0)
