/**
 * Clearwater Cruisin' YouTube Channel Mirror & Transcript Importer
 * GET/POST /api/provision-ops/ingest-clearwater-youtube
 *
 * Mirrors all media from Clearwater Cruisin' (`@ClearwaterCruisin`,
 * `UCdOAHfkg7LcKLlzpD8Spydw`) onto `clearwater-cruisin.spacesangels.com`
 * (`Videos`, `Shorts`, `Live Streams`, and Community `Posts`), attaching
 * collapsible `Transcript` blocks and indexing chunks into `post_transcript_chunks`.
 *
 * Pre-wired for Step 2 (authenticated OAuth `clearwatercruisin@gmail.com` sync
 * for private videos with `access: 'members'` and category `members-only`).
 *
 * Modes (`?mode=` or JSON `body.mode`):
 *   - `status` (default): counts across categories, transcripts, and RAG chunks
 *   - `list-pending-transcripts`: returns pending `{ postId, slug, title, videoId, sourceUrl }[]` (up to 2500)
 *   - `sync-media`: imports public items from `videos`, `shorts`, `streams`, `community`
 *   - `push-media`: accepts pre-scraped items via POST JSON (residential-IP push)
 *   - `backfill-transcripts`: fetches captions for pending video posts in batches
 *   - `push-transcripts`: accepts pre-fetched transcripts via POST JSON (residential-IP push)
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> OR Authorization: Bearer <CRON_SECRET>.
 */
import type { Payload, PayloadHandler } from 'payload'
import {
  createHeadingNode,
  createLexicalContent,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'
import {
  countTranscriptWords,
  deriveDurationLabel,
  extractYouTubeVideoId,
  normalizeTranscriptSegments,
  type TranscriptSegment,
} from '@/utilities/transcriptUtils'
import {
  browseYouTubeChannelTab,
  fetchYouTubeTranscript,
} from '@/utilities/youtubeTranscripts'
import { indexPostTranscripts } from '@/utilities/transcriptRag'

const CLEARWATER_SLUG = 'clearwater-cruisin'
const CLEARWATER_CHANNEL_ID = 'UCdOAHfkg7LcKLlzpD8Spydw'

export interface PushMediaItemInput {
  kind: 'video' | 'short' | 'live' | 'community'
  videoId?: string
  postId?: string
  title?: string
  description?: string
  url?: string
  publishedAt?: string
  publishedText?: string
  durationLabel?: string
  imageUrls?: string[]
  categorySlug?: string
  isMembersOnly?: boolean
  access?: 'public' | 'authenticated' | 'members' | 'good_standing'
  privacyStatus?: 'public' | 'unlisted' | 'private'
}

export interface PushTranscriptItemInput {
  postId?: number | string
  videoId: string
  status: 'ok' | 'members_only' | 'no_captions'
  publishedAt?: string
  transcript?: {
    heading?: string
    videoUrl?: string
    sourceLabel?: string
    language?: string
    wordCount?: number
    durationLabel?: string | null
    segments?: TranscriptSegment[]
    fullText?: string
  }
}

interface ClearwaterContext {
  tenantId: number | string
  categoriesBySlug: Map<string, number | string>
  transcriptPostIds: Set<number>
  posts: Array<{
    id: number
    slug: string
    title: string
    sourceUrl: string
    sourceType: string
    categoryIds: Array<number | string>
    videoId: string | null
    transcriptStatus?: string
    hasTranscript: boolean
  }>
  existingVideoIds: Set<string>
  existingSourceUrls: Set<string>
  existingSlugs: Set<string>
}

function toKebabSlug(title: string, suffix: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
    .replace(/-+$/, '')
  return base ? `${base}-${suffix}` : suffix
}

function inferCommunityTitle(text: string, postId: string): string {
  const firstLine = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean)
  if (!firstLine) return `Clearwater Cruisin' Update (${postId.slice(-6)})`
  if (firstLine.length <= 84) return firstLine
  const cut = firstLine.slice(0, 81)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}…`
}

function normalizePublishedAt(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Convert YouTube browse relative timestamps (e.g. "Streamed 2 months ago",
 * "4 hours ago", "3 years ago") into approximate chronological ISO timestamps.
 */
function parseRelativePublishedText(publishedText?: string): string {
  const now = Date.now()
  if (!publishedText || typeof publishedText !== 'string') {
    return new Date(now).toISOString()
  }
  const cleaned = publishedText
    .replace(/^(?:streamed|premiered|scheduled for)\s+/i, '')
    .trim()
    .toLowerCase()

  if (!cleaned || cleaned === 'just now') return new Date(now).toISOString()
  if (cleaned === 'yesterday') return new Date(now - 86_400_000).toISOString()

  const match = cleaned.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/)
  if (!match) return new Date(now).toISOString()

  const qty = Number.parseInt(match[1], 10)
  const unit = match[2]
  if (!Number.isFinite(qty) || qty < 0) return new Date(now).toISOString()

  const unitMs: Record<string, number> = {
    second: 1_000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,
    year: 365 * 86_400_000,
  }
  return new Date(now - qty * (unitMs[unit] || 0)).toISOString()
}

async function uploadRemoteImageToMedia(
  payload: Payload,
  imageUrl: string,
  filenameBase: string,
  altText: string,
  tenantId: number | string,
): Promise<number | string | null> {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return null
  const filename = `${filenameBase}.jpg`
  try {
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.[0]?.id) return existing.docs[0].id

    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 800) return null

    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: altText.slice(0, 140),
        tenant: Number(tenantId),
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      file: {
        data: buf,
        mimetype: mime.startsWith('image/') ? mime : 'image/jpeg',
        name: filename,
        size: buf.byteLength,
      },
      overrideAccess: true,
    })
    return created?.id ?? null
  } catch {
    return null
  }
}

async function loadClearwaterContext(payload: Payload): Promise<ClearwaterContext | null> {
  const tRes = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: CLEARWATER_SLUG } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenantId = tRes.docs?.[0]?.id
  if (tenantId == null) return null

  const catRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenantId } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const categoriesBySlug = new Map<string, number | string>()
  for (const c of catRes.docs as Array<{ id: number | string; slug?: string }>) {
    if (c.slug) categoriesBySlug.set(c.slug, c.id)
  }

  // Fast SQL scan for which posts already carry a transcript block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  const transcriptPostIds = new Set<number>()
  if (pool?.query) {
    try {
      const trRes = await pool.query(
        `SELECT DISTINCT bt."_parent_id" AS post_id
         FROM "posts_blocks_transcript" bt
         INNER JOIN "posts" p ON p."id" = bt."_parent_id"
         WHERE p."tenant_id" = $1`,
        [Number(tenantId)],
      )
      for (const row of (trRes.rows || []) as Array<{ post_id: number | string }>) {
        transcriptPostIds.add(Number(row.post_id))
      }
    } catch {
      // Non-fatal fallback
    }
  }

  const allPosts: ClearwaterContext['posts'] = []
  const existingVideoIds = new Set<string>()
  const existingSourceUrls = new Set<string>()
  const existingSlugs = new Set<string>()

  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= 40) {
    const res = await payload.find({
      collection: 'posts',
      where: { tenant: { equals: tenantId } },
      limit: 200,
      page,
      depth: 0,
      sort: '-id',
      select: {
        title: true,
        slug: true,
        sourceUrl: true,
        sourceType: true,
        categories: true,
        geo: true,
      },
      overrideAccess: true,
    })
    totalPages = res.totalPages || 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const doc of res.docs as any[]) {
      const id = Number(doc.id)
      const slug = String(doc.slug || '')
      const sourceUrl = String(doc.sourceUrl || '').trim()
      const videoId = sourceUrl ? extractYouTubeVideoId(sourceUrl) : null
      const categoryIds = (Array.isArray(doc.categories) ? doc.categories : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => (c && typeof c === 'object' ? c.id : c))
        .filter((v: unknown): v is number | string => v !== null && v !== undefined)
      const metaObj =
        doc.geo?.meta && typeof doc.geo.meta === 'object'
          ? (doc.geo.meta as Record<string, unknown>)
          : undefined
      const transcriptStatus =
        typeof metaObj?.transcriptStatus === 'string' ? metaObj.transcriptStatus : undefined

      if (slug) existingSlugs.add(slug)
      if (sourceUrl) existingSourceUrls.add(sourceUrl)
      if (videoId) existingVideoIds.add(videoId)

      allPosts.push({
        id,
        slug,
        title: String(doc.title || ''),
        sourceUrl,
        sourceType: String(doc.sourceType || ''),
        categoryIds,
        videoId,
        transcriptStatus,
        hasTranscript: transcriptPostIds.has(id),
      })
    }
    page++
  }

  return {
    tenantId,
    categoriesBySlug,
    transcriptPostIds,
    posts: allPosts,
    existingVideoIds,
    existingSourceUrls,
    existingSlugs,
  }
}

async function createClearwaterMediaPost(
  payload: Payload,
  ctx: ClearwaterContext,
  item: PushMediaItemInput,
): Promise<{ created: boolean; reason?: string; postId?: number | string; slug?: string }> {
  if (item.isMembersOnly && item.access !== 'members') {
    return { created: false, reason: 'members_only' }
  }

  if (item.kind === 'community') {
    const postIdRaw = (item.postId || '').trim()
    const sourceUrl = (
      item.url || (postIdRaw ? `https://www.youtube.com/post/${postIdRaw}` : '')
    ).trim()
    if (!sourceUrl) return { created: false, reason: 'missing_url' }
    if (ctx.existingSourceUrls.has(sourceUrl)) {
      return { created: false, reason: 'duplicate' }
    }

    const socialCatId = ctx.categoriesBySlug.get('social-posts')
    const bodyText = (item.description || '').trim()
    const title = (item.title || inferCommunityTitle(bodyText, postIdRaw || 'post')).trim()
    const suffix =
      (postIdRaw || String(Date.now()))
        .slice(-10)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'post'
    let slug = toKebabSlug(`community-${title}`, suffix)
    if (ctx.existingSlugs.has(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

    const paragraphs = bodyText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)

    const contentNodes = [
      createHeadingNode(title, 'h2'),
      createParagraphNode(
        `Clearwater Cruisin' · YouTube Community Post${item.publishedText ? ` (${item.publishedText})` : ''} · Original post: ${sourceUrl}`,
      ),
      ...(paragraphs.length > 0
        ? paragraphs.map((p) => createParagraphNode(p))
        : [createParagraphNode("Original community post mirrored from Clearwater Cruisin' YouTube.")]),
    ]

    let metaImageId: number | string | null = null
    if (Array.isArray(item.imageUrls) && item.imageUrls[0]) {
      metaImageId = await uploadRemoteImageToMedia(
        payload,
        item.imageUrls[0],
        `yt-comm-${suffix}`,
        title,
        ctx.tenantId,
      )
    }

    const exactDate = normalizePublishedAt(item.publishedAt)
    const publishedOn = exactDate || parseRelativePublishedText(item.publishedText)

    const created = await payload.create({
      collection: 'posts',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        title,
        slug,
        _status: 'published',
        access: item.access || 'public',
        publishedOn,
        sourceType: 'manual',
        sourceUrl,
        tenant: ctx.tenantId,
        ...(socialCatId != null ? { categories: [socialCatId] } : {}),
        layout: [
          {
            blockType: 'content',
            columns: [{ size: 'full', richText: createLexicalContent(contentNodes) }],
          },
          {
            blockType: 'comments',
            blockName: 'Community Discussion',
          },
        ],
        meta: {
          title: `${title} — Clearwater Cruisin'`,
          description: (bodyText || title).slice(0, 155),
          ...(metaImageId != null ? { image: metaImageId } : {}),
        },
      } as any,
      draft: false,
      depth: 0,
      overrideAccess: true,
      context: { disableRevalidate: true, disableTranscriptIndex: true },
    })

    ctx.existingSourceUrls.add(sourceUrl)
    ctx.existingSlugs.add(slug)
    return { created: true, postId: created.id, slug }
  }

  // Video, Short, or Live Stream
  const videoId =
    (item.videoId && /^[a-zA-Z0-9_-]{11}$/.test(item.videoId.trim()) ? item.videoId.trim() : null) ||
    (item.url ? extractYouTubeVideoId(item.url) : null)

  if (!videoId) return { created: false, reason: 'missing_video_id' }
  if (ctx.existingVideoIds.has(videoId)) return { created: false, reason: 'duplicate' }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
  if (ctx.existingSourceUrls.has(canonicalUrl)) return { created: false, reason: 'duplicate' }

  const title = (item.title || `Clearwater Cruisin' Video (${videoId})`).trim()
  const inferredCatSlug =
    item.categorySlug ||
    (item.privacyStatus === 'private'
      ? 'members-only'
      : item.kind === 'short'
        ? 'shorts'
        : item.kind === 'live'
          ? 'live'
          : 'videos')

  const catId = ctx.categoriesBySlug.get(inferredCatSlug) ?? ctx.categoriesBySlug.get('videos')

  let slug = toKebabSlug(title, videoId.slice(0, 6).toLowerCase())
  if (ctx.existingSlugs.has(slug)) slug = `${slug}-${videoId.slice(-4).toLowerCase()}`

  const kindLabel =
    item.kind === 'short'
      ? "Clearwater Cruisin' Short"
      : item.kind === 'live'
        ? "Clearwater Cruisin' Live Stream"
        : "Clearwater Cruisin' Video"

  const metaLine = [
    kindLabel,
    item.durationLabel ? `Duration: ${item.durationLabel}` : null,
    item.publishedText ? `Published: ${item.publishedText}` : null,
    `Watch on YouTube: ${canonicalUrl}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const descParagraphs = (item.description || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => createParagraphNode(p))

  const contentNodes = [
    createHeadingNode(title, 'h2'),
    createParagraphNode(metaLine),
    ...descParagraphs,
  ]

  const exactDate = normalizePublishedAt(item.publishedAt)
  const publishedOn = exactDate || parseRelativePublishedText(item.publishedText)
  const publishedApproximate = !exactDate
  const geoMeta: Record<string, unknown> = {}
  if (publishedApproximate) geoMeta.publishedApproximate = true
  if (item.privacyStatus) geoMeta.youtubePrivacy = item.privacyStatus

  const created = await payload.create({
    collection: 'posts',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      title,
      slug,
      _status: 'published',
      access: item.access || (item.privacyStatus === 'private' ? 'members' : 'public'),
      publishedOn,
      sourceType: 'youtube',
      sourceUrl: canonicalUrl,
      tenant: ctx.tenantId,
      ...(catId != null ? { categories: [catId] } : {}),
      ...(Object.keys(geoMeta).length > 0 ? { geo: { meta: geoMeta } } : {}),
      layout: [
        {
          blockType: 'content',
          columns: [{ size: 'full', richText: createLexicalContent(contentNodes) }],
        },
        {
          blockType: 'comments',
          blockName: 'Video Discussion',
        },
      ],
    } as any,
    draft: false,
    depth: 0,
    overrideAccess: true,
    context: { disableRevalidate: true, disableTranscriptIndex: true },
  })

  ctx.existingVideoIds.add(videoId)
  ctx.existingSourceUrls.add(canonicalUrl)
  ctx.existingSlugs.add(slug)
  return { created: true, postId: created.id, slug }
}

async function attachTranscriptToPost(
  payload: Payload,
  postId: number | string,
  payloadInput: {
    status: 'ok' | 'members_only' | 'no_captions'
    publishedAt?: string
    transcript?: PushTranscriptItemInput['transcript']
  },
): Promise<{ updated: boolean; reason?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (await payload.findByID({
    collection: 'posts',
    id: postId,
    depth: 0,
    overrideAccess: true,
  })) as any

  if (!doc) return { updated: false, reason: 'post_not_found' }

  const exactDate = normalizePublishedAt(payloadInput.publishedAt)
  const currentGeo = doc.geo && typeof doc.geo === 'object' ? doc.geo : {}
  const currentMeta =
    currentGeo.meta && typeof currentGeo.meta === 'object' ? currentGeo.meta : {}
  const shouldUpdateDate = Boolean(
    exactDate && (!doc.publishedOn || currentMeta.publishedApproximate === true),
  )

  if (payloadInput.status === 'members_only' || payloadInput.status === 'no_captions') {
    const nextMeta = {
      ...currentMeta,
      transcriptStatus: payloadInput.status,
      ...(shouldUpdateDate ? { publishedApproximate: false } : {}),
    }
    await payload.update({
      collection: 'posts',
      id: postId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...(shouldUpdateDate ? { publishedOn: exactDate } : {}),
        ...(doc.meta?.image ? { meta: doc.meta } : {}),
        geo: {
          ...currentGeo,
          meta: nextMeta,
        },
      } as any,
      draft: false,
      depth: 0,
      overrideAccess: true,
      context: { disableRevalidate: true, disableTranscriptIndex: true },
    })
    return { updated: true, reason: payloadInput.status }
  }

  const tr = payloadInput.transcript
  if (!tr) return { updated: false, reason: 'missing_transcript_payload' }

  const segments = normalizeTranscriptSegments(tr.segments, tr.fullText)
  if (segments.length === 0) return { updated: false, reason: 'empty_transcript' }

  const rawFullText =
    typeof tr.fullText === 'string' && tr.fullText.trim()
      ? tr.fullText
      : segments.map((s) => s.text).join('\n')
  const fullText = rawFullText.length > 39000 ? rawFullText.slice(0, 39000) : rawFullText

  const transcriptBlock = {
    blockType: 'transcript',
    blockName: 'Full Video Transcript',
    heading: tr.heading?.trim() || 'Full Video Transcript',
    videoUrl: tr.videoUrl || doc.sourceUrl || '',
    sourceLabel: tr.sourceLabel || 'YouTube Auto-Captions',
    language: tr.language || 'en',
    defaultCollapsed: true,
    enableSearch: true,
    wordCount:
      tr.wordCount && tr.wordCount > 0 ? tr.wordCount : countTranscriptWords(segments, fullText),
    durationLabel: tr.durationLabel || deriveDurationLabel(segments) || undefined,
    fullText,
    segments,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentLayout: any[] = Array.isArray(doc.layout)
    ? doc.layout.filter((b: { blockType?: string }) => b?.blockType !== 'transcript')
    : []

  if (currentLayout.length === 0) {
    currentLayout.push({
      blockType: 'content',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createHeadingNode(String(doc.title || "Clearwater Cruisin' Video"), 'h2'),
            createParagraphNode(
              doc.sourceUrl
                ? `Watch on YouTube: ${doc.sourceUrl}`
                : 'Video entry and full searchable transcript.',
            ),
          ]),
        },
      ],
    })
  }

  const commentsIdx = currentLayout.findIndex(
    (b: { blockType?: string }) => b?.blockType === 'comments',
  )
  if (commentsIdx >= 0) {
    currentLayout.splice(commentsIdx, 0, transcriptBlock)
  } else {
    currentLayout.push(transcriptBlock)
  }

  const nextMeta = shouldUpdateDate
    ? { ...currentMeta, publishedApproximate: false }
    : currentMeta

  const updatedDoc = await payload.update({
    collection: 'posts',
    id: postId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      _status: 'published',
      layout: currentLayout,
      ...(shouldUpdateDate ? { publishedOn: exactDate } : {}),
      ...(shouldUpdateDate ? { geo: { ...currentGeo, meta: nextMeta } } : {}),
      ...(doc.meta?.image ? { meta: doc.meta } : {}),
    } as any,
    draft: false,
    depth: 0,
    overrideAccess: true,
    context: { disableRevalidate: true, disableTranscriptIndex: true },
  })

  // Index RAG chunks explicitly after the posts update transaction commits
  try {
    await indexPostTranscripts(payload, updatedDoc, doc, { force: true })
  } catch (err) {
    payload.logger?.warn?.(
      { err, postId },
      '[ingest-clearwater-youtube] post-update transcript indexing warning',
    )
  }

  return { updated: true }
}

export const ingestClearwaterYoutubeHandler: PayloadHandler = async (req) => {
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

  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    try {
      body = (await req.json?.()) || {}
    } catch {
      body = {}
    }
  }

  const mode = String(url.searchParams.get('mode') || body.mode || 'status').trim()

  try {
    const ctx = await loadClearwaterContext(payload)
    if (!ctx) {
      return Response.json(
        { ok: false, error: `tenant '${CLEARWATER_SLUG}' not found` },
        { status: 404 },
      )
    }

    // ── 1. STATUS ────────────────────────────────────────────────────────────
    if (mode === 'status') {
      const catCounts: Record<string, number> = {}
      for (const [slug, cid] of ctx.categoriesBySlug.entries()) {
        catCounts[slug] = ctx.posts.filter((p) =>
          p.categoryIds.some((id) => String(id) === String(cid)),
        ).length
      }

      const videoPosts = ctx.posts.filter((p) => Boolean(p.videoId))
      const withTranscript = videoPosts.filter((p) => p.hasTranscript).length
      const skippedStatus = videoPosts.filter(
        (p) =>
          !p.hasTranscript &&
          (p.transcriptStatus === 'members_only' || p.transcriptStatus === 'no_captions'),
      ).length
      const pendingTranscript = videoPosts.length - withTranscript - skippedStatus

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = (payload.db as any)?.pool
      let ragChunksCount = 0
      if (pool?.query) {
        try {
          const r = await pool.query(
            `SELECT count(*)::int AS n FROM "post_transcript_chunks" WHERE "tenant_id" = $1`,
            [Number(ctx.tenantId)],
          )
          ragChunksCount = Number(r.rows?.[0]?.n ?? 0)
        } catch {
          ragChunksCount = 0
        }
      }

      return Response.json({
        ok: true,
        mode: 'status',
        tenantId: ctx.tenantId,
        totalPosts: ctx.posts.length,
        categoryCounts: catCounts,
        videos: {
          totalVideoPosts: videoPosts.length,
          withTranscript,
          skippedMembersOnlyOrNoCaptions: skippedStatus,
          pendingTranscript,
        },
        ragChunksCount,
      })
    }

    // ── 2. LIST PENDING TRANSCRIPTS ──────────────────────────────────────────
    if (mode === 'list-pending-transcripts') {
      const limit = Math.max(
        1,
        Math.min(2500, Number(url.searchParams.get('limit') || body.limit || 500)),
      )
      const categoryFilter = String(url.searchParams.get('category') || body.category || 'all')
      const filterCatId =
        categoryFilter !== 'all' ? ctx.categoriesBySlug.get(categoryFilter) : undefined

      const pending = ctx.posts
        .filter((p) => {
          if (!p.videoId || p.hasTranscript) return false
          if (p.transcriptStatus === 'members_only' || p.transcriptStatus === 'no_captions') {
            return false
          }
          if (
            filterCatId != null &&
            !p.categoryIds.some((id) => String(id) === String(filterCatId))
          ) {
            return false
          }
          return true
        })
        .slice(0, limit)
        .map((p) => ({
          postId: p.id,
          slug: p.slug,
          title: p.title,
          videoId: p.videoId!,
          sourceUrl: p.sourceUrl,
        }))

      return Response.json({
        ok: true,
        mode: 'list-pending-transcripts',
        count: pending.length,
        items: pending,
      })
    }

    // ── 3. SYNC MEDIA (Cloud pull) ───────────────────────────────────────────
    if (mode === 'sync-media') {
      const sourcesRaw = String(
        url.searchParams.get('sources') || body.sources || 'videos,shorts,streams,community',
      )
      const sources = new Set(
        sourcesRaw
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      )
      const limit = Math.max(
        1,
        Math.min(60, Number(url.searchParams.get('limit') || body.limit || 25)),
      )

      const candidates: PushMediaItemInput[] = []
      let skippedExisting = 0
      let skippedMembersOnly = 0
      const sourceDiagnostics: Record<string, number> = {}

      if (sources.has('videos')) {
        const res = await browseYouTubeChannelTab(CLEARWATER_CHANNEL_ID, 'videos', {
          maxPages: 60,
        })
        skippedMembersOnly += res.membersOnlySkipped
        let newCount = 0
        for (const v of res.items) {
          if (ctx.existingVideoIds.has(v.videoId)) {
            skippedExisting++
            continue
          }
          newCount++
          candidates.push({
            kind: 'video',
            videoId: v.videoId,
            title: v.title,
            url: v.url,
            durationLabel: v.durationLabel,
            publishedText: v.publishedText,
            categorySlug: 'videos',
          })
        }
        sourceDiagnostics.videosFetched = res.items.length
        sourceDiagnostics.videosNew = newCount
      }

      if (sources.has('shorts')) {
        const res = await browseYouTubeChannelTab(CLEARWATER_CHANNEL_ID, 'shorts', {
          maxPages: 30,
        })
        skippedMembersOnly += res.membersOnlySkipped
        let newCount = 0
        for (const v of res.items) {
          if (ctx.existingVideoIds.has(v.videoId)) {
            skippedExisting++
            continue
          }
          newCount++
          candidates.push({
            kind: 'short',
            videoId: v.videoId,
            title: v.title,
            url: v.url,
            categorySlug: 'shorts',
          })
        }
        sourceDiagnostics.shortsFetched = res.items.length
        sourceDiagnostics.shortsNew = newCount
      }

      if (sources.has('streams')) {
        const res = await browseYouTubeChannelTab(CLEARWATER_CHANNEL_ID, 'streams', {
          maxPages: 30,
        })
        skippedMembersOnly += res.membersOnlySkipped
        let newCount = 0
        for (const v of res.items) {
          if (ctx.existingVideoIds.has(v.videoId)) {
            skippedExisting++
            continue
          }
          newCount++
          candidates.push({
            kind: 'live',
            videoId: v.videoId,
            title: v.title,
            url: v.url,
            durationLabel: v.durationLabel,
            publishedText: v.publishedText,
            categorySlug: 'live',
          })
        }
        sourceDiagnostics.streamsFetched = res.items.length
        sourceDiagnostics.streamsNew = newCount
      }

      if (sources.has('community')) {
        const res = await browseYouTubeChannelTab(CLEARWATER_CHANNEL_ID, 'posts', {
          maxPages: 15,
        })
        skippedMembersOnly += res.membersOnlySkipped
        let newCount = 0
        for (const p of res.items) {
          if (ctx.existingSourceUrls.has(p.url)) {
            skippedExisting++
            continue
          }
          newCount++
          candidates.push({
            kind: 'community',
            postId: p.postId,
            url: p.url,
            description: p.text,
            publishedText: p.publishedText,
            imageUrls: p.imageUrls,
            categorySlug: 'social-posts',
          })
        }
        sourceDiagnostics.communityFetched = res.items.length
        sourceDiagnostics.communityNew = newCount
      }

      const slice = candidates.slice(0, limit)
      let created = 0
      const errors: Array<{ id?: string; error: string }> = []

      for (const item of slice) {
        try {
          const out = await createClearwaterMediaPost(payload, ctx, item)
          if (out.created) created++
          else if (out.reason === 'members_only') skippedMembersOnly++
          else if (out.reason === 'duplicate') skippedExisting++
        } catch (err) {
          errors.push({
            id: item.videoId || item.postId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return Response.json({
        ok: true,
        mode: 'sync-media',
        created,
        skippedExisting,
        skippedMembersOnly,
        remainingCandidates: Math.max(0, candidates.length - slice.length),
        sourceDiagnostics,
        errors,
      })
    }

    // ── 4. PUSH MEDIA (Residential fallback) ─────────────────────────────────
    if (mode === 'push-media') {
      const items = (Array.isArray(body.items) ? body.items : []) as PushMediaItemInput[]
      let created = 0
      let skippedExisting = 0
      let skippedMembersOnly = 0
      const errors: Array<{ id?: string; error: string }> = []

      for (const item of items) {
        try {
          const out = await createClearwaterMediaPost(payload, ctx, item)
          if (out.created) created++
          else if (out.reason === 'members_only') skippedMembersOnly++
          else if (out.reason === 'duplicate') skippedExisting++
        } catch (err) {
          errors.push({
            id: item.videoId || item.postId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return Response.json({
        ok: true,
        mode: 'push-media',
        received: items.length,
        created,
        skippedExisting,
        skippedMembersOnly,
        errors,
      })
    }

    // ── 5. BACKFILL TRANSCRIPTS (Cloud pull) ─────────────────────────────────
    if (mode === 'backfill-transcripts') {
      const limit = Math.max(
        1,
        Math.min(30, Number(url.searchParams.get('limit') || body.limit || 12)),
      )
      const categoryFilter = String(url.searchParams.get('category') || body.category || 'all')
      const filterCatId =
        categoryFilter !== 'all' ? ctx.categoriesBySlug.get(categoryFilter) : undefined

      const pending = ctx.posts.filter((p) => {
        if (!p.videoId || p.hasTranscript) return false
        if (p.transcriptStatus === 'members_only' || p.transcriptStatus === 'no_captions') {
          return false
        }
        if (
          filterCatId != null &&
          !p.categoryIds.some((id) => String(id) === String(filterCatId))
        ) {
          return false
        }
        return true
      })

      const batch = pending.slice(0, limit)
      let imported = 0
      let skippedMembersOnly = 0
      let skippedNoCaptions = 0
      let unavailable = 0
      const failures: Array<{ postId: number; videoId: string; reason: string }> = []
      const sample: Array<{
        postId: number
        slug: string
        wordCount: number
        durationLabel: string | null
      }> = []

      for (const p of batch) {
        const fetched = await fetchYouTubeTranscript(p.videoId!)
        if (fetched.status === 'ok') {
          const res = await attachTranscriptToPost(payload, p.id, {
            status: 'ok',
            publishedAt: fetched.publishedAt,
            transcript: {
              heading: 'Full Video Transcript',
              videoUrl: p.sourceUrl,
              sourceLabel: fetched.sourceLabel,
              language: fetched.language,
              wordCount: fetched.wordCount,
              durationLabel: fetched.durationLabel,
              segments: fetched.segments,
              fullText: fetched.fullText,
            },
          })
          if (res.updated) {
            imported++
            if (sample.length < 5) {
              sample.push({
                postId: p.id,
                slug: p.slug,
                wordCount: fetched.wordCount,
                durationLabel: fetched.durationLabel,
              })
            }
          }
        } else if (fetched.status === 'members_only') {
          await attachTranscriptToPost(payload, p.id, { status: 'members_only' })
          skippedMembersOnly++
        } else if (fetched.status === 'no_captions') {
          await attachTranscriptToPost(payload, p.id, {
            status: 'no_captions',
            publishedAt: fetched.publishedAt,
          })
          skippedNoCaptions++
        } else {
          unavailable++
          failures.push({ postId: p.id, videoId: p.videoId!, reason: fetched.reason })
        }
      }

      return Response.json({
        ok: true,
        mode: 'backfill-transcripts',
        processed: batch.length,
        imported,
        skippedMembersOnly,
        skippedNoCaptions,
        unavailable,
        remaining: Math.max(0, pending.length - batch.length),
        sample,
        failures,
      })
    }

    // ── 6. PUSH TRANSCRIPTS (Residential fallback) ───────────────────────────
    if (mode === 'push-transcripts') {
      const items = (Array.isArray(body.items) ? body.items : []) as PushTranscriptItemInput[]
      const postByVideoId = new Map<string, ClearwaterContext['posts'][number]>()
      for (const p of ctx.posts) {
        if (p.videoId) postByVideoId.set(p.videoId, p)
      }

      let updated = 0
      let skipped = 0
      const errors: Array<{ videoId?: string; postId?: number | string; error: string }> = []

      for (const item of items) {
        const targetId = item.postId ?? postByVideoId.get(item.videoId)?.id
        if (targetId == null) {
          skipped++
          continue
        }
        try {
          const out = await attachTranscriptToPost(payload, targetId, {
            status: item.status,
            publishedAt: item.publishedAt,
            transcript: item.transcript,
          })
          if (out.updated) updated++
          else skipped++
        } catch (err) {
          errors.push({
            videoId: item.videoId,
            postId: targetId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return Response.json({
        ok: true,
        mode: 'push-transcripts',
        received: items.length,
        updated,
        skipped,
        errors,
      })
    }

    return Response.json({ error: `Unknown mode '${mode}'` }, { status: 400 })
  } catch (err) {
    console.error('[ingest-clearwater-youtube] Error:', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
