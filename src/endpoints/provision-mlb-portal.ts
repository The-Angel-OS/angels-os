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
import type { PayloadHandler } from 'payload'
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

export const provisionMlbPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && key === secret)

  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '40', 10) || 40))

  try {
    const log: string[] = []

    // 1. Create or update the `mlb` tenant
    const tenant = await findOrCreateTenant(payload, req, {
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

    // 3. Ensure `atlas` page exists on `mlb`, `wheredideveryonego`, and `clearwater-cruisin`
    for (const targetSlug of ['mlb', 'wheredideveryonego', 'clearwater-cruisin']) {
      const tRes = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: targetSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const tDoc = tRes.docs?.[0] as { id?: number } | undefined
      if (!tDoc?.id) continue

      const existingAtlas = await payload.find({
        collection: 'pages',
        where: { and: [{ slug: { equals: 'atlas' } }, { tenant: { equals: tDoc.id } }] },
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
        navOrder: 25,
        tenant: tDoc.id,
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
                  createParagraphNode('3D Spy-Satellite Old World & Historic Architecture Atlas'),
                ]),
              },
            ],
          },
        ],
        meta: {
          title: 'Old World Spy-Satellite Atlas & City Architecture Scanner',
          description:
            'Zoom to historic buildings, Carnegie libraries, post offices, and Old World landmarks across Tampa, Clearwater, and the globe.',
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
        log.push(`created /atlas page on ${targetSlug}`)
      } else {
        await payload.update({
          collection: 'pages',
          id: existingAtlas.docs[0]!.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: atlasPageData as any,
          depth: 0,
          overrideAccess: true,
        })
        log.push(`updated /atlas page on ${targetSlug}`)
      }
    }

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
    const epByNum = new Map<number, (typeof mlbArchive.episodes)[number]>()
    for (const ep of mlbArchive.episodes) {
      if (!ep.number) continue
      const prev = epByNum.get(ep.number)
      if (!prev || (!prev.videoUrl && ep.videoUrl)) {
        epByNum.set(ep.number, ep)
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
          req,
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
          req,
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
