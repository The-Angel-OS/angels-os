/**
 * Mirror a plain brochure site into a tenant's Pages + Media.
 *
 * Written for Kessela: kessela.com is a WordPress brochure site with a $599
 * price on the page and NO cart — the "Buy Kessela Now!" nav link points at the
 * page you are already on. There is no checkout to preserve, so the mirror is
 * not a copy of a store, it becomes the only place the product can be bought.
 *
 * Reusable for any brochure site. It reads the live HTML, pulls the images down
 * into Media, and writes one Page per route with the text as a Content block.
 * It does NOT try to reproduce layout — a faithful pixel copy of someone's Avada
 * theme is worth less than clean blocks an owner can edit afterwards.
 *
 * Run:
 *   pnpm payload run src/scripts/_local/import-site.ts -- --tenant=kessela --base=https://kessela.com
 *
 * Idempotent: pages are matched by slug and updated, images by source URL.
 * `payload run` will not await a floating main(), so this uses top-level await.
 * @see docs/FOOTGUNS.md
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { JSDOM } from 'jsdom'

import { buildRichText } from '@/utilities/buildRichText'

const arg = (name: string, fallback = ''): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const TENANT_SLUG = arg('tenant')
const BASE = arg('base').replace(/\/+$/, '')
/** Comma-separated paths; defaults to the routes a WP brochure site usually has. */
const PATHS = arg(
  'paths',
  '/,/how-to-use-belt/,/results-testimonials/,/studies-blog/,/buy-kessela-now/,/shipping-delivery/,/refund-returns/,/warranty/,/contact/',
)
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)

if (!TENANT_SLUG || !BASE) {
  console.error('Usage: --tenant=<slug> --base=https://example.com [--paths=/,/about/]')
  process.exit(1)
}

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number | string } | undefined
if (!tenant) {
  console.error(`No tenant with slug "${TENANT_SLUG}". Provision it first.`)
  process.exit(1)
}
const tenantId = tenant.id

/** Slug from a path: "/" → "home", "/how-to-use-belt/" → "how-to-use-belt". */
const slugOf = (path: string): string => {
  const clean = path.replace(/^\/+|\/+$/g, '')
  return clean === '' ? 'home' : clean.replace(/\//g, '-')
}

/** Remember which source URLs we've already uploaded, so a logo in every
 *  header doesn't become nine copies in Media. */
const mediaBySource = new Map<string, number | string>()

async function importImage(src: string, alt: string): Promise<number | string | null> {
  if (mediaBySource.has(src)) return mediaBySource.get(src)!
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) return null

    const buf = Buffer.from(await res.arrayBuffer())
    // Skip tracking pixels and spacer gifs — they are never worth a Media row.
    if (buf.length < 2048) return null

    const name = (src.split('/').pop() || 'image.jpg').split('?')[0]!
    const created = await (payload.create as never as (a: unknown) => Promise<{ id: number | string }>)({
      collection: 'media',
      data: { alt: alt || name, tenant: tenantId },
      file: { data: buf, mimetype: type, name, size: buf.length },
      overrideAccess: true,
    })
    mediaBySource.set(src, created.id)
    console.log(`  image  ${name} → media ${created.id}`)
    return created.id
  } catch (err) {
    console.log(`  image  SKIP ${src} (${err instanceof Error ? err.message : 'failed'})`)
    return null
  }
}

let pagesWritten = 0

for (const path of PATHS) {
  const url = `${BASE}${path}`
  console.log(`\n${url}`)

  let html = ''
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) {
      console.log(`  SKIP — HTTP ${res.status}`)
      continue
    }
    html = await res.text()
  } catch (err) {
    console.log(`  SKIP — ${err instanceof Error ? err.message : 'fetch failed'}`)
    continue
  }

  const doc = new JSDOM(html).window.document
  const title =
    doc.querySelector('h1')?.textContent?.trim() ||
    doc.querySelector('title')?.textContent?.trim() ||
    slugOf(path)

  // Strip the furniture before reading text, or every page inherits the nav,
  // the cookie banner and the footer as body copy.
  doc.querySelectorAll('script,style,nav,header,footer,noscript,form').forEach((n) => n.remove())

  const paragraphs = Array.from(doc.querySelectorAll('p,h2,h3,li'))
    .map((n) => n.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter((t) => t.length > 30)
  const seen = new Set<string>()
  const unique = paragraphs.filter((t) => (seen.has(t) ? false : (seen.add(t), true)))

  const imgs = Array.from(doc.querySelectorAll('img'))
    .map((n) => ({
      src: new URL(n.getAttribute('src') || '', url).toString(),
      alt: n.getAttribute('alt') || '',
    }))
    .filter((i) => /^https?:/.test(i.src))
    .slice(0, 12) // a WP page can carry dozens of theme sprites

  const heroId = imgs.length ? await importImage(imgs[0]!.src, imgs[0]!.alt || title) : null
  for (const img of imgs.slice(1, 6)) await importImage(img.src, img.alt || title)

  const slug = slugOf(path)
  const layout: Array<Record<string, unknown>> = [
    { blockType: 'content', columns: [{ size: 'full', richText: buildRichText(unique.slice(0, 40)) }] },
  ]
  if (heroId) layout.push({ blockType: 'mediaBlock', media: heroId })

  const existing = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const data = {
    title,
    slug,
    tenant: tenantId,
    _status: 'draft', // never publish someone's mirrored copy automatically
    layout,
  } as Record<string, unknown>

  if (existing.docs?.[0]) {
    await (payload.update as never as (a: unknown) => Promise<unknown>)({
      collection: 'pages',
      id: (existing.docs[0] as { id: number | string }).id,
      data,
      overrideAccess: true,
    })
    console.log(`  page   updated "${title}" (/${slug})`)
  } else {
    await (payload.create as never as (a: unknown) => Promise<unknown>)({
      collection: 'pages',
      data,
      overrideAccess: true,
    })
    console.log(`  page   created "${title}" (/${slug})`)
  }
  pagesWritten++
}

console.log(
  `\nDone. ${pagesWritten} page(s), ${mediaBySource.size} image(s) into tenant "${TENANT_SLUG}".` +
    `\nAll pages are DRAFTS — review, then publish.`,
)
process.exit(0)
