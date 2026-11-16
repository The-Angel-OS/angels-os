/**
 * Provision the My Lunch Break (MLB) / Satan's Little Season Portal
 * (`mlb.spacesangels.com`) and ingest its episode archive + YouTube thumbnails.
 *
 * Run against prod:
 *   railway run -s Core -- node src/scripts/_local/_prod.mjs src/scripts/_local/provision-mlb.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { findOrCreateTenant, findOrCreateTenantMembership } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
import { navLink } from '@/utilities/defaultNavItems'
import { setNavOverrides } from '@/utilities/navOverrides'
import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'
import { ensureTenantDefaults } from '@/utilities/ensureTenantDefaults'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'
import mlbArchive from '@/data/mlb-archive.json'

const SLUG = 'mlb'
const NAME = 'My Lunch Break'
const DOMAIN = 'mlb.spacesangels.com'
const TAGLINE = 'Old World Architecture, Satan’s Little Season & Global Investigation Archive'

const payload = await getPayload({ config })

// 1. Ensure tenant exists with dark theme & MLB gold/cyan branding
const tenant = await findOrCreateTenant(payload, undefined, {
  name: NAME,
  slug: SLUG,
  domain: DOMAIN,
  type: 'tenant',
  branding: {
    siteName: NAME,
    tagline: TAGLINE,
    primaryColor: '#D4AF37',
    secondaryColor: '#38BDF8',
    defaultTheme: 'dark',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

const tenantId = Number(tenant.id)
console.log(`[MLB] Tenant ready: #${tenantId} (${tenant.slug}) -> https://${DOMAIN}`)

await payload.update({
  collection: 'tenants',
  id: tenantId,
  data: {
    status: 'active',
    branding: {
      siteName: NAME,
      tagline: TAGLINE,
      primaryColor: '#D4AF37',
      secondaryColor: '#38BDF8',
      defaultTheme: 'dark',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  overrideAccess: true,
})

// 2. Link founders (user #3 Kenneth Courtney & user #4 Tyler Suzanne) FIRST so
// multi-tenant plugin validation sees tenantId in user.tenants
for (const founderId of [3, 4]) {
  try {
    await findOrCreateTenantMembership(payload, undefined, {
      userId: founderId,
      tenantId,
      role: 'tenant_admin',
    })
    const u = (await payload.findByID({
      collection: 'users',
      id: founderId,
      depth: 0,
      overrideAccess: true,
    })) as { tenants?: Array<{ tenant: number | { id: number } }> }
    const existingTenants = u?.tenants || []
    const hasIt = existingTenants.some(
      (t) => (typeof t.tenant === 'object' ? t.tenant?.id : t.tenant) === tenantId,
    )
    if (!hasIt) {
      await payload.update({
        collection: 'users',
        id: founderId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { tenants: [...existingTenants, { tenant: tenantId }] } as any,
        overrideAccess: true,
      })
    }
    console.log(`[MLB] Linked founder #${founderId} -> tenant #${tenantId}`)
  } catch (e) {
    console.warn(`[MLB] Founder #${founderId} link warning:`, (e as Error).message)
  }
}

// 3. Default pages & navigation
await createDefaultTenantPages(payload, tenantId, { siteName: NAME, tagline: TAGLINE })
await createDefaultTenantNavigation(payload, tenantId)

// 4. Update `home` page on `mlb` with the OldWorldAtlas + Episode Archive
const homePages = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (homePages.docs[0]) {
  await payload.update({
    collection: 'pages',
    id: homePages.docs[0].id,
    depth: 0,
    overrideAccess: true,
    data: {
      _status: 'published',
      hero: {
        type: 'none',
      },
      layout: [
        {
          blockType: 'content',
          blockName: 'old-world-atlas',
          columns: [
            {
              size: 'full',
              richText: createLexicalContent([
                createParagraphNode('3D Spy-Satellite Old World Atlas & Audience Monitor'),
              ]),
            },
          ],
        },
        {
          blockType: 'archive',
          blockName: 'Episode Archive',
          populateBy: 'collection',
          relationTo: 'posts',
          limit: 12,
          columns: '3',
          introContent: createLexicalContent([
            createHeadingNode('Latest Investigation Episodes', 'h2'),
            createParagraphNode(
              'Every My Lunch Break episode indexed with full narrator script evidence, geo-pinned landmarks, related investigations, and community discussion.',
            ),
          ]),
        },
      ],
      meta: {
        title: `${NAME} — ${TAGLINE}`,
        description:
          'Interactive 3D Spy-Satellite Old World Building Tracker, Audience Monitor, Historic Fire Archive, and Full Episode Community for My Lunch Break.',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  })
  console.log(`[MLB] Updated home page #${homePages.docs[0].id}`)
}

// 5. Ensure `/atlas` page on `mlb`
const existingAtlas = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'atlas' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

const atlasPageData = {
  title: 'Old World Atlas',
  slug: 'atlas',
  _status: 'published',
  showInNav: true,
  navLabel: 'Old World Atlas',
  navOrder: 15,
  tenant: tenantId,
  hero: { type: 'none' },
  layout: [
    {
      blockType: 'content',
      blockName: 'old-world-atlas',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createParagraphNode('3D Spy-Satellite Old World & Historic Architecture Atlas'),
          ]),
        },
      ],
    },
  ],
  meta: {
    title: 'Old World Spy-Satellite Atlas & City Architecture Scanner',
    description:
      'Zoom to historic buildings, Carnegie libraries, post offices, train stations, cathedrals, and Old World landmarks across Tampa, Clearwater, Mumbai, and the globe.',
  },
}

if (existingAtlas.docs.length === 0) {
  await payload.create({
    collection: 'pages',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: atlasPageData as any,
    depth: 0,
    overrideAccess: true,
  })
  console.log('[MLB] Created /atlas page')
} else {
  await payload.update({
    collection: 'pages',
    id: existingAtlas.docs[0]!.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: atlasPageData as any,
    depth: 0,
    overrideAccess: true,
  })
  console.log('[MLB] Updated /atlas page')
}

// 6. Endeavor & Community Spaces (Discovery OFF as requested)
const existingEndeavors = await payload.find({
  collection: 'endeavors',
  where: { tenant: { equals: tenantId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
if (existingEndeavors.docs.length === 0) {
  await payload.create({
    collection: 'endeavors',
    data: {
      name: NAME,
      tagline: TAGLINE,
      description:
        'Global Old World architectural investigation hub, 3D spy-satellite building tracker, and episode community.',
      endeavorType: 'creator-content',
      holonTypes: ['creator'],
      missionStatement: 'Document and investigate Old World architecture across the earth.',
      status: 'active',
      region: { country: 'US' },
      federation: { networkVisible: false, domain: DOMAIN },
      tenant: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
  console.log('[MLB] Created endeavor (networkVisible: false)')
} else {
  await payload.update({
    collection: 'endeavors',
    id: existingEndeavors.docs[0]!.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { federation: { networkVisible: false, domain: DOMAIN } } as any,
    overrideAccess: true,
  })
  console.log('[MLB] Updated endeavor (networkVisible: false)')
}

// Configure Header & Nav Overrides:
// - Top Bar: Home, Old World Atlas (/atlas), Posts (/posts), Community (/dashboard/spaces)
// - Hidden: Works (/works), Discovery (/federation/discover), Book (/book)
// - More Menu: Learn (/learn) and Dashboard (/dashboard)
const headerDocs = await payload.find({
  collection: 'header',
  where: { tenant: { equals: tenantId } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const mlbNavItems = [
  navLink('Home', '/'),
  navLink('Old World Atlas', '/atlas'),
  navLink('Posts', '/posts'),
  navLink('Community', '/dashboard/spaces'),
]
if (headerDocs.docs[0]) {
  await payload.update({
    collection: 'header',
    id: headerDocs.docs[0].id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { navItems: mlbNavItems } as any,
    overrideAccess: true,
  })
} else {
  await payload.create({
    collection: 'header',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { tenant: tenantId, navItems: mlbNavItems } as any,
    overrideAccess: true,
  })
}

await setNavOverrides(payload, tenantId, {
  pinned: ['/', '/atlas', '/posts', '/dashboard/spaces'],
  hidden: ['/works', '/federation/discover', '/book'],
  maxInline: 0,
})
console.log('[MLB] Configured Header & Nav Overrides (Works & Discovery OFF, Learn in More, Posts & Atlas pinned)')

try {
  await ensureTenantDefaults(payload, tenantId)
  await ensureTenantSpaces(payload, tenantId, {
    endeavorType: 'creator-content',
    spaceName: 'Investigation HQ',
  })
  console.log('[MLB] Ensured tenant spaces')
} catch (e) {
  console.warn('[MLB] Spaces warning:', (e as Error).message)
}

// 7. Ingest MLB Episodes as Blog Posts (`Posts` collection)
const placeMap = new Map(mlbArchive.places.map((p) => [p.id, p]))
const appearancesByEp = new Map<string, typeof mlbArchive.appearances>()
for (const app of mlbArchive.appearances) {
  const list = appearancesByEp.get(app.episodeId) ?? []
  list.push(app)
  appearancesByEp.set(app.episodeId, list)
}

type ValidEpisode = (typeof mlbArchive.episodes)[number] & { number: number }
const epByNum = new Map<number, ValidEpisode>()
for (const ep of mlbArchive.episodes) {
  if (typeof ep.number !== 'number') continue
  const validEp = ep as ValidEpisode
  const prev = epByNum.get(validEp.number)
  if (!prev || (!prev.videoUrl && validEp.videoUrl)) {
    epByNum.set(validEp.number, validEp)
  }
}

// Prioritize episodes with YouTube videoUrl first so thumbnails populate immediately,
// then all remaining script episodes
const sortedEpisodes = Array.from(epByNum.values()).sort((a, b) => {
  if (Boolean(a.videoUrl) !== Boolean(b.videoUrl)) return a.videoUrl ? -1 : 1
  return b.number - a.number
})

console.log(`[MLB] Ingesting ${sortedEpisodes.length} episodes into Posts...`)

let createdCount = 0
let updatedCount = 0

for (const ep of sortedEpisodes) {
  const slug = `ep-${ep.number}`
  const apps = [
    ...(appearancesByEp.get(`ep:${ep.number}`) ?? []),
    ...(appearancesByEp.get(ep.id) ?? []),
  ]

  let cleanTitle = ep.title.trim()
  if (/^(?:ep(?:isode)?\s*)?\d+\s*(?:script|-)?$/i.test(cleanTitle)) {
    const landmarkNames = apps
      .map((a) => placeMap.get(a.placeId)?.name)
      .filter(Boolean)
      .slice(0, 3)
    cleanTitle =
      landmarkNames.length > 0
        ? `EP ${ep.number} — ${landmarkNames.join(', ')}`
        : `Episode ${ep.number} — Old World Investigation`
  } else if (!/^ep/i.test(cleanTitle)) {
    cleanTitle = `EP ${ep.number} — ${cleanTitle}`
  }

  const nodes = [
    createHeadingNode(cleanTitle, 'h2'),
    createParagraphNode(
      ep.videoUrl
        ? `My Lunch Break Investigation Episode #${ep.number} · Watch on YouTube: ${ep.videoUrl}`
        : `My Lunch Break Investigation Episode #${ep.number} · Full Script Evidence & Architectural Dossier.`,
    ),
  ]

  if (apps.length > 0) {
    nodes.push(
      createHeadingNode(`Structures Investigated in Episode #${ep.number} (${apps.length})`, 'h3'),
    )
    for (const app of apps) {
      const place = placeMap.get(app.placeId)
      const locLabel = place
        ? `${place.name} (${[place.city, place.state, place.country].filter(Boolean).join(', ')})`
        : app.placeId
      nodes.push(createHeadingNode(locLabel, 'h4'))
      if (place?.description) {
        nodes.push(createParagraphNode(place.description))
      }
      if (app.evidence) {
        nodes.push(createParagraphNode(`Narrator Script Evidence: "${app.evidence}"`))
      }
    }
  }

  const publishedOn = ep.publishedAt
    ? new Date(ep.publishedAt).toISOString()
    : new Date(Date.now() - (210 - ep.number) * 7 * 86_400_000).toISOString()

  const existingPost = await payload.find({
    collection: 'posts',
    where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const postData = {
    title: cleanTitle,
    slug,
    _status: 'published',
    access: 'public',
    publishedOn,
    sourceType: ep.videoUrl ? 'youtube' : 'manual',
    sourceUrl: ep.videoUrl || undefined,
    tenant: tenantId,
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: createLexicalContent(nodes),
          },
        ],
      },
      {
        blockType: 'comments',
        blockName: 'Episode Discussion',
      },
    ],
  }

  try {
    if (existingPost.docs.length === 0) {
      await payload.create({
        collection: 'posts',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: postData as any,
        depth: 0,
        overrideAccess: true,
      })
      createdCount++
      if (createdCount % 10 === 0) {
        console.log(`[MLB] Created ${createdCount} episode posts...`)
      }
    } else {
      await payload.update({
        collection: 'posts',
        id: existingPost.docs[0]!.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: postData as any,
        depth: 0,
        overrideAccess: true,
      })
      updatedCount++
    }
  } catch (err) {
    console.warn(`[MLB] Post ${slug} error:`, (err as Error).message)
  }
}

console.log(`[MLB] Posts done: created=${createdCount}, updated=${updatedCount}. Linking relatedPosts...`)

// 8. Wire `relatedPosts` across all episodes on `mlb`
const allMlbPosts = await payload.find({
  collection: 'posts',
  where: { tenant: { equals: tenantId } },
  limit: 250,
  depth: 0,
  overrideAccess: true,
})

const postIdByEpNum = new Map<number, number>()
for (const p of allMlbPosts.docs as Array<{ id: number; slug?: string }>) {
  const m = p.slug?.match(/^ep-(\d+)$/)
  if (m) postIdByEpNum.set(parseInt(m[1], 10), p.id)
}

const epsByPlace = new Map<string, Set<number>>()
for (const app of mlbArchive.appearances) {
  const m = app.episodeId.match(/^ep:(\d+)$/)
  if (!m) continue
  const num = parseInt(m[1], 10)
  const set = epsByPlace.get(app.placeId) ?? new Set<number>()
  set.add(num)
  epsByPlace.set(app.placeId, set)
}

let linkedCount = 0
for (const ep of sortedEpisodes) {
  const postId = postIdByEpNum.get(ep.number)
  if (!postId) continue

  const relatedNums = new Set<number>()
  const apps = appearancesByEp.get(`ep:${ep.number}`) ?? []
  for (const a of apps) {
    for (const otherNum of epsByPlace.get(a.placeId) ?? []) {
      if (otherNum !== ep.number && postIdByEpNum.has(otherNum)) {
        relatedNums.add(otherNum)
      }
    }
  }
  for (const delta of [-1, 1, -2, 2]) {
    if (relatedNums.size >= 3) break
    const neighbor = ep.number + delta
    if (postIdByEpNum.has(neighbor)) relatedNums.add(neighbor)
  }

  const relatedIds = Array.from(relatedNums)
    .slice(0, 3)
    .map((n) => postIdByEpNum.get(n)!)
    .filter(Boolean)

  if (relatedIds.length > 0) {
    try {
      await payload.update({
        collection: 'posts',
        id: postId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { relatedPosts: relatedIds } as any,
        depth: 0,
        overrideAccess: true,
      })
      linkedCount++
    } catch {
      // Ignore
    }
  }
}

console.log(`[MLB] Linked relatedPosts on ${linkedCount} episodes.`)
console.log(`\nDone! Visit https://${DOMAIN} and https://${DOMAIN}/posts`)
process.exit(0)
