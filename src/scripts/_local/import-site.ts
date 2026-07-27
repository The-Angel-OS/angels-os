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

  // The in-memory map only dedupes WITHIN a run. Without this lookup a second
  // import re-uploads every image again — 14 duplicates, then 28.
  const filename = (src.split('/').pop() || '').split('?')[0]
  if (filename) {
    const prior = await payload.find({
      collection: 'media',
      where: { and: [{ tenant: { equals: tenantId } }, { filename: { equals: filename } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const hit = prior.docs?.[0] as { id: number | string } | undefined
    if (hit) {
      mediaBySource.set(src, hit.id)
      return hit.id
    }
  }

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) return null

    const buf = Buffer.from(await res.arrayBuffer())
    // 8KB, not 2KB: at 2KB the white Affirm badge (9KB) still got through and
    // rendered as an empty box on a white page.
    if (buf.length < 8192) return null

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

  // Walk the document IN ORDER and cut it into sections at each heading, so the
  // page keeps the source's rhythm instead of becoming one wall of text. A flat
  // paragraph dump is what made the first import look "blah".
  type Section = { heading?: string; paras: string[] }
  const sections: Section[] = []
  let current: Section = { paras: [] }
  const seen = new Set<string>()

  for (const node of Array.from(doc.querySelectorAll('h1,h2,h3,p,li'))) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (!text) continue
    const tag = node.tagName.toLowerCase()

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      // Themes number their feature cards with <h2>1</h2>. A bare digit is a
      // list marker, not a heading, and printed a stray "1" mid-page.
      if (/^\W*\d+\W*$/.test(text) || text.length < 3) continue
      if (current.heading || current.paras.length) sections.push(current)
      current = { heading: text.slice(0, 120), paras: [] }
      continue
    }
    if (text.length < 30) continue // nav crumbs and one-word list items
    if (seen.has(text)) continue
    seen.add(text)
    current.paras.push(text)
  }
  if (current.heading || current.paras.length) sections.push(current)

  const usable = sections.filter((s) => s.paras.length || s.heading).slice(0, 12)

  // Chrome (correctly) rendered the first import as a page of EMPTY BOXES: the
  // logos, the white Affirm badge and the BBB seal had been pulled in as body
  // content. Avada doesn't use semantic <header>/<footer>, so stripping those
  // tags doesn't remove site furniture. Three filters, because no single one
  // catches it: the name, the shape, and the byte size.
  const JUNK_NAME = /logo|affirm|bbb|badge|icon|seal|sprite|payment|arrow|spacer|avatar/i

  const imgs = Array.from(doc.querySelectorAll('img'))
    .map((n) => ({
      src: new URL(n.getAttribute('src') || '', url).toString(),
      alt: n.getAttribute('alt') || '',
      w: Number(n.getAttribute('width')) || 0,
      h: Number(n.getAttribute('height')) || 0,
    }))
    .filter((i) => /^https?:/.test(i.src))
    .filter((i) => !JUNK_NAME.test(i.src))
    // Logos and badges are wide-and-short; photographs are not. Only judge when
    // the source actually declares dimensions.
    .filter((i) => !(i.w && i.h && (i.h < 200 || i.w / i.h > 3)))
    .slice(0, 12) // a WP page can carry dozens of theme sprites

  const imageIds: Array<number | string> = []
  for (const img of imgs) {
    const id = await importImage(img.src, img.alt || title)
    if (id) imageIds.push(id)
  }
  const heroId = imageIds[0] ?? null

  const slug = slugOf(path)

  // Interleave: copy, picture, copy, picture. Long sections split into two
  // half-width columns so a dense block reads as a magazine spread rather than
  // a paragraph wall.
  const layout: Array<Record<string, unknown>> = []
  let imageCursor = 1 // 0 is the hero

  for (const section of usable) {
    // The hero already shows the page title, so repeating it as the first
    // heading printed it twice on every page.
    const heading =
      section.heading && section.heading.trim() !== title.trim() ? section.heading : undefined
    const lines = heading ? [heading, ...section.paras] : section.paras
    if (!lines.length) continue

    if (lines.length > 6) {
      const mid = Math.ceil(lines.length / 2)
      layout.push({
        blockType: 'content',
        columns: [
          { size: 'half', richText: buildRichText(lines.slice(0, mid)) },
          { size: 'half', richText: buildRichText(lines.slice(mid)) },
        ],
      })
    } else {
      layout.push({
        blockType: 'content',
        columns: [{ size: 'full', richText: buildRichText(lines) }],
      })
    }

    // A picture after each section, while we still have pictures.
    const next = imageIds[imageCursor]
    if (next) {
      layout.push({ blockType: 'mediaBlock', media: next })
      imageCursor++
    }
  }

  // Anything left over becomes a closing strip rather than being thrown away.
  for (const leftover of imageIds.slice(imageCursor, imageCursor + 2)) {
    layout.push({ blockType: 'mediaBlock', media: leftover })
  }

  if (!layout.length && heroId) layout.push({ blockType: 'mediaBlock', media: heroId })

  const existing = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const alreadyPublished =
    (existing.docs?.[0] as { _status?: string } | undefined)?._status === 'published'

  const data = {
    title,
    slug,
    tenant: tenantId,
    // New pages arrive as drafts — mirroring someone's site and publishing it
    // isn't a script's call. But a re-import must NOT un-publish a live page.
    _status: alreadyPublished ? 'published' : 'draft',
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
