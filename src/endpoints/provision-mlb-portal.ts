/**
 * Provision My Lunch Break (MLB) / Satan's Little Season Portal
 * GET/POST /api/provision-ops/mlb-portal
 *
 * Stands up `mlb.spacesangels.com` ("My Lunch Break — Old World & Satan's Little Season Archive"):
 *   1. Tenant + Endeavor + Community Spaces + Navigation
 *   2. Home page embedding the 3D Spy-Satellite Globe, 11-Platform Audience Monitor,
 *      Live City Building Scanner, Historic Fire Archive, and Episode Blog Archive
 *   3. Adds "Old World Atlas" nav page (`slug: 'atlas'`) to `mlb`, `wheredideveryonego`,
 *      and `clearwater-cruisin`
 *   4. Ingests My Lunch Break episodes into `Posts` (`sourceType: 'youtube'`,
 *      `sourceUrl`, auto-downloaded YouTube thumbnail in `meta.image`, cleaned
 *      script evidence + investigated structures, `Comments` block, and
 *      cross-linked `relatedPosts`!)
 *
 * Query params:
 *   - `?key=<CRON_SECRET>` (or super_admin session)
 *   - `?offset=0&limit=35` (batch size for episode post ingestion + thumbnail download)
 */
import type { Payload, PayloadHandler } from 'payload'
import { findOrCreateTenant, findOrCreateTenantMembership } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
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

const MLB_CATEGORY_SPECS = [
  { key: 'episodes', title: 'Episodes', slug: 'episodes' },
  { key: 'shows', title: 'Shows', slug: 'shows' },
  { key: 'membersOnly', title: 'Members Only', slug: 'members-only' },
  { key: 'shorts', title: 'Shorts & Clips', slug: 'shorts' },
  { key: 'socialPosts', title: 'Social Posts', slug: 'social-posts' },
  { key: 'structures', title: 'Historical Structures', slug: 'structures' },
  { key: 'topics', title: 'Subjects & Topics', slug: 'topics' },
  { key: 'historicFires', title: 'Historic Fires', slug: 'historic-fires' },
] as const

type MlbCategoryKey = (typeof MLB_CATEGORY_SPECS)[number]['key']

async function resolveMlbTenant(payload: Payload): Promise<{ id: number | string } | null> {
  const tRes = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: SLUG } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = tRes.docs?.[0] as { id?: number | string } | undefined
  return doc?.id != null ? { id: doc.id } : null
}

async function upsertMlbPage(
  payload: Payload,
  tenantId: number | string,
  slug: string,
  data: Record<string, unknown>,
): Promise<{ action: 'created' | 'updated'; id: number | string }> {
  const existing = await payload.find({
    collection: 'pages',
    where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length === 0) {
    const created = await payload.create({
      collection: 'pages',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...data, slug, tenant: tenantId } as any,
      depth: 0,
      overrideAccess: true,
    })
    return { action: 'created', id: created.id }
  }

  const updated = await payload.update({
    collection: 'pages',
    id: existing.docs[0]!.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { ...data, slug, tenant: tenantId } as any,
    depth: 0,
    overrideAccess: true,
  })
  return { action: 'updated', id: updated.id }
}

async function upsertMlbAtlasPage(
  payload: Payload,
  tenantId: number | string,
  databasePageId?: number | string | null,
): Promise<{ action: 'created' | 'updated'; id: number | string }> {
  return upsertMlbPage(payload, tenantId, 'atlas', {
    title: 'Old World Atlas',
    _status: 'published',
    showInNav: false,
    navLabel: 'Old World Atlas',
    navOrder: 15,
    ...(databasePageId != null ? { parent: databasePageId } : {}),
    hero: { type: 'none' },
    layout: [
      {
        blockType: 'globeAtlas',
        blockName: 'Old World Atlas',
        mode: 'old_world',
        showCityScanner: true,
        allowFullscreen: true,
        showAudienceMonitor: false,
        showExcavationHero: false,
        showGlobeAndRecon: true,
        defaultShader: 'optical',
      },
    ],
    meta: {
      title: 'Old World Atlas',
      description:
        'Interactive 3D Old World Spy-Satellite Globe & City Architecture Scanner.',
    },
  })
}

async function findOrCreateMlbCategories(
  payload: Payload,
  tenantId: number | string,
): Promise<Record<MlbCategoryKey, number | string>> {
  const existingRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenantId } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const bySlug = new Map<string, number | string>()
  for (const doc of existingRes.docs as Array<{ id: number | string; slug?: string }>) {
    if (doc.slug) bySlug.set(doc.slug, doc.id)
  }

  const result = {} as Record<MlbCategoryKey, number | string>
  for (const spec of MLB_CATEGORY_SPECS) {
    const existingId = bySlug.get(spec.slug)
    if (existingId != null) {
      result[spec.key] = existingId
      continue
    }
    const created = await payload.create({
      collection: 'categories',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { title: spec.title, slug: spec.slug, tenant: tenantId } as any,
      depth: 0,
      overrideAccess: true,
    })
    result[spec.key] = created.id
  }
  return result
}

async function setupMlbPhase1Nav(payload: Payload, tenantId: number | string) {
  const categories = await findOrCreateMlbCategories(payload, tenantId)

  const showsPage = await upsertMlbPage(payload, tenantId, 'shows', {
    title: 'Shows & Episodes',
    _status: 'published',
    showInNav: false,
    hero: { type: 'none' },
    layout: [
      {
        blockType: 'archive',
        blockName: 'Shows & Video Index',
        populateBy: 'collection',
        relationTo: 'posts',
        categories: [categories.episodes, categories.shows, categories.membersOnly, categories.shorts],
        limit: 12,
        columns: '3',
        enableSearch: true,
        enableCategoryTabs: true,
        enablePagination: true,
        introContent: createLexicalContent([
          createHeadingNode('Shows & Video Index', 'h2'),
          createParagraphNode(
            'Complete My Lunch Break video archive — full investigation episodes, shows, members-only releases, and shorts & clips.',
          ),
        ]),
      },
    ],
    meta: {
      title: 'Shows & Episodes — My Lunch Break',
      description:
        'Browse all My Lunch Break episodes, shows, members-only investigations, and shorts & clips.',
    },
  })

  const databasePage = await upsertMlbPage(payload, tenantId, 'database', {
    title: 'Old World Database',
    _status: 'published',
    showInNav: false,
    hero: { type: 'none' },
    layout: [
      {
        blockType: 'archive',
        blockName: 'Old World Database Index',
        populateBy: 'collection',
        relationTo: 'posts',
        categories: [categories.structures, categories.topics, categories.historicFires],
        limit: 12,
        columns: '3',
        enableSearch: true,
        enableCategoryTabs: true,
        enablePagination: true,
        introContent: createLexicalContent([
          createHeadingNode('Old World Database', 'h2'),
          createParagraphNode(
            'Explore geo-pinned historical structures, recurring architectural subjects (such as Old World Dams and Star Forts), and historic fire dossiers rolled up across every show.',
          ),
        ]),
      },
    ],
    meta: {
      title: 'Old World Database — My Lunch Break',
      description:
        'Searchable database of geo-pinned Old World structures, subject rollups, historic fires, and the 3D Spy-Satellite Atlas.',
    },
  })

  const atlasPage = await upsertMlbAtlasPage(payload, tenantId, databasePage.id)

  const navLinkItem = (label: string, url: string) => ({
    link: { type: 'custom', newTab: false, label, url },
  })

  const headerNavItems = [
    { ...navLinkItem('Home', '/'), children: [] },
    {
      ...navLinkItem('Shows', '/shows'),
      children: [
        navLinkItem('Episodes', '/shows?category=episodes'),
        navLinkItem('Shows & Live', '/shows?category=shows'),
        navLinkItem('Members Only', '/shows?category=members-only'),
        navLinkItem('Shorts & Clips', '/shows?category=shorts'),
      ],
    },
    { ...navLinkItem('Posts', '/posts'), children: [] },
    {
      ...navLinkItem('Database', '/database'),
      children: [
        navLinkItem('Old World Atlas', '/atlas'),
        navLinkItem('Historical Structures', '/database?category=structures'),
        navLinkItem('Subjects & Topics', '/database?category=topics'),
        navLinkItem('Historic Fires', '/database?category=historic-fires'),
      ],
    },
    { ...navLinkItem('Shop', '/shop'), children: [] },
    { ...navLinkItem('Community', '/dashboard/spaces'), children: [] },
  ]

  const existingHeaders = await payload.find({
    collection: 'header',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let headerId: number | string
  let headerAction: 'created' | 'updated'
  if (existingHeaders.docs.length > 0) {
    const updated = await payload.update({
      collection: 'header',
      id: existingHeaders.docs[0]!.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { label: 'Main Header', navItems: headerNavItems } as any,
      depth: 0,
      overrideAccess: true,
    })
    headerId = updated.id
    headerAction = 'updated'
  } else {
    const created = await payload.create({
      collection: 'header',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { tenant: tenantId, label: 'Main Header', navItems: headerNavItems } as any,
      depth: 0,
      overrideAccess: true,
    })
    headerId = created.id
    headerAction = 'created'
  }

  return {
    categories,
    pages: { shows: showsPage, database: databasePage, atlas: atlasPage },
    header: { action: headerAction, id: headerId },
  }
}

async function tagMlbEpisodes(
  payload: Payload,
  tenantId: number | string,
  batchLimit: number,
) {
  const categories = await findOrCreateMlbCategories(payload, tenantId)
  const episodesCatId = categories.episodes

  const postsRes = await payload.find({
    collection: 'posts',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { like: 'ep-' } },
      ],
    },
    limit: 500,
    depth: 0,
    sort: 'id',
    overrideAccess: true,
  })

  const docs = postsRes.docs as Array<{
    id: number | string
    slug?: string | null
    categories?: Array<number | string | { id?: number | string }> | null
  }>

  const extractIds = (cats: typeof docs[number]['categories']): Array<number | string> =>
    (Array.isArray(cats) ? cats : [])
      .map((c) => (c && typeof c === 'object' ? c.id : c))
      .filter((v): v is number | string => v !== null && v !== undefined)

  const untagged = docs.filter(
    (d) => !extractIds(d.categories).some((cid) => String(cid) === String(episodesCatId)),
  )

  const batch = untagged.slice(0, batchLimit)
  for (const post of batch) {
    const mergedCats = [...extractIds(post.categories), episodesCatId]
    await payload.update({
      collection: 'posts',
      id: post.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { categories: mergedCats } as any,
      depth: 0,
      overrideAccess: true,
      context: { disableRevalidate: true, disableTranscriptIndex: true },
    })
  }

  return {
    episodesCategoryId: episodesCatId,
    totalEpPosts: docs.length,
    alreadyTagged: docs.length - untagged.length,
    taggedThisBatch: batch.length,
    remaining: untagged.length - batch.length,
  }
}

export const provisionMlbPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))

  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const onlyAtlas =
    url.searchParams.get('onlyAtlas') === '1' || url.searchParams.get('onlyAtlas') === 'true'
  const setupNav =
    url.searchParams.get('setupNav') === '1' || url.searchParams.get('setupNav') === 'true'
  const tagEpisodes =
    url.searchParams.get('tagEpisodes') === '1' || url.searchParams.get('tagEpisodes') === 'true'
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '40', 10) || 40))

  try {
    if (onlyAtlas || setupNav || tagEpisodes) {
      const mlbTenant = await resolveMlbTenant(payload)
      if (!mlbTenant) {
        return Response.json({ ok: false, error: `tenant '${SLUG}' not found` }, { status: 404 })
      }
      if (onlyAtlas) {
        const existingDb = await payload.find({
          collection: 'pages',
          where: { and: [{ slug: { equals: 'database' } }, { tenant: { equals: mlbTenant.id } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const atlasPage = await upsertMlbAtlasPage(payload, mlbTenant.id, existingDb.docs?.[0]?.id ?? null)
        return Response.json({
          ok: true,
          onlyAtlas: true,
          tenant: { id: mlbTenant.id, slug: SLUG, domain: DOMAIN },
          atlasPage,
          atlasUrl: `https://${DOMAIN}/atlas`,
        })
      }
      if (setupNav) {
        const result = await setupMlbPhase1Nav(payload, mlbTenant.id)
        return Response.json({
          ok: true,
          setupNav: true,
          tenant: { id: mlbTenant.id, slug: SLUG, domain: DOMAIN },
          ...result,
        })
      }
      if (tagEpisodes) {
        const tagLimit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '60', 10) || 60))
        const result = await tagMlbEpisodes(payload, mlbTenant.id, tagLimit)
        return Response.json({
          ok: true,
          tagEpisodes: true,
          tenant: { id: mlbTenant.id, slug: SLUG, domain: DOMAIN },
          ...result,
        })
      }
    }

    const log: string[] = []

    // 1. Create or update the `mlb` tenant (pass undefined for req so the
    // tenant insert commits immediately and downstream page/post FK checks see it)
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
      },
    })
    log.push(`tenant #${tenant.id} (${tenant.slug})`)

    // 2. Navigation & Default Pages
    try {
      await createDefaultTenantNavigation(payload, tenant.id)
      log.push('navigation ready')
    } catch (e) {
      log.push(`navigation skipped: ${(e as Error).message}`)
    }

    await createDefaultTenantPages(payload, tenant.id, { siteName: NAME, tagline: TAGLINE })

    // Customize Home Page on `mlb` with OldWorldAtlas + Episode Archive
    const homePages = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const home = homePages.docs?.[0] as any
    if (home) {
      await payload.update({
        collection: 'pages',
        id: home.id,
        depth: 0,
        overrideAccess: true,
        data: {
          _status: 'published',
          hero: {
            type: 'lowImpact',
            richText: createLexicalContent([
              createHeadingNode('MY LUNCH BREAK // GLOBAL INVESTIGATION ARCHIVE', 'h1'),
              createParagraphNode(
                'Explore 256+ geo-pinned Old World structures on the 3D Spy-Satellite Globe, scan any city on Earth for pre-reset architecture, track live community growth across 11 platforms, and discuss every episode.',
              ),
            ]),
          },
          layout: [
            {
              blockType: 'content',
              blockName: 'old-world-atlas',
              columns: [
                {
                  size: 'full',
                  richText: createLexicalContent([
                    createParagraphNode('Interactive Old World Spy-Satellite Atlas & Audience Monitor'),
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
      log.push(`home page #${home.id} updated with old-world-atlas + episode archive`)
    }

    // 3. Ensure `atlas` page exists ONLY on `mlb` with a single native `globeAtlas` block
    const atlasPage = await upsertMlbAtlasPage(payload, tenant.id)
    log.push(`${atlasPage.action} /atlas page (#${atlasPage.id}) on ${SLUG}`)

    // 4. Endeavor + Spaces + Founder Membership on `mlb`
    const existingEndeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenant.id } },
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
          federation: { networkVisible: true, domain: DOMAIN },
          tenant: tenant.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        overrideAccess: true,
      })
      log.push('endeavor created')
    }

    try {
      await ensureTenantDefaults(payload, tenant.id)
      await ensureTenantSpaces(payload, tenant.id, {
        endeavorType: 'creator-content',
        spaceName: 'Investigation HQ',
      })
    } catch {
      // Non-critical
    }

    // Link founder (userId 3 / Kenneth) if present
    const founderId = user?.id || 3
    try {
      await findOrCreateTenantMembership(payload, req, {
        userId: founderId,
        tenantId: tenant.id,
        role: 'tenant_admin',
      })
    } catch {
      // Ignore
    }

    // 5. Ingest MLB Episodes as Blog Posts (`Posts` collection)
    const placeMap = new Map(mlbArchive.places.map((p) => [p.id, p]))
    const appearancesByEp = new Map<string, typeof mlbArchive.appearances>()
    for (const app of mlbArchive.appearances) {
      const list = appearancesByEp.get(app.episodeId) ?? []
      list.push(app)
      appearancesByEp.set(app.episodeId, list)
    }

    // Deduplicate episodes by number, preferring entries that have a YouTube videoUrl
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
    const sortedEpisodes = Array.from(epByNum.values()).sort((a, b) => b.number - a.number)
    const slice = sortedEpisodes.slice(offset, offset + limit)

    let postsCreated = 0
    let postsUpdated = 0

    for (const ep of slice) {
      const slug = `ep-${ep.number}`
      const apps = [
        ...(appearancesByEp.get(`ep:${ep.number}`) ?? []),
        ...(appearancesByEp.get(ep.id) ?? []),
      ]

      // Build clean title: if title is just "EP 196", append the top featured landmark names!
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

      // Build Lexical nodes for the episode post body
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
        where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const postData = {
        title: cleanTitle,
        slug,
        _status: 'published',
        publishedOn,
        sourceType: ep.videoUrl ? 'youtube' : 'manual',
        sourceUrl: ep.videoUrl || undefined,
        tenant: tenant.id,
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

      if (existingPost.docs.length === 0) {
        await payload.create({
          collection: 'posts',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: postData as any,
          depth: 0,
          overrideAccess: true,
        })
        postsCreated++
      } else {
        await payload.update({
          collection: 'posts',
          id: existingPost.docs[0]!.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: postData as any,
          depth: 0,
          overrideAccess: true,
        })
        postsUpdated++
      }
    }

    // 6. Wire `relatedPosts` across all ingested episodes on `mlb`
    const allMlbPosts = await payload.find({
      collection: 'posts',
      where: { tenant: { equals: tenant.id } },
      limit: 250,
      depth: 0,
      overrideAccess: true,
    })

    const postIdByEpNum = new Map<number, number>()
    for (const p of allMlbPosts.docs as Array<{ id: number; slug?: string }>) {
      const m = p.slug?.match(/^ep-(\d+)$/)
      if (m) postIdByEpNum.set(parseInt(m[1], 10), p.id)
    }

    // Map placeId -> set of episode numbers
    const epsByPlace = new Map<string, Set<number>>()
    for (const app of mlbArchive.appearances) {
      const m = app.episodeId.match(/^ep:(\d+)$/)
      if (!m) continue
      const num = parseInt(m[1], 10)
      const set = epsByPlace.get(app.placeId) ?? new Set<number>()
      set.add(num)
      epsByPlace.set(app.placeId, set)
    }

    let relatedLinked = 0
    for (const ep of slice) {
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
      // Also include immediate neighbors so Related Posts always has at least 2–3 cards
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
        await payload.update({
          collection: 'posts',
          id: postId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { relatedPosts: relatedIds } as any,
          depth: 0,
          overrideAccess: true,
        })
        relatedLinked++
      }
    }

    return Response.json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, domain: DOMAIN },
      url: `https://${DOMAIN}`,
      atlasUrl: `https://${DOMAIN}/atlas`,
      episodesTotal: sortedEpisodes.length,
      batch: { offset, limit, processed: slice.length, postsCreated, postsUpdated, relatedLinked },
      steps: log,
    })
  } catch (err) {
    console.error('[Provision MLB Portal] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Provisioning failed' },
      { status: 500 },
    )
  }
}
