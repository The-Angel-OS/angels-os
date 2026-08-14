/**
 * Anthony J Studio — shoot-diary posts + voice line.
 *
 * Two posts, one per gallery, so /posts is not an empty room when the nav
 * derives a "Posts" link. They are PLACEHOLDER editorial written from what the
 * photographs actually show — deliberately no invented model names, no invented
 * quotes, no fabricated testimonials. Anthony replaces them with his own shoot
 * notes; nothing here claims a person said or did something they did not.
 *
 * Also flips on Vapi for the tenant WITHOUT assigning a dedicated number, so the
 * studio is reachable by name through the shared platform line. Buying a number
 * of his own is a purchase, and therefore Ken's call, not this script's.
 *
 * Run: pnpm payload run src/scripts/_local/anthonyjstudio-posts.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'anthonyjstudio' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number; vapi?: Record<string, unknown> } | undefined
if (!tenant) {
  console.error('No anthonyjstudio tenant.')
  process.exit(1)
}
const tenantId = tenant.id

const STUDIO = [503, 504, 505, 506, 507, 508, 509, 510, 511]
const LOCATION = [512, 513, 514, 515, 516, 517, 518, 519, 520, 521, 522]

const content = (nodes: Array<{ h2?: string; p?: string }>) => ({
  blockType: 'content',
  columns: [
    {
      size: 'full',
      richText: createLexicalContent(
        nodes.flatMap((n) => [
          ...(n.h2 ? [createHeadingNode(n.h2, 'h2')] : []),
          ...(n.p ? [createParagraphNode(n.p)] : []),
        ]),
      ),
    },
  ],
})

const POSTS = [
  {
    slug: 'inside-a-studio-session',
    title: 'Inside a studio session',
    heroImage: 509,
    description:
      'What a day on seamless actually looks like — three backdrops, gelled light, and why the last hour is usually the best one.',
    layout: [
      content([
        {
          p: 'A studio day is mostly about removing things. No landscape, no weather, no passers-by — just a person, a backdrop and whatever the lights are told to do. Everything that ends up in the frame is there because someone decided to put it there.',
        },
        {
          h2: 'Three backdrops, three moods',
          p: 'Most sessions run across white seamless, black, and something coloured. White is honest and open — it flatters wardrobe and shows the actual person. Black removes everything except the shape the light carves out. Colour is where the day stops being a portrait session and starts being a picture.',
        },
        {
          h2: 'Gels are not a gimmick',
          p: 'Magenta from one side, blue from the other, and a backdrop that was grey a minute ago is suddenly doing half the work of the photograph. It takes about ten minutes to set up and changes the register of everything shot afterwards.',
        },
      ]),
      { blockType: 'gallery', heading: 'From the studio', columns: '3', images: STUDIO.map((image) => ({ image })) },
      content([
        {
          h2: 'The last hour',
          p: 'Almost every session produces its best frames near the end, once the self-consciousness has burned off and the poses stop being poses. That is not a technique — it is just time. It is also why a session is never booked for one hour.',
        },
        {
          p: 'Bring more wardrobe than you think you need, and bring the piece you are not sure about. It is usually the one that works.',
        },
      ]),
    ],
  },
  {
    slug: 'shooting-on-location-in-central-florida',
    title: 'Shooting on location in Central Florida',
    heroImage: 512,
    description:
      'Lakes, live oaks, old timber and stone — what the ground around Summerfield gives you, and why it means an early alarm.',
    layout: [
      content([
        {
          p: 'A studio gives you control. Location gives you everything you did not think to ask for — water, weather, a fence line, the way light comes through a stand of pines at seven in the morning. The trade is that you have to take what the day offers.',
        },
        {
          h2: 'The light decides the schedule',
          p: 'Location sessions happen early or late. Midday sun in Florida is flat, harsh and unkind to everyone, and no amount of editing rescues it. The hour after sunrise and the hour before sunset are worth the alarm clock, and that is not negotiable.',
        },
        {
          h2: 'What is within a short drive',
          p: 'Lake edges and boat landings. Hand-hewn log cabins with clay chinking still in the walls. Split-rail fences, live oaks with roots you can sit in, weathered stone with iron bars in the windows. Working land, too — a tractor makes a better backdrop than most studios do.',
        },
      ]),
      {
        blockType: 'gallery',
        heading: 'On location',
        columns: '3',
        images: LOCATION.map((image) => ({ image })),
      },
      content([
        {
          h2: 'Practical things',
          p: 'Wear or bring shoes you can walk in and change out of. Expect grass, sand and the occasional wet foot. Bring a second outfit in a different tone — the same location photographs like two different places once the colour changes.',
        },
        {
          p: 'If there is somewhere you have driven past for years and always thought would photograph well, say so. That is usually where the good frames come from.',
        },
      ]),
    ],
  },
]

for (const p of POSTS) {
  const existing = await payload.find({
    collection: 'posts',
    where: { and: [{ slug: { equals: p.slug } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const data = {
    title: p.title,
    slug: p.slug,
    tenant: tenantId,
    _status: 'published',
    access: 'public',
    publishedOn: new Date().toISOString(),
    hero: {
      type: 'highImpact',
      media: p.heroImage,
      richText: createLexicalContent([createHeadingNode(p.title, 'h1')]),
    },
    layout: p.layout,
    meta: { title: p.title, description: p.description, image: p.heroImage },
  }
  const doc = existing.docs?.[0] as { id: number } | undefined
  if (doc) {
    await update({ collection: 'posts', id: doc.id, data, overrideAccess: true })
    console.log(`post updated: ${p.slug}`)
  } else {
    const made = await create({ collection: 'posts', data, overrideAccess: true })
    console.log(`post created: ${p.slug} (#${made.id})`)
  }
}

// Voice: reachable by name on the SHARED platform line. No `phoneNumber` here —
// setting it to the platform number would make every call to that line land on
// this studio and skip routing for every other portal.
await update({
  collection: 'tenants',
  id: tenantId,
  data: { vapi: { ...(tenant.vapi || {}), enabled: true } },
  overrideAccess: true,
})
console.log('vapi: enabled (shared platform number, no dedicated line)')

console.log('\nDone. https://anthonyjstudio.spacesangels.com/posts')
process.exit(0)
