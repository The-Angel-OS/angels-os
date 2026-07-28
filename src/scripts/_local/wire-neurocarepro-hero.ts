/**
 * One-off: upload the NeuroCare Pro hero video to media (tenant 22) and set the
 * home page to a full-screen video hero. Idempotent-ish (reuses an existing hero
 * media by filename if present). Run in container AFTER a rebuild with the
 * fullScreen hero code:
 *   node_modules/.bin/payload run src/scripts/_local/wire-neurocarepro-hero.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createLexicalContent, createHeadingNode, createParagraphNode } from '@/utilities/lexicalHelpers'

const TENANT = 22
const VIDEO_PATH = '/tmp/neurocareprohero.mp4' // docker cp'd in before running
const VIDEO_FILENAME = 'neurocarepro-hero.mp4'

const payload = await getPayload({ config })

// 1. Reuse or upload the hero video to media
let mediaId: number | string
const existing = await payload.find({
  collection: 'media',
  where: { and: [{ tenant: { equals: TENANT } }, { filename: { equals: VIDEO_FILENAME } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
if (existing.docs[0]) {
  mediaId = (existing.docs[0] as any).id
  console.log('HERO_MEDIA reused', mediaId)
} else {
  const created = await (payload.create as any)({
    collection: 'media',
    data: { alt: 'NeuroCare Pro — Pulsed Light Medical Technology', tenant: TENANT },
    filePath: VIDEO_PATH,
    overrideAccess: true,
  })
  mediaId = created.id
  console.log('HERO_MEDIA uploaded', mediaId, created.mimeType, created.url)
}

// 2. Set the home page to a full-screen video hero
const home = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: TENANT } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const page = home.docs[0] as any
if (!page) {
  console.log('NO_HOME_PAGE')
} else {
  await payload.update({
    collection: 'pages',
    id: page.id,
    data: {
      hero: {
        type: 'fullScreen',
        media: mediaId,
        richText: createLexicalContent([
          createHeadingNode('A True Evolution in Advanced Light Medicine', 'h1'),
          createParagraphNode('Doctor-recommended, FDA-registered Pulsed Light Medical Technology (PLMT).'),
        ]),
        links: [
          { link: { type: 'custom', label: 'View Our Systems', url: '/shop', appearance: 'default' } },
          { link: { type: 'custom', label: 'Get the Book', url: '/posts', appearance: 'outline' } },
        ],
      },
      // The page's OWN status, not a literal — omit it and this write lands as
      // a draft and takes the live home page down. @see docs/FOOTGUNS.md 2.7b
      _status: page._status,
    } as any,
    overrideAccess: true,
  })
  console.log('HERO_SET fullScreen on home page', page.id, 'media', mediaId)
}

process.exit(0)
