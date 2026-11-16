import { getPayload } from 'payload'
import config from '@payload-config'
import { createLexicalContent, createParagraphNode } from '@/utilities/lexicalHelpers'

const payload = await getPayload({ config })
const tenantSlug = 'mlb'

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: tenantSlug } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number } | undefined
if (!tenant) {
  console.error('No mlb tenant found.')
  process.exit(1)
}

const tenantId = tenant.id

// Find or create 'atlas' page on tenant 45
const atlasPages = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'atlas' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

const atlasLayout = [
  {
    blockType: 'content',
    blockName: 'spy-satellite-atlas',
    columns: [
      {
        size: 'full',
        richText: createLexicalContent([
          createParagraphNode('3D Spy-Satellite Globe & Building Tracker (No Social Monitor)'),
        ]),
      },
    ],
  },
]

if (atlasPages.docs[0]) {
  await payload.update({
    collection: 'pages',
    id: atlasPages.docs[0].id,
    data: {
      title: 'Old World Atlas',
      _status: 'published',
      hero: { type: 'none' },
      layout: atlasLayout,
      meta: {
        title: 'Old World & Tartaria Spy-Satellite Atlas — My Lunch Break',
        description: 'Interactive 3D Spy-Satellite Globe, Gleason Azimuthal Map, and Live Historic Architecture Scanner.',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
  console.log('Updated existing atlas page on MLB tenant #45 without social block!')
} else {
  await payload.create({
    collection: 'pages',
    data: {
      tenant: tenantId,
      title: 'Old World Atlas',
      slug: 'atlas',
      _status: 'published',
      hero: { type: 'none' },
      layout: atlasLayout,
      meta: {
        title: 'Old World & Tartaria Spy-Satellite Atlas — My Lunch Break',
        description: 'Interactive 3D Spy-Satellite Globe, Gleason Azimuthal Map, and Live Historic Architecture Scanner.',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
  console.log('Created new atlas page on MLB tenant #45 without social block!')
}

process.exit(0)
