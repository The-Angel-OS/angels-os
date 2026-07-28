/**
 * Kessela's home-page showcase — the gradient band with three product-in-use cards.
 *
 * The most recognisable section of their site, and the biggest single reason the
 * mirror looked like a document beside it: we had their three captions as plain
 * paragraphs on a flat background. Three photographs on a colour band is the
 * whole difference.
 *
 * The three lifestyle images were never imported — import-site.ts caps at 12
 * images per page and filters hard on junk names, so the ones inside their
 * gallery markup were dropped. Pulled directly here.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-showcase.ts
 * Idempotent — images match by filename, and an existing showcase is updated.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { updatePageLayout } from './_updatePageLayout'

const payload = await getPayload({ config })

const CARDS = [
  { url: 'https://kessela.com/wp-content/uploads/2024/07/Kessela-PBM.jpg', caption: 'Use during workouts' },
  { url: 'https://kessela.com/wp-content/uploads/2024/12/whilerelaxing4.jpg', caption: 'Use while relaxing' },
  { url: 'https://kessela.com/wp-content/uploads/2024/07/body-with-red-ligt-belt.jpg', caption: 'Ten minutes a day' },
]

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

/** Same ASCII-flattening rule as import-site: a percent-escape taken off a URL
 *  becomes part of the filename and the object 404s at its own url. */
const asciiName = (raw: string): string => {
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    /* malformed escape — keep the raw form */
  }
  return name.normalize('NFKD').replace(/[^\x20-\x7E]/g, '-').replace(/-{2,}/g, '-')
}

async function importImage(src: string, alt: string): Promise<number | null> {
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
    console.log(`  SKIP  ${src} — HTTP ${res.status}`)
    return null
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const created = (await (payload.create as never as (a: unknown) => Promise<{ id: number }>)({
    collection: 'media',
    data: { alt, tenant: tenantId },
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

const items: Array<Record<string, unknown>> = []
for (const card of CARDS) {
  const id = await importImage(card.url, card.caption)
  if (id) items.push({ image: id, caption: card.caption })
}

if (items.length < 2) {
  console.error('Not enough images imported — leaving the page alone.')
  process.exit(1)
}

const BLOCK = {
  blockType: 'showcase',
  items,
  statement:
    'Red and near-infrared light with electrical muscle stimulation, in one belt you wear for ten minutes a day.',
  // 'aurora' is Kessela's own blue→magenta ramp. Any other portal gets 'brand',
  // which derives the gradient from its own colour.
  background: 'aurora',
}

const res = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'home' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const page = res.docs?.[0] as unknown as
  | { id: number; _status?: string; layout?: Array<Record<string, unknown>> }
  | undefined
if (!page) {
  console.error('No home page.')
  process.exit(1)
}

const layout = Array.isArray(page.layout) ? [...page.layout] : []
const at = layout.findIndex((b) => b?.blockType === 'showcase')
if (at >= 0) {
  layout[at] = { ...layout[at], ...BLOCK }
  console.log('\nupdated showcase on /home')
} else {
  // Directly after the trust row: badges reassure, then the product is shown
  // being used. Before the wall of imported copy.
  const trust = layout.findIndex((b) => b?.blockType === 'trustRow')
  layout.splice(trust >= 0 ? trust + 1 : 1, 0, BLOCK)
  console.log('\nadded showcase to /home')
}

await updatePageLayout(payload, page as never, layout, 'pages')
console.log('https://kessela.spacesangels.com/')
process.exit(0)
