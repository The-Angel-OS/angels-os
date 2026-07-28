/**
 * The product panel on Kessela's buy page — gallery + lightbox + formatted copy.
 *
 * Matches the shape of their own buy page: a large product shot with a thumbnail
 * strip beneath, and the description beside it with its own emphasis. Ours had
 * the same words as one undifferentiated paragraph, which is why theirs reads as
 * a product listing and ours read as prose.
 *
 * ⚠️ The COPY is not theirs. Their description says the belt targets and reduces
 * fat cells "triggering the release of triglycerides for a slimmer waistline and
 * visible fat loss" — a body-composition claim, and on the never-say list in
 * CLAIMS_SIGNOFF.md §C until David says otherwise. What is reproduced here is
 * their STRUCTURE and their bolding rhythm, with mechanism-only wording.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-product-panel.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { updatePageLayout } from './_updatePageLayout'

const payload = await getPayload({ config })

const IMAGES = [
  'https://kessela.com/wp-content/uploads/2024/07/Belt-around-waist.jpg',
  'https://kessela.com/wp-content/uploads/2024/07/Kessela-in-Box.jpg',
  'https://kessela.com/wp-content/uploads/2024/07/Kessel-PBM-EMS-Belt.jpg',
]

/**
 * Lexical paragraphs from `**bold**` markers.
 *
 * buildRichText only makes plain text, and the whole point of this block is that
 * the emphasis matches theirs. `format: 1` is Lexical's bold bit.
 */
const richText = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map((p) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      textFormat: 0,
      children: p
        .split(/(\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((chunk) => {
          const bold = chunk.startsWith('**') && chunk.endsWith('**')
          return {
            type: 'text',
            mode: 'normal',
            style: '',
            detail: 0,
            format: bold ? 1 : 0,
            version: 1,
            text: bold ? chunk.slice(2, -2) : chunk,
          }
        }),
    })),
  },
})

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

const asciiName = (raw: string): string => {
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    /* malformed escape — keep the raw form */
  }
  return name.normalize('NFKD').replace(/[^\x20-\x7E]/g, '-').replace(/-{2,}/g, '-')
}

async function importImage(src: string): Promise<number | null> {
  const filename = asciiName((src.split('/').pop() || '').split('?')[0] || '')
  const prior = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: tenantId } }, { filename: { equals: filename } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const hit = prior.docs?.[0] as { id: number } | undefined
  if (hit) {
    console.log(`  have  ${filename} → media ${hit.id}`)
    return hit.id
  }
  const res = await fetch(src, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) {
    console.log(`  SKIP  ${filename} — HTTP ${res.status}`)
    return null
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const created = (await (payload.create as never as (a: unknown) => Promise<{ id: number }>)({
    collection: 'media',
    data: { alt: 'Kessela Elite Core Contouring Belt', tenant: tenantId },
    file: {
      data: buf,
      mimetype: res.headers.get('content-type') || 'image/jpeg',
      name: filename,
      size: buf.length,
    },
    overrideAccess: true,
  })) as { id: number }
  console.log(`  new   ${filename} → media ${created.id}`)
  return created.id
}

const images: Array<Record<string, unknown>> = []
for (const src of IMAGES) {
  const id = await importImage(src)
  if (id) images.push({ image: id })
}
if (!images.length) {
  console.error('No images — leaving the page alone.')
  process.exit(1)
}

const BLOCK = {
  blockType: 'productPanel',
  images,
  heading: 'Kessela Elite Core-Contouring Advanced PBM & EMS Belt',
  price: 'PRICE: $599.00',
  body: richText([
    "NeuroCare Pro's **Kessela Elite Core-Contouring PBM (RLT/NIR) & EMS Belt** combines **Advanced Photobiomodulation (PBM)** with **Electrical Muscle Stimulation (EMS)** in a single belt you wear for about ten minutes a day.",
    'Built on **Surface Mounted Diode (SMD)** technology, it emits **Near-Infrared (NIR)** and **Red Light (RLT)** across the lower abdomen and core. The **EMS function** sends electrical pulses to the major abdominal muscle groups, which causes those muscles to contract.',
    'One size fits waists from **26 to 45 inches** (66–114 cm). **Nine intensity levels.** Registered Class II medical device.',
  ]),
  ctaLabel: 'Buy now — $599',
  ctaUrl: '/products/kessela-elite-belt',
  footnote:
    'One year warranty · 14-day money-back guarantee · Klarna and Affirm available at checkout',
}

const res = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'buy-kessela-now' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const page = res.docs?.[0] as unknown as
  | { id: number; _status?: string; layout?: Array<Record<string, unknown>> }
  | undefined
if (!page) {
  console.error('No buy page.')
  process.exit(1)
}

const layout = Array.isArray(page.layout) ? [...page.layout] : []
const at = layout.findIndex((b) => b?.blockType === 'productPanel')
if (at >= 0) {
  layout[at] = { ...layout[at], ...BLOCK }
  console.log('\nupdated product panel')
} else {
  // First thing under the hero. Someone on the buy page has already decided to
  // look at the product; make them scroll for it and you lose them.
  layout.unshift(BLOCK)
  console.log('\nadded product panel to the top')
}

await updatePageLayout(payload, page as never, layout, 'pages')
console.log('https://kessela.spacesangels.com/buy-kessela-now')
process.exit(0)
