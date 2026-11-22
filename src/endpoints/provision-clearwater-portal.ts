/**
 * Provision Clearwater Cruisin' Navigation & Post Segregation
 * GET/POST /api/provision-ops/clearwater-portal
 *
 * Configures `clearwater-cruisin.spacesangels.com` (`slug: 'clearwater-cruisin'`):
 *   1. Ensures categories (`vlog`, `the-detour`, `rpe`, `moving-sale` preserved;
 *      plus `videos`, `shorts`, `live`, `members-only`, `social-posts`)
 *   2. Upserts plain CMS Page `/videos` (`ArchiveBlock` with search, category
 *      tabs, and pagination)
 *   3. Updates the tenant `Header` navItems: renames `Video Log` (/posts) to
 *      `Posts`, and adds `Videos` (/videos) with category filter dropdowns
 *   4. Tags existing posts without dropping existing categories:
 *      - YouTube/Vimeo video posts -> ensure `videos` category attached
 *      - Written / non-video posts -> ensure `social-posts` category attached
 *
 * Query params:
 *   - `?key=<CRON_SECRET>` (or Authorization: Bearer <CRON_SECRET> or super_admin)
 *   - `?setupNav=1`    — run category + /videos page + Header setup
 *   - `?tagExisting=1` — tag existing posts into `videos` or `social-posts`
 *   (If neither flag is passed, runs both.)
 */
import type { Payload, PayloadHandler } from 'payload'
import {
  createHeadingNode,
  createLexicalContent,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'
import { extractYouTubeVideoId } from '@/utilities/transcriptUtils'

const CLEARWATER_SLUG = 'clearwater-cruisin'
const CLEARWATER_DOMAIN = 'clearwater-cruisin.spacesangels.com'

const CLEARWATER_CATEGORY_SPECS = [
  { key: 'videos', title: 'Videos', slug: 'videos' },
  { key: 'shorts', title: 'Shorts', slug: 'shorts' },
  { key: 'live', title: 'Live Streams', slug: 'live' },
  { key: 'vlog', title: 'Video Log', slug: 'vlog' },
  { key: 'theDetour', title: 'The Detour', slug: 'the-detour' },
  { key: 'membersOnly', title: 'Private & Members', slug: 'members-only' },
  { key: 'socialPosts', title: 'Posts & Dispatches', slug: 'social-posts' },
  { key: 'rpe', title: 'Ready Player Everyone', slug: 'rpe' },
  { key: 'movingSale', title: 'Moving Sale', slug: 'moving-sale' },
] as const

type ClearwaterCategoryKey = (typeof CLEARWATER_CATEGORY_SPECS)[number]['key']

async function resolveClearwaterTenant(
  payload: Payload,
): Promise<{ id: number | string; slug: string } | null> {
  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: CLEARWATER_SLUG } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs?.[0] as { id?: number | string; slug?: string } | undefined
  return doc?.id != null ? { id: doc.id, slug: doc.slug || CLEARWATER_SLUG } : null
}

async function upsertTenantPage(
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

async function findOrCreateClearwaterCategories(
  payload: Payload,
  tenantId: number | string,
): Promise<{
  ids: Record<ClearwaterCategoryKey, number | string>
  createdSlugs: string[]
}> {
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

  const ids = {} as Record<ClearwaterCategoryKey, number | string>
  const createdSlugs: string[] = []

  for (const spec of CLEARWATER_CATEGORY_SPECS) {
    const existingId = bySlug.get(spec.slug)
    if (existingId != null) {
      ids[spec.key] = existingId
      continue
    }
    const created = await payload.create({
      collection: 'categories',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { title: spec.title, slug: spec.slug, tenant: tenantId } as any,
      depth: 0,
      overrideAccess: true,
    })
    ids[spec.key] = created.id
    createdSlugs.push(spec.slug)
  }

  return { ids, createdSlugs }
}

async function setupClearwaterNav(payload: Payload, tenantId: number | string) {
  const { ids: categories, createdSlugs } = await findOrCreateClearwaterCategories(
    payload,
    tenantId,
  )

  const videosPage = await upsertTenantPage(payload, tenantId, 'videos', {
    title: 'Videos',
    _status: 'published',
    showInNav: false,
    hero: { type: 'none' },
    layout: [
      {
        blockType: 'archive',
        blockName: "Clearwater Cruisin' Video Archive",
        populateBy: 'collection',
        relationTo: 'posts',
        categories: [
          categories.videos,
          categories.shorts,
          categories.live,
          categories.vlog,
          categories.theDetour,
          categories.membersOnly,
        ],
        limit: 12,
        columns: '3',
        enableSearch: true,
        enableCategoryTabs: true,
        enablePagination: true,
        introContent: createLexicalContent([
          createHeadingNode("Clearwater Cruisin' Videos", 'h2'),
          createParagraphNode(
            'Complete channel video archive — vlogs, shorts, live streams, The Detour reflections, and searchable full transcripts.',
          ),
        ]),
      },
    ],
    meta: {
      title: "Videos — Clearwater Cruisin' Ministries",
      description:
        "Browse the complete Clearwater Cruisin' YouTube video, shorts, and live stream archive with searchable transcripts.",
    },
  })

  const navLinkItem = (label: string, url: string) => ({
    link: { type: 'custom', newTab: false, label, url },
  })

  const headerNavItems = [
    { ...navLinkItem('Home', '/'), children: [] },
    {
      ...navLinkItem('Videos', '/videos'),
      children: [
        navLinkItem('All Videos', '/videos'),
        navLinkItem('Videos', '/videos?category=videos'),
        navLinkItem('Shorts', '/videos?category=shorts'),
        navLinkItem('Live Streams', '/videos?category=live'),
        navLinkItem('Video Log', '/videos?category=vlog'),
        navLinkItem('The Detour', '/videos?category=the-detour'),
        navLinkItem('Private & Members', '/videos?category=members-only'),
      ],
    },
    { ...navLinkItem('Posts', '/posts'), children: [] },
    { ...navLinkItem('Join the Crew', '/support'), children: [] },
    { ...navLinkItem('Shop', '/shop'), children: [] },
    { ...navLinkItem('Book Us', '/book'), children: [] },
    { ...navLinkItem('Contact', '/contact'), children: [] },
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
    createdCategorySlugs: createdSlugs,
    videosPage,
    header: { action: headerAction, id: headerId },
  }
}

function extractCategoryIds(
  cats: Array<number | string | { id?: number | string }> | null | undefined,
): Array<number | string> {
  return (Array.isArray(cats) ? cats : [])
    .map((c) => (c && typeof c === 'object' ? c.id : c))
    .filter((v): v is number | string => v !== null && v !== undefined)
}

async function tagExistingClearwaterPosts(payload: Payload, tenantId: number | string) {
  const { ids: categories } = await findOrCreateClearwaterCategories(payload, tenantId)

  const videoBucketIds = new Set([
    String(categories.videos),
    String(categories.shorts),
    String(categories.live),
    String(categories.membersOnly),
  ])
  const socialCatIdStr = String(categories.socialPosts)

  let page = 1
  let totalPages = 1
  let totalScanned = 0
  let taggedVideos = 0
  let taggedWrittenPosts = 0
  let alreadyCategorized = 0
  const skippedErrors: Array<{ id: number | string; error: string }> = []

  while (page <= totalPages && page <= 40) {
    const res = await payload.find({
      collection: 'posts',
      where: {
        and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }],
      },
      draft: false,
      limit: 200,
      page,
      depth: 0,
      sort: 'id',
      select: {
        sourceType: true,
        sourceUrl: true,
        categories: true,
      },
      overrideAccess: true,
    })
    totalPages = res.totalPages || 1

    for (const doc of res.docs as Array<{
      id: number | string
      sourceType?: string | null
      sourceUrl?: string | null
      categories?: Array<number | string | { id?: number | string }> | null
    }>) {
      totalScanned++
      const existingIds = extractCategoryIds(doc.categories)
      const existingStrSet = new Set(existingIds.map((id) => String(id)))

      const srcUrl = String(doc.sourceUrl || '').trim()
      const isVideoPost =
        doc.sourceType === 'youtube' ||
        doc.sourceType === 'vimeo' ||
        Boolean(srcUrl && extractYouTubeVideoId(srcUrl))

      if (isVideoPost) {
        const hasVideoBucket = existingIds.some((id) => videoBucketIds.has(String(id)))
        if (hasVideoBucket) {
          alreadyCategorized++
          continue
        }
        try {
          await payload.update({
            collection: 'posts',
            id: doc.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { categories: [...existingIds, categories.videos] } as any,
            draft: false,
            depth: 0,
            overrideAccess: true,
            context: { disableRevalidate: true, disableTranscriptIndex: true },
          })
          taggedVideos++
        } catch (err) {
          skippedErrors.push({
            id: doc.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      } else {
        if (existingStrSet.has(socialCatIdStr)) {
          alreadyCategorized++
          continue
        }
        try {
          await payload.update({
            collection: 'posts',
            id: doc.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { categories: [...existingIds, categories.socialPosts] } as any,
            draft: false,
            depth: 0,
            overrideAccess: true,
            context: { disableRevalidate: true, disableTranscriptIndex: true },
          })
          taggedWrittenPosts++
        } catch (err) {
          skippedErrors.push({
            id: doc.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
    page++
  }

  return {
    totalScanned,
    taggedVideos,
    taggedWrittenPosts,
    alreadyCategorized,
    skippedErrors,
  }
}

export const provisionClearwaterPortalHandler: PayloadHandler = async (req) => {
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

  const setupNavParam = url.searchParams.get('setupNav')
  const tagExistingParam = url.searchParams.get('tagExisting')
  const wantSetupNav = setupNavParam === '1' || setupNavParam === 'true'
  const wantTagExisting = tagExistingParam === '1' || tagExistingParam === 'true'
  const runBoth = !wantSetupNav && !wantTagExisting

  try {
    const tenant = await resolveClearwaterTenant(payload)
    if (!tenant) {
      return Response.json(
        { ok: false, error: `tenant '${CLEARWATER_SLUG}' not found` },
        { status: 404 },
      )
    }

    const result: Record<string, unknown> = {
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, domain: CLEARWATER_DOMAIN },
    }

    if (runBoth || wantSetupNav) {
      result.nav = await setupClearwaterNav(payload, tenant.id)
    }

    if (runBoth || wantTagExisting) {
      result.tagging = await tagExistingClearwaterPosts(payload, tenant.id)
    }

    return Response.json(result)
  } catch (err) {
    console.error('[Provision Clearwater Portal] Error:', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Provisioning failed' },
      { status: 500 },
    )
  }
}
