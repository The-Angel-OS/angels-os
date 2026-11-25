/**
 * YouTube Channel Resolver — zero-API-key public channel profile & RSS video lookup.
 *
 * Powers the 60-second creator onboarding flow (`/start` → `/api/portal-ops/youtube-preview`
 * and `/api/portal-ops/self-provision`). Accepts `@handle`, `https://youtube.com/@handle`,
 * `https://youtube.com/channel/UC...`, `https://youtube.com/c/...`, or raw `UC...` IDs.
 *
 * Strategy:
 *   1. Normalize input into a canonical YouTube channel URL + suggested handle.
 *   2. Fetch the public YouTube channel page (with short timeout) to extract:
 *      - `channelId` (UC...)
 *      - `title` (`og:title` / `<title>`)
 *      - `description` (`og:description` / meta description)
 *      - `avatarUrl` (`og:image`)
 *      - `bannerUrl` (from `ytInitialData` banner thumbnails, when present)
 *   3. Fetch up to `videoLimit` recent public videos via YouTube's public RSS feed
 *      (`fetchYouTubeChannelFeed`), requiring zero YouTube Data API quota.
 */
import {
  extractChannelId,
  fetchYouTubeChannelFeed,
  type YouTubeChannelFeedEntry,
} from './youtubeMetadata'

export interface ParsedYouTubeChannelInput {
  raw: string
  channelId: string | null
  handle: string | null
  fetchUrl: string | null
  suggestedSlug: string
}

export interface ResolvedYouTubeChannel {
  channelId: string | null
  handle: string
  title: string
  tagline: string
  description: string
  avatarUrl: string | null
  bannerUrl: string | null
  canonicalUrl: string
  recentVideos: YouTubeChannelFeedEntry[]
}

const CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/

/** Convert any string into a valid Angel OS portal handle slug (3-32 chars). */
export function normalizeYouTubeHandle(input: string): string {
  const cleaned = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return cleaned
}

/**
 * Parse a user-entered YouTube URL, `@handle`, or `UC...` channel ID.
 */
export function parseYouTubeChannelInput(rawInput: string): ParsedYouTubeChannelInput {
  const raw = String(rawInput || '').trim()
  if (!raw) {
    return { raw: '', channelId: null, handle: null, fetchUrl: null, suggestedSlug: '' }
  }

  // 1. Direct UC channel ID or /channel/UC...
  const directId = extractChannelId(raw)
  if (directId) {
    return {
      raw,
      channelId: directId,
      handle: null,
      fetchUrl: `https://www.youtube.com/channel/${directId}`,
      suggestedSlug: '',
    }
  }

  // 2. Full URL with @handle, /c/name, or /user/name
  const handleUrlMatch = raw.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i)
  if (handleUrlMatch) {
    const h = handleUrlMatch[1]
    return {
      raw,
      channelId: null,
      handle: `@${h}`,
      fetchUrl: `https://www.youtube.com/@${encodeURIComponent(h)}`,
      suggestedSlug: normalizeYouTubeHandle(h),
    }
  }

  const customUrlMatch = raw.match(/youtube\.com\/(?:c|user)\/([a-zA-Z0-9._-]+)/i)
  if (customUrlMatch) {
    const slug = customUrlMatch[1]
    return {
      raw,
      channelId: null,
      handle: slug,
      fetchUrl: `https://www.youtube.com/c/${encodeURIComponent(slug)}`,
      suggestedSlug: normalizeYouTubeHandle(slug),
    }
  }

  // 3. Bare @handle or plain handle text (no spaces/slashes)
  const bare = raw.replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/\/.*$/, '')
  if (bare.startsWith('@')) {
    const h = bare.slice(1).replace(/[^a-zA-Z0-9._-]/g, '')
    if (h) {
      return {
        raw,
        channelId: null,
        handle: `@${h}`,
        fetchUrl: `https://www.youtube.com/@${encodeURIComponent(h)}`,
        suggestedSlug: normalizeYouTubeHandle(h),
      }
    }
  }

  if (/^[a-zA-Z0-9._-]{2,64}$/.test(bare)) {
    return {
      raw,
      channelId: null,
      handle: `@${bare}`,
      fetchUrl: `https://www.youtube.com/@${encodeURIComponent(bare)}`,
      suggestedSlug: normalizeYouTubeHandle(bare),
    }
  }

  return {
    raw,
    channelId: null,
    handle: null,
    fetchUrl: null,
    suggestedSlug: normalizeYouTubeHandle(raw),
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string | null {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re1 = new RegExp(
    `<meta[^>]+${attrName}=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
    'i',
  )
  const m1 = html.match(re1)
  if (m1?.[1]) return decodeHtmlEntities(m1[1].trim())

  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attrName}=["']${escaped}["']`,
    'i',
  )
  const m2 = html.match(re2)
  if (m2?.[1]) return decodeHtmlEntities(m2[1].trim())

  return null
}

/**
 * Pure parser for public YouTube channel HTML pages.
 * Extracts channelId, title, description, avatarUrl, bannerUrl, and canonicalUrl.
 */
export function extractChannelMetaFromHtml(html: string): {
  channelId: string | null
  title: string | null
  description: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  canonicalUrl: string | null
} {
  if (!html) {
    return {
      channelId: null,
      title: null,
      description: null,
      avatarUrl: null,
      bannerUrl: null,
      canonicalUrl: null,
    }
  }

  // Channel ID: canonical link, meta itemprop="identifier", or externalId/browseId in JSON
  const idPatterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})["']/i,
    /<meta[^>]+itemprop=["']identifier["'][^>]+content=["'](UC[a-zA-Z0-9_-]{22})["']/i,
    /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
    /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
  ]
  let channelId: string | null = null
  for (const re of idPatterns) {
    const m = html.match(re)
    if (m?.[1] && CHANNEL_ID_RE.test(m[1])) {
      channelId = m[1]
      break
    }
  }

  const ogTitle = extractMetaContent(html, 'property', 'og:title')
  const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i)
  const rawTitle = ogTitle || (titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1]) : null)
  const title = rawTitle ? rawTitle.replace(/\s*-\s*YouTube\s*$/i, '').trim() : null

  const description =
    extractMetaContent(html, 'property', 'og:description') ||
    extractMetaContent(html, 'name', 'description')

  const avatarUrl = extractMetaContent(html, 'property', 'og:image')

  // Banner image from ytInitialData (optional)
  const bannerMatch = html.match(
    /"banner"\s*:\s*\{[\s\S]{0,600}?"url"\s*:\s*"(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/,
  )
  const bannerUrl = bannerMatch?.[1] ? bannerMatch[1].replace(/\\u0026/g, '&') : null

  const canonicalMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["'](https:\/\/www\.youtube\.com\/[^"']+)["']/i,
  )
  const canonicalUrl = canonicalMatch?.[1] || null

  return { channelId, title, description, avatarUrl, bannerUrl, canonicalUrl }
}

/** Build a crisp 1-line tagline from a longer YouTube bio. */
export function buildTaglineFromDescription(description: string | null, fallbackTitle: string): string {
  const cleaned = (description || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) {
    return `${fallbackTitle} — Videos, Storefront & Community`
  }
  // Take first sentence if reasonable, otherwise trim cleanly at 130 chars
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned
  if (firstSentence.length >= 16 && firstSentence.length <= 135) {
    return firstSentence
  }
  return cleaned.length > 135 ? `${cleaned.slice(0, 132).trimEnd()}...` : cleaned
}

/**
 * Resolve a YouTube channel URL / `@handle` / `UC...` ID into profile metadata + recent RSS videos.
 * Never throws — returns best-effort metadata if YouTube blocks or times out.
 */
export async function resolveYouTubeChannel(
  input: string,
  opts: { videoLimit?: number; timeoutMs?: number } = {},
): Promise<ResolvedYouTubeChannel | null> {
  const parsed = parseYouTubeChannelInput(input)
  if (!parsed.fetchUrl && !parsed.channelId) return null

  const videoLimit = Math.min(Math.max(opts.videoLimit ?? 8, 0), 15)
  const timeoutMs = opts.timeoutMs ?? 6000

  let channelId = parsed.channelId
  let title: string | null = null
  let description: string | null = null
  let avatarUrl: string | null = null
  let bannerUrl: string | null = null
  let canonicalUrl = parsed.fetchUrl || (channelId ? `https://www.youtube.com/channel/${channelId}` : '')

  if (parsed.fetchUrl) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(parsed.fetchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      if (res.ok) {
        const html = await res.text()
        const meta = extractChannelMetaFromHtml(html)
        if (!channelId && meta.channelId) channelId = meta.channelId
        if (meta.title) title = meta.title
        if (meta.description) description = meta.description
        if (meta.avatarUrl) avatarUrl = meta.avatarUrl
        if (meta.bannerUrl) bannerUrl = meta.bannerUrl
        if (meta.canonicalUrl) canonicalUrl = meta.canonicalUrl
      }
    } catch {
      // Fail soft: fall through to RSS / parsed handle
    } finally {
      clearTimeout(timer)
    }
  }

  let recentVideos: YouTubeChannelFeedEntry[] = []
  if (channelId && videoLimit > 0) {
    recentVideos = await fetchYouTubeChannelFeed(channelId, videoLimit)
    if (!title && recentVideos[0]?.channelName) {
      title = recentVideos[0].channelName
    }
  }

  const fallbackName =
    title ||
    (parsed.handle ? parsed.handle.replace(/^@/, '') : null) ||
    parsed.suggestedSlug ||
    'Creator Channel'

  const handle =
    parsed.suggestedSlug ||
    normalizeYouTubeHandle(fallbackName) ||
    'creator-portal'

  return {
    channelId,
    handle,
    title: fallbackName,
    tagline: buildTaglineFromDescription(description, fallbackName),
    description: description || `${fallbackName} — Official Creator Portal on Angel OS.`,
    avatarUrl,
    bannerUrl,
    canonicalUrl,
    recentVideos,
  }
}
