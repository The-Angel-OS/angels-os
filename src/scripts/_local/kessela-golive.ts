/**
 * Take Kessela live: upload the product video, give the home page a full-screen
 * video hero, and publish everything the importer left as drafts.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-golive.ts [-- --video=<path>]
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'

import { buildRichText } from '@/utilities/buildRichText'

const arg = (name: string, fallback = ''): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const VIDEO = arg('video', 'C:/Users/kenne/Downloads/kessela-ht2.mp4')
const TENANT_SLUG = 'kessela'

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) {
  console.error('No kessela tenant — run provision-kessela.ts first.')
  process.exit(1)
}

// ── 1. The product video ────────────────────────────────────────────────────
let videoId: number | null = null
const name = basename(VIDEO)

const existingVideo = await payload.find({
  collection: 'media',
  where: { and: [{ tenant: { equals: tenantId } }, { filename: { like: name } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (existingVideo.docs?.[0]) {
  videoId = (existingVideo.docs[0] as { id: number }).id
  console.log(`video: reused media ${videoId}`)
} else if (existsSync(VIDEO)) {
  const buf = readFileSync(VIDEO)
  const created = await (payload.create as never as (a: unknown) => Promise<{ id: number }>)({
    collection: 'media',
    data: { alt: 'Kessela Elite Core Contouring Belt — how it works', tenant: tenantId },
    file: { data: buf, mimetype: 'video/mp4', name, size: buf.length },
    overrideAccess: true,
  })
  videoId = created.id
  console.log(`video: uploaded ${name} → media ${videoId} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
} else {
  console.log(`video: NOT FOUND at ${VIDEO} — hero will fall back to the imported hero image`)
}

// ── 2. Home page: full-screen hero ──────────────────────────────────────────
const home = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'home' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const homeDoc = home.docs?.[0] as { id: number; hero?: { media?: number } } | undefined

if (homeDoc) {
  // Fall back to the first imported image if the video isn't on disk — the hero
  // `media` field is required, so an empty one fails validation rather than
  // rendering plain.
  let heroMedia = videoId ?? homeDoc.hero?.media ?? null
  if (!heroMedia) {
    const anyImage = await payload.find({
      collection: 'media',
      where: { and: [{ tenant: { equals: tenantId } }, { mimeType: { like: 'image' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    heroMedia = (anyImage.docs?.[0] as { id: number } | undefined)?.id ?? null
  }

  if (heroMedia) {
    await (payload.update as never as (a: unknown) => Promise<unknown>)({
      collection: 'pages',
      id: homeDoc.id,
      data: {
        title: 'Kessela Elite Core Contouring Belt',
        hero: {
          type: 'fullScreen',
          media: heroMedia,
          richText: buildRichText([
            'Kessela Elite Core Contouring Belt',
            'Red light and near-infrared therapy with EMS. Ten minutes a day, hands free.',
          ]),
          links: [
            { link: { type: 'custom', label: 'Buy Kessela', url: '/buy-kessela-now', appearance: 'default' } },
            { link: { type: 'custom', label: 'See results', url: '/results-testimonials', appearance: 'outline' } },
          ],
        },
        _status: 'published',
      },
      overrideAccess: true,
    })
    console.log(`home: fullScreen hero set (media ${heroMedia}) and published`)
  }
}

// ── 3. Publish everything the import left as drafts ─────────────────────────
const drafts = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'draft' } }] },
  limit: 100,
  depth: 0,
  overrideAccess: true,
})

for (const page of drafts.docs as Array<{ id: number; title: string }>) {
  await (payload.update as never as (a: unknown) => Promise<unknown>)({
    collection: 'pages',
    id: page.id,
    data: { _status: 'published' },
    overrideAccess: true,
  })
  console.log(`published: ${page.title}`)
}

console.log(`\nLive: https://kessela.spacesangels.com`)
process.exit(0)
