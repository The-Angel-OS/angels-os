/**
 * Make Kessela demo-ready: its own lead form, the product, and pages that don't
 * look like a scrape.
 *
 * The form field NAMES matter. routeFormToAIBus harvests a CRM contact by
 * substring-matching field names ('name', 'email', 'phone', 'message'), so a
 * field called "yourEmail" feeds the lead engine and one called "contactAddr"
 * silently doesn't. Same engine the VAPI bot posts into.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-store.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildRichText } from '@/utilities/buildRichText'

const PRICE_USD = 599
const INVENTORY = 2500

const payload = await getPayload({ config })
// .bind(payload) — Payload's local update() reads `this.collections`, so an
// unbound alias throws "Cannot read properties of undefined (reading 'collections')".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any
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

// ── 1. Kessela's own lead form ──────────────────────────────────────────────
const existingForm = await payload.find({
  collection: 'forms',
  where: { title: { equals: 'Kessela Contact' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

let formId = (existingForm.docs?.[0] as { id: number } | undefined)?.id
if (!formId) {
  const form = await create({
    collection: 'forms',
    data: {
      title: 'Kessela Contact',
      submitButtonLabel: 'Send',
      confirmationType: 'message',
      confirmationMessage: buildRichText([
        'Thanks — we have your details and someone will be in touch shortly.',
      ]),
      fields: [
        { blockType: 'text', name: 'name', label: 'Your name', required: true, width: 50 },
        { blockType: 'email', name: 'email', label: 'Email', required: true, width: 50 },
        { blockType: 'text', name: 'phone', label: 'Phone', required: false, width: 50 },
        {
          blockType: 'select',
          name: 'leadType',
          label: 'I am a',
          required: false,
          width: 50,
          defaultValue: 'customer',
          options: [
            { label: 'Customer', value: 'customer' },
            { label: 'Practitioner / clinic', value: 'practitioner' },
            { label: 'Distributor / reseller', value: 'distributor' },
          ],
        },
        { blockType: 'textarea', name: 'message', label: 'How can we help?', required: false, width: 100 },
      ],
    },
    overrideAccess: true,
  })
  formId = form.id
  console.log(`form: created "Kessela Contact" id=${formId}`)
} else {
  console.log(`form: reused id=${formId}`)
}

// ── 2. Swap it onto the contact page, drop NeuroCare's ──────────────────────
const contact = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'contact' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const contactDoc = contact.docs?.[0] as unknown as { id: number; layout?: Array<Record<string, unknown>> } | undefined

if (contactDoc) {
  const layout = (contactDoc.layout || []).map((block) =>
    block.blockType === 'formBlock' ? { ...block, form: formId } : block,
  )
  if (!layout.some((b) => b.blockType === 'formBlock')) {
    layout.push({ blockType: 'formBlock', form: formId, enableIntro: false })
  }
  await update({
    collection: 'pages',
    id: contactDoc.id,
    data: { layout, _status: 'published' },
    overrideAccess: true,
  })
  console.log(`contact: form swapped to Kessela's (${formId})`)
}

// ── 3. The product ──────────────────────────────────────────────────────────
const heroImg = await payload.find({
  collection: 'media',
  where: { and: [{ tenant: { equals: tenantId } }, { mimeType: { like: 'image' } }] },
  limit: 6,
  depth: 0,
  overrideAccess: true,
})
const images = (heroImg.docs || []) as Array<{ id: number }>

const existingProduct = await payload.find({
  collection: 'products',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'kessela-elite-belt' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

let productId = (existingProduct.docs?.[0] as { id: number } | undefined)?.id
const productData = {
  title: 'Kessela Elite Core Contouring Belt',
  slug: 'kessela-elite-belt',
  tenant: tenantId,
  _status: 'published',
  priceInUSD: PRICE_USD * 100, // cents — money is integers
  inventory: INVENTORY,
  enableVariants: false,
  description: buildRichText([
    'Red light and near-infrared therapy (PBM) combined with electrical muscle stimulation, in one hands-free belt.',
    'Ten minutes a day. Nine intensity levels. Full one-year warranty and a 14-day money-back guarantee.',
  ]),
  ...(images.length ? { gallery: images.slice(0, 4).map((m) => ({ image: m.id })) } : {}),
}

if (productId) {
  await update({ collection: 'products', id: productId, data: productData, overrideAccess: true })
  console.log(`product: updated id=${productId}`)
} else {
  const p = await create({ collection: 'products', data: productData, overrideAccess: true })
  productId = p.id
  console.log(`product: created id=${productId} — $${PRICE_USD}, ${INVENTORY} units`)
}

// ── 4. Point the Buy page at something that actually sells ──────────────────
const buy = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'buy-kessela-now' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const buyDoc = buy.docs?.[0] as unknown as { id: number; layout?: Array<Record<string, unknown>> } | undefined

if (buyDoc) {
  const layout: Array<Record<string, unknown>> = [
    {
      blockType: 'cta',
      richText: buildRichText([
        `Kessela Elite Core Contouring Belt — $${PRICE_USD}`,
        'One year warranty. 14-day money-back guarantee. Financing available.',
      ]),
      links: [
        {
          link: {
            type: 'custom',
            label: 'Buy now',
            url: `/products/kessela-elite-belt`,
            appearance: 'default',
          },
        },
      ],
    },
    ...(buyDoc.layout || []),
  ]
  await update({
    collection: 'pages',
    id: buyDoc.id,
    data: { layout, _status: 'published' },
    overrideAccess: true,
  })
  console.log('buy page: CTA added above the mirrored copy')
}

// ── 5. Give every page a hero so it stops looking like a scrape ─────────────
const pages = await payload.find({
  collection: 'pages',
  where: { tenant: { equals: tenantId } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})

let styled = 0
for (const page of pages.docs as unknown as Array<{
  id: number
  title: string
  slug: string
  hero?: { type?: string; media?: number }
  layout?: Array<Record<string, unknown>>
}>) {
  if (page.slug === 'home') continue // already has the video hero
  if (page.hero?.type && page.hero.type !== 'none' && page.hero.type !== 'lowImpact') continue

  // Prefer an image the page itself imported, else any tenant image.
  const own = (page.layout || []).find((b) => b.blockType === 'mediaBlock') as
    | { media?: number }
    | undefined
  const mediaId = own?.media ?? images[styled % Math.max(images.length, 1)]?.id
  if (!mediaId) continue

  await update({
    collection: 'pages',
    id: page.id,
    data: {
      hero: {
        type: 'mediumImpact',
        media: mediaId,
        richText: buildRichText([page.title]),
      },
      _status: 'published',
    },
    overrideAccess: true,
  })
  styled++
  console.log(`hero: ${page.title}`)
}

console.log(`\nDone. ${styled} page(s) given a hero. https://kessela.spacesangels.com`)
process.exit(0)
