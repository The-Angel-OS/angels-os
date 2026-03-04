/**
 * YouTube Metadata Extraction
 *
 * Fetches video metadata via YouTube's oEmbed API (no API key required)
 * and channel feeds via YouTube's public RSS endpoint.
 *
 * Used by LEO's `ingest_youtube_url` and `ingest_youtube_channel` tools
 * to auto-create Posts from video content.
 */

import { computeEmbedUrl } from './computeEmbedUrl'

// ─── Types ────────────────────────────────────────────────────────────────

export interface YouTubeVideoMeta {
  videoId: string
  title: string
  description: string
  thumbnailUrl: string
  channelName: string
  channelUrl: string
  embedUrl: string
  sourceUrl: string
  publishedAt?: string
  /** Duration in ISO 8601 (not available via oEmbed — requires API key) */
  duration?: string
}

export interface YouTubeChannelFeedEntry {
  videoId: string
  title: string
  sourceUrl: string
  publishedAt: string
  thumbnailUrl: string
  description: string
  channelName: string
  channelId: string
}

// ─── Single Video Metadata (oEmbed) ──────────────────────────────────────

/**
 * Fetch metadata for a single YouTube video via the oEmbed API.
 * No API key required. Returns null if the video is unavailable.
 */
export async function fetchYouTubeVideoMeta(
  url: string,
): Promise<YouTubeVideoMeta | null> {
  const embed = computeEmbedUrl(url)
  if (embed.provider !== 'youtube' || !embed.videoId) return null

  const videoId = embed.videoId
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'AngelOS/1.0 (Content Ingestion)' },
    })

    if (!res.ok) return null

    const data = (await res.json()) as Record<string, unknown>

    return {
      videoId,
      title: String(data.title || ''),
      description: '', // oEmbed doesn't include description
      thumbnailUrl:
        String(data.thumbnail_url || '') ||
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channelName: String(data.author_name || ''),
      channelUrl: String(data.author_url || ''),
      embedUrl: embed.embedUrl || `https://www.youtube.com/embed/${videoId}`,
      sourceUrl: canonicalUrl,
    }
  } catch {
    // Fallback — construct minimal metadata from the video ID
    return {
      videoId,
      title: '',
      description: '',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channelName: '',
      channelUrl: '',
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      sourceUrl: canonicalUrl,
    }
  }
}

// ─── Channel Feed (RSS) ──────────────────────────────────────────────────

/**
 * Extract a YouTube channel ID from various URL formats:
 *   - https://www.youtube.com/channel/UC...
 *   - https://www.youtube.com/@handle
 *   - https://www.youtube.com/c/ChannelName
 *   - Raw channel ID (UC...)
 */
export function extractChannelId(input: string): string | null {
  const trimmed = input.trim()

  // Direct channel ID
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) return trimmed

  // /channel/UC...
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/)
  if (channelMatch) return channelMatch[1]

  // /@handle — need to resolve via page scrape (return null, handle separately)
  // /c/Name — same
  return null
}

/**
 * Fetch recent videos from a YouTube channel's public RSS feed.
 * No API key required. Returns up to 15 entries (YouTube's RSS limit).
 *
 * @param channelId - YouTube channel ID (UC...)
 * @param limit - Max entries to return (default 10)
 */
export async function fetchYouTubeChannelFeed(
  channelId: string,
  limit = 10,
): Promise<YouTubeChannelFeedEntry[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'AngelOS/1.0 (Content Ingestion)' },
    })

    if (!res.ok) return []

    const xml = await res.text()
    return parseYouTubeFeedXml(xml).slice(0, limit)
  } catch {
    return []
  }
}

/**
 * Parse YouTube RSS/Atom feed XML into structured entries.
 * Uses regex parsing (no XML library dependency).
 */
function parseYouTubeFeedXml(xml: string): YouTubeChannelFeedEntry[] {
  const entries: YouTubeChannelFeedEntry[] = []

  // Extract channel name from feed title
  const feedTitleMatch = xml.match(/<title>([^<]+)<\/title>/)
  const channelName = feedTitleMatch ? decodeXmlEntities(feedTitleMatch[1]) : ''

  // Extract channel ID
  const channelIdMatch = xml.match(/channel_id=([A-Za-z0-9_-]+)/)
  const channelId = channelIdMatch ? channelIdMatch[1] : ''

  // Match each <entry> block
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/g
  let match: RegExpExecArray | null
  while ((match = entryPattern.exec(xml)) !== null) {
    const entry = match[1]

    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)
    const descMatch = entry.match(
      /<media:description>([^<]*)<\/media:description>/,
    )
    const thumbMatch = entry.match(/url="([^"]+)"/)

    if (videoIdMatch) {
      const videoId = videoIdMatch[1]
      entries.push({
        videoId,
        title: titleMatch ? decodeXmlEntities(titleMatch[1]) : '',
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: publishedMatch ? publishedMatch[1] : '',
        thumbnailUrl:
          thumbMatch?.[1] ||
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: descMatch ? decodeXmlEntities(descMatch[1]) : '',
        channelName,
        channelId,
      })
    }
  }

  return entries
}

/** Decode common XML entities */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}
