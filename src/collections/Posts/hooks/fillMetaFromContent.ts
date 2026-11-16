import type { CollectionBeforeChangeHook } from 'payload'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'

/**
 * Fill in the SEO description from the post's own body when the author left it
 * blank — and trim the title while we're here.
 *
 * Also auto-fetches and uploads the YouTube video thumbnail into `Media` and
 * assigns `meta.image` when `sourceType === 'youtube'` (or `sourceUrl` is a
 * YouTube URL) and `meta.image` is blank, so YouTube posts always have a
 * thumbnail in post lists and Related Posts without manual screenshotting.
 *
 * @see src/collections/Posts/index.ts
 */

/** Meta descriptions are truncated by search engines around 160 characters. */
const MAX_DESCRIPTION = 155

/**
 * Download a YouTube video's thumbnail (trying maxresdefault -> hqdefault)
 * and store it in Payload's `media` collection (R2), returning the Media ID.
 */
export async function ensureYouTubeThumbnailMedia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  videoId: string,
  title: string,
  tenantId?: number | string | null,
): Promise<number | string | null> {
  if (!payload || !videoId) return null

  const filename = `yt-${videoId}.jpg`

  // 1. Reuse existing media doc if we already downloaded this video's thumbnail
  try {
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing?.docs?.[0]?.id) {
      return existing.docs[0].id
    }
  } catch {
    // Continue to download
  }

  // 2. Fetch thumbnail from YouTube (maxresdefault -> sddefault -> hqdefault)
  const candidateUrls = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ]

  let imageBuffer: Buffer | null = null
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer()
        if (arrayBuf.byteLength > 1000) {
          imageBuffer = Buffer.from(arrayBuf)
          break
        }
      }
    } catch {
      // Try next resolution
    }
  }

  if (!imageBuffer) return null

  // 3. Create Media document in Payload
  try {
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: title || `YouTube thumbnail (${videoId})`,
        ...(tenantId ? { tenant: typeof tenantId === 'object' ? (tenantId as { id: number }).id : Number(tenantId) } : {}),
      },
      file: {
        data: imageBuffer,
        mimetype: 'image/jpeg',
        name: filename,
        size: imageBuffer.byteLength,
      },
      overrideAccess: true,
    })
    return created?.id ?? null
  } catch {
    return null
  }
}

/**
 * Pull readable prose out of a Lexical richText tree.
 *
 * Depth-first over `children`, collecting `text` nodes. Deliberately structural
 * rather than a typed walk: the body is a blocks field holding several block
 * shapes, each with richText somewhere different, and a recursive scan handles
 * all of them without knowing any of their names.
 */
export function extractText(node: unknown, out: string[] = [], budget = 400): string[] {
  if (out.join(' ').length >= budget) return out
  if (Array.isArray(node)) {
    for (const child of node) extractText(child, out, budget)
    return out
  }
  if (!node || typeof node !== 'object') return out

  const n = node as Record<string, unknown>
  if (typeof n.text === 'string' && n.text.trim()) out.push(n.text.trim())
  for (const key of ['root', 'children', 'columns', 'richText', 'layout', 'content']) {
    if (n[key]) extractText(n[key], out, budget)
  }
  return out
}

/** First ~155 characters of real prose, cut at a word boundary. */
export function summarize(layout: unknown): string {
  const text = extractText(layout).join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= MAX_DESCRIPTION) return text

  const cut = text.slice(0, MAX_DESCRIPTION)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}

export const fillMetaFromContent: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

  if (typeof data.title === 'string') {
    const trimmed = data.title.trim()
    if (trimmed) data.title = trimmed
  }

  const meta = { ...((data.meta ?? {}) as Record<string, unknown>) }
  let metaChanged = false

  const existingDesc = typeof meta.description === 'string' ? meta.description.trim() : ''
  if (!existingDesc) {
    const summary = summarize(data.layout)
    if (summary) {
      meta.description = summary
      metaChanged = true
    }
  }

  // Auto-populate meta.image from YouTube thumbnail when blank
  if (!meta.image && typeof data.sourceUrl === 'string' && data.sourceUrl.trim()) {
    const embed = computeEmbedUrl(data.sourceUrl)
    if (embed.provider === 'youtube' && embed.videoId && req?.payload) {
      const mediaId = await ensureYouTubeThumbnailMedia(
        req.payload,
        embed.videoId,
        typeof data.title === 'string' ? data.title : embed.videoId,
        data.tenant,
      )
      if (mediaId) {
        meta.image = mediaId
        metaChanged = true
      }
    }
  }

  if (metaChanged) {
    data.meta = meta
  }

  return data
}
