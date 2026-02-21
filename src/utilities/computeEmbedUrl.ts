/**
 * Compute Embed URL — Parse video URLs into embeddable iframe URLs
 *
 * Supports YouTube, Vimeo, and Twitch. Custom URLs pass through unchanged.
 *
 * @see src/collections/Events.ts — uses this in beforeChange hook
 * @see src/components/VideoEmbed/index.tsx — renders the embed
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'twitch' | 'custom'

export interface EmbedUrlResult {
  provider: VideoProvider
  embedUrl: string | null
  videoId: string | null
}

/**
 * Parse a video URL and return the embeddable URL + detected provider.
 *
 * YouTube formats:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *
 * Vimeo formats:
 *   - https://vimeo.com/VIDEO_ID
 *   - https://player.vimeo.com/video/VIDEO_ID
 *
 * Twitch formats:
 *   - https://www.twitch.tv/CHANNEL
 *   - https://www.twitch.tv/videos/VIDEO_ID
 */
export function computeEmbedUrl(
  videoUrl: string,
  providerHint?: VideoProvider,
): EmbedUrlResult {
  if (!videoUrl || typeof videoUrl !== 'string') {
    return { provider: providerHint || 'custom', embedUrl: null, videoId: null }
  }

  const trimmed = videoUrl.trim()

  if (!trimmed) {
    return { provider: providerHint || 'custom', embedUrl: null, videoId: null }
  }

  // YouTube
  const youtubeId = extractYouTubeId(trimmed)
  if (youtubeId) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      videoId: youtubeId,
    }
  }

  // Vimeo
  const vimeoId = extractVimeoId(trimmed)
  if (vimeoId) {
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      videoId: vimeoId,
    }
  }

  // Twitch
  const twitchResult = extractTwitchEmbed(trimmed)
  if (twitchResult) {
    return {
      provider: 'twitch',
      embedUrl: twitchResult.embedUrl,
      videoId: twitchResult.id,
    }
  }

  // Custom / unknown — pass through
  return {
    provider: providerHint || 'custom',
    embedUrl: trimmed,
    videoId: null,
  }
}

function extractYouTubeId(url: string): string | null {
  // youtube.com/watch?v=ID
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  )
  if (watchMatch) return watchMatch[1]

  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]

  // youtube.com/embed/ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]

  return null
}

function extractVimeoId(url: string): string | null {
  // vimeo.com/ID or player.vimeo.com/video/ID
  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)
  return match ? match[1] : null
}

function extractTwitchEmbed(
  url: string,
): { embedUrl: string; id: string } | null {
  // twitch.tv/videos/ID
  const vodMatch = url.match(/twitch\.tv\/videos\/(\d+)/)
  if (vodMatch) {
    return {
      embedUrl: `https://player.twitch.tv/?video=v${vodMatch[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`,
      id: vodMatch[1],
    }
  }

  // twitch.tv/CHANNEL
  const channelMatch = url.match(
    /twitch\.tv\/([a-zA-Z0-9_]+)\/?$/,
  )
  if (channelMatch) {
    return {
      embedUrl: `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`,
      id: channelMatch[1],
    }
  }

  return null
}
