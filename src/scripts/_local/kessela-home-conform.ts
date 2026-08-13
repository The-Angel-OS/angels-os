/**
 * Conform the Kessela home page to www.kessela.com's section order and block types.
 *
 * Before: hero + 11 generic `content` blocks + trustRow + showcase. The words were
 * migrated; the structure wasn't. The reference has nine sections, four of which we
 * had no structural equivalent for on this page (cta, faq, a two-column technology
 * comparison, a results teaser) even though every one of those blocks already
 * exists and is used elsewhere in the tenant.
 *
 * After — the reference's order:
 *   hero · showcase · intro · description · features · TECH (2-col) · video ·
 *   cta · faq · results teaser · trust badges
 *
 * Copy is theirs, verbatim, including "Kessela Physique" in the FAQ where the hero
 * says "Kessela Elite Core-Contouring Belt". Mirroring an inconsistency is not the
 * same as inventing copy — that's the line until David sends the claims list.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-home-conform.ts
 * Idempotent — rebuilds the layout from the reference order every run. Existing
 * blocks are carried over by identity where the reference keeps them.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout, type LayoutBlock } from './_updatePageLayout'

const HOW_IT_WORKS_VIDEO = 450 // kessela-ht2.mp4, R2
const TESTIMONIAL_IMAGES = [440, 441, 442] // Heather K · Michele K · Va

const payload = await getPayload({ config })

// ── lexical helpers ────────────────────────────────────────────────────────
const t = (text: string) => ({
  mode: 'normal', text, type: 'text', style: '', detail: 0, format: 0, version: 1,
})
const h = (tag: 'h2' | 'h3' | 'h4', text: string) => ({
  tag, type: 'heading', format: '', indent: 0, version: 1, children: [t(text)], direction: 'ltr',
})
const p = (text: string) => ({
  type: 'paragraph', format: '', indent: 0, version: 1, children: [t(text)], direction: 'ltr',
})
const bullets = (items: string[]) => ({
  tag: 'ul', type: 'list', listType: 'bullet', start: 1, format: '', indent: 0, version: 1,
  direction: 'ltr',
  children: items.map((item, i) => ({
    type: 'listitem', value: i + 1, format: '', indent: 0, version: 1,
    children: [t(item)], direction: 'ltr',
  })),
})
const rich = (children: unknown[]) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, children, direction: 'ltr' },
})
const column = (size: 'half' | 'full', children: unknown[]) => ({
  size, richText: rich(children), enableLink: false,
})

// ── the page ───────────────────────────────────────────────────────────────
const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'kessela' } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('No kessela tenant.')

const pages = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'home' } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
const page = pages.docs?.[0] as unknown as
  | { id: number; _status?: string | null; layout?: LayoutBlock[] }
  | undefined
if (!page) throw new Error('No kessela home page.')

const existing = page.layout ?? []
/** Carry a block over unchanged — the reference keeps it, we just move it. */
const keep = (blockType: string, contains?: string): LayoutBlock | null => {
  const hit = existing.find((b) => {
    if ((b as { blockType?: string }).blockType !== blockType) return false
    if (!contains) return true
    return JSON.stringify(b).includes(contains)
  })
  return hit ? ({ ...hit, id: undefined } as LayoutBlock) : null
}

// 2 — usage scenarios (three cards). Already a showcase; the reference puts it
// directly under the hero rather than a third of the way down.
const showcase = keep('showcase')

// 1/3 — intro + product description, kept as-is.
const intro = keep('content', 'Elite Core Contouring Belt')
const description = keep('content', 'Shed fat, tone muscles')

// 4 — features. Two flat content blocks in the reference's own words.
const featuresHeading = keep('content', 'Tune up your workouts')
const features = keep('content', 'cheat code')

// 5 — technology, two columns. Was FOUR stacked full-width content blocks
// (heading, "Red & Near Infrared Light", its bullets, "Electrical Muscle
// Stimulation", its bullets) which is what "flattened" looks like in practice.
const technology: LayoutBlock = {
  blockType: 'content',
  blockName: 'Combined tech for better results',
  columns: [
    column('full', [h('h2', 'COMBINED TECH FOR BETTER RESULTS')]),
    column('half', [
      h('h3', 'Red & Near Infrared Light'),
      h('h4', 'Light Therapy'),
      bullets([
        'Known as photobiomodulation (PBM), a safe, non-invasive fat reduction method.',
        'Uses advanced Surface Mounted Diode (SMD) technology.',
        'Delivers Near Infrared and Red light to shrink fat cells.',
        'Releases triglycerides, reducing fat volume and size.',
      ]),
    ]),
    column('half', [
      h('h3', 'Electrical Muscle Stimulation'),
      h('h4', 'EMS Therapy'),
      bullets([
        'Simulates an abdominal workout with electrical pulsations.',
        'Targets all four abdominal muscle groups.',
        'Uses patented carbon gel pad placement.',
        'Cycles through settings for amazing results.',
      ]),
    ]),
  ],
}

// 5b — the how-it-works clip, beside copy. mediaText prefers the upload and falls
// back to a YouTube/Vimeo URL, so this same block serves both sources.
const video: LayoutBlock = {
  blockType: 'mediaText',
  blockName: 'How it works',
  eyebrow: 'See it in action',
  heading: 'Ten minutes a day, hands free',
  body: 'Strap it on, press start, and carry on with your day. Each 10 minute session is equal to 300 sit-ups.',
  media: HOW_IT_WORKS_VIDEO,
  aspect: '9/16',
  videoOnRight: true,
  ctaLabel: 'How to use the belt',
  ctaUrl: '/how-to-use-belt',
}

// 6 — CTA. Reference headline and button, verbatim.
const cta: LayoutBlock = {
  blockType: 'cta',
  blockName: 'Purchase today',
  richText: rich([
    h('h2', 'Lighten Your Workout Load, Electrify Your Results!'),
    p('Start your journey to a better you and feel confident about it — our products are backed by a full one-year warranty.'),
  ]),
  links: [
    { link: { type: 'custom', label: 'Purchase today', url: '/buy-kessela-now', appearance: 'default', newTab: false } },
  ],
}

// 7 — FAQ. Their answers, in full; see kessela-faq.ts, which put the same block
// on /buy-kessela-now. Home never got one.
const faq: LayoutBlock = {
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
        'We recommend consistent daily use for the best results. For beginners, use the Kessela Physique once daily on the Electrical Muscle Stimulation (EMS) boost setting for 2-10 minute sessions. For intermediate to experienced users, use the EMS boost setting 3-10 minute sessions back to back once or twice daily. If you begin to feel aches, please stop using and take a day to two to recover. During rest periods, your muscles grow stronger.',
    },
    {
      question: 'Will the Kessela Physique fit my waist?',
      answer:
        'The Kessela Physique comes in one size with a belt measurement of 26 inches to 45 inches (66cm to 114cm).',
    },
    {
      question: 'Is it safe to use?',
      answer:
        'The Kessela Physique utilizes only clinically proven technology that has been shown to be safe and non invasive. With multiple settings to choose from, it is easy to find the most comfortable setting for you.',
    },
    {
      question: 'How do I use the electrode gel with the Kessela Physique?',
      answer:
        'The Electrode Gel ensures a safe passage of the electrodes to the body and should be applied with every use. To apply, put a small amount on each of the four-carbon electrode pads, and spread the gel around the entire pad with your finger.',
    },
  ],
}

// 8 — Results & Testimonials teaser. The reference's before/after images aren't in
// our media library; the three customer photos that ARE carry the same job.
const results: LayoutBlock = {
  blockType: 'gallery',
  blockName: 'Results & Testimonials',
  heading: 'See the amazing results!',
  columns: '3',
  images: TESTIMONIAL_IMAGES.map((image) => ({ image })),
}

// 9 — trust badges. Ours sat directly under the hero; the reference closes with
// them, which is where a badge row does its work — at the decision, not before it.
const trust = keep('trustRow')

const layout = [
  showcase, intro, description, featuresHeading, features,
  technology, video, cta, faq, results, trust,
].filter(Boolean) as LayoutBlock[]

await updatePageLayout(payload, page, layout)

console.log(`home: ${existing.length} blocks → ${layout.length}`)
console.log(layout.map((b) => (b as { blockType: string }).blockType).join(' · '))
for (const missing of [
  ['showcase', showcase], ['intro content', intro], ['description content', description],
  ['features heading', featuresHeading], ['features', features], ['trustRow', trust],
] as const) {
  if (!missing[1]) console.warn(`⚠ carried-over block not found and dropped: ${missing[0]}`)
}
