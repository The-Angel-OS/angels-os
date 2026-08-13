/**
 * Conform /buy-kessela-now from the "2 week challenge" banner down.
 *
 * Everything above that line was already typed (productPanel · cta · trustRow).
 * Everything below it was the same page again, flattened: a second full product
 * listing repeating the panel's heading, price and body word for word; the four
 * trust badges as four bare text blocks under the trustRow that already renders
 * them; and the legal small print — FDA registration number, ownership, the
 * medical disclaimer — buried inside a block headed "FDA Registered", where it
 * read as a fifth badge rather than as the disclaimer it is.
 *
 * The legal text is carried over verbatim and kept, not trimmed. It's the one
 * thing on this page that isn't marketing copy.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-buy-conform.ts
 * Idempotent — rebuilds the layout below the trust row every run.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout, type LayoutBlock } from './_updatePageLayout'
import { h, p, rich, column } from './_lexical'

const RESULTS_PHOTO = 441
const BUY_URL = '/products/kessela-elite-belt'

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'kessela' } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('No kessela tenant.')

const res = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'buy-kessela-now' } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
const page = res.docs?.[0] as unknown as
  | { id: number; _status?: string | null; layout?: LayoutBlock[] }
  | undefined
if (!page) throw new Error('No /buy-kessela-now.')

const existing = page.layout ?? []
const keep = (blockType: string, contains?: string): LayoutBlock | null => {
  const hit = existing.find((b) => {
    if ((b as { blockType?: string }).blockType !== blockType) return false
    return contains ? JSON.stringify(b).includes(contains) : true
  })
  return hit ? ({ ...hit, id: undefined } as LayoutBlock) : null
}

// Above the fold — already right, carried over untouched.
const product = keep('productPanel')
const buy = keep('cta')
const trust = keep('trustRow')
const faq = keep('faq')

// The challenge banner was a bare paragraph. It's an offer with a deadline in it,
// which is a cta everywhere else on this site.
const challenge: LayoutBlock = {
  blockType: 'cta',
  blockName: 'Two week challenge',
  richText: rich([
    h('h2', 'Take the 2 Week Challenge'),
    p('Take the 2 week challenge today with the Kessela Elite Core-Contouring Advanced PBM & EMS Belt! Affirm payments accepted.'),
  ]),
  links: [{ link: { type: 'custom', label: 'Buy now', url: BUY_URL, appearance: 'default', newTab: false } }],
}

// Results teaser — was a heading block above a body block, no image, no link out
// to the page it's teasing.
const results: LayoutBlock = {
  blockType: 'mediaText',
  blockName: 'Results & Testimonials',
  eyebrow: 'Results & Testimonials',
  heading: 'See the amazing results!',
  body: 'Don’t just take our word for it… see testimonials and results from others using Kessela. We welcome your story as well!',
  media: RESULTS_PHOTO,
  aspect: '4/3',
  videoOnRight: true,
  ctaLabel: 'See the results',
  ctaUrl: '/results-testimonials',
}

// Small print. Verbatim, including the registration number and both disclaimer
// sentences — this is the part of the page that is not ours to edit.
const legal: LayoutBlock = {
  blockType: 'content',
  blockName: 'Legal',
  columns: [
    column('full', [
      p('The Kessela Physique is the World’s first fitness belt of its kind. Purchase the best technology today!'),
      p('Kessela Elite Core Contouring Belt® is owned by Neurocare Pro LLC. FDA Registration Number: 3018126456'),
      p('Disclaimer: Light therapy devices are not intended to diagnose, treat, cure or prevent any disease. The information contained on this website is for educational purposes only. This medical device is not intended to be a substitute for medical advice. Please consult your Doctor for any and all medical advice. Disclaimer: Statements contained herein have not been evaluated by the FDA.'),
      p('© 2015 • Kessela is a Neurocare Pro Product Company • All Rights Reserved • FDA Registration Number: 3018126456'),
    ]),
  ],
}

const layout = [product, buy, trust, challenge, results, faq, legal].filter(Boolean) as LayoutBlock[]

await updatePageLayout(payload, page, layout)
console.log(`buy-kessela-now: ${existing.length} → ${layout.length}`)
console.log('  ' + layout.map((b) => (b as { blockType: string }).blockType).join(' · '))
