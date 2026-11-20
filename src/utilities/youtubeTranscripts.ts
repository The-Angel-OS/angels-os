/**
 * Reusable YouTube Channel & Transcript Utilities
 *
 * Zero-dependency HTTP helpers using YouTube's InnerTube endpoints:
 *   - `parseYouTubeCaptionXml`: parses `timedtext format="3"` and legacy `<text>` XML into merged timestamped segments
 *   - `fetchYouTubeTranscript`: fetches video metadata + English captions via `youtubei/v1/player` (ANDROID)
 *   - `browseYouTubeChannelTab`: paginates public Videos, Shorts, and Community Posts via `youtubei/v1/browse`
 *
 * Strictly skips Members-Only content cleanly (`isMembersOnly` / `status: 'members_only'`).
 */

import {
  countTranscriptWords,
  deriveDurationLabel,
  extractYouTubeVideoId,
  formatTimestamp,
  type TranscriptSegment,
} from '@/utilities/transcriptUtils'

const INNERTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const INNERTUBE_BROWSE_URL = 'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false'

const ANDROID_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    hl: 'en',
    gl: 'US',
  },
}

const WEB_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20250101.00.00',
    hl: 'en',
    gl: 'US',
  },
}

const TAB_PARAMS: Record<'videos' | 'shorts' | 'posts', string> = {
  videos: 'EgZ2aWRlb3PyBgQKAjoA',
  shorts: 'EgZzaG9ydHPyBgUKA5oBAA%3D%3D',
  posts: 'EgVwb3N0c_IGBAoCSgA%3D',
}

export interface ParsedCaptionResult {
  segments: TranscriptSegment[]
  fullText: string
  wordCount: number
  durationLabel: string | null
}

export type YouTubeTranscriptFetchResult =
  | {
      status: 'ok'
      videoId: string
      title: string
      description: string
      publishedAt?: string
      durationSec: number
      durationLabel: string | null
      language: string
      sourceLabel: string
      wordCount: number
      segments: TranscriptSegment[]
      fullText: string
    }
  | {
      status: 'members_only'
      videoId: string
      reason: string
    }
  | {
      status: 'no_captions'
      videoId: string
      title: string
      description: string
      publishedAt?: string
      durationSec: number
    }
  | {
      status: 'unavailable'
      videoId: string
      reason: string
    }

export interface ChannelVideoItem {
  videoId: string
  title: string
  url: string
  durationLabel?: string
  publishedText?: string
  thumbnailUrl: string
  isShort: boolean
  isMembersOnly: boolean
}

export interface ChannelCommunityPostItem {
  postId: string
  url: string
  text: string
  publishedText?: string
  imageUrls: string[]
  isMembersOnly: boolean
}

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, code: string) => {
    const lower = code.toLowerCase()
    if (lower === 'amp') return '&'
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    if (lower.startsWith('#x')) {
      const n = Number.parseInt(lower.slice(2), 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    if (lower.startsWith('#')) {
      const n = Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return match
  })
}

function cleanCueText(rawXmlText: string): string {
  const withoutTags = rawXmlText.replace(/<[^>]+>/g, ' ')
  const decoded = decodeEntities(withoutTags)
  return decoded
    .replace(/(?:^|\s)>>\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))
  return match?.[1] ?? null
}

/**
 * Parse YouTube caption XML (`timedtext format="3"` `<p t="..." d="...">` OR
 * legacy `<text start="..." dur="...">`) into clean merged ~10–15s segments.
 */
export function parseYouTubeCaptionXml(xml: string): ParsedCaptionResult {
  if (!xml || typeof xml !== 'string') {
    return { segments: [], fullText: '', wordCount: 0, durationLabel: null }
  }

  const rawCues: Array<{ startSec: number; endSec: number; text: string }> = []

  // Format 3 timedtext: <p t="ms" d="ms">...</p>
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi
  let pMatch: RegExpExecArray | null
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const attrs = pMatch[1] || ''
    const inner = pMatch[2] || ''
    const tAttr = extractAttr(attrs, 't')
    if (tAttr === null) continue

    const text = cleanCueText(inner)
    if (!text) continue

    const tMs = Number(tAttr)
    const dMs = Number(extractAttr(attrs, 'd') || '0')
    if (!Number.isFinite(tMs) || tMs < 0) continue

    const startSec = Math.floor(tMs / 1000)
    const endSec = Math.max(startSec, Math.floor((tMs + (Number.isFinite(dMs) && dMs > 0 ? dMs : 0)) / 1000))
    rawCues.push({ startSec, endSec, text })
  }

  // Legacy format: <text start="sec" dur="sec">...</text>
  if (rawCues.length === 0) {
    const textRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi
    let tMatch: RegExpExecArray | null
    while ((tMatch = textRegex.exec(xml)) !== null) {
      const attrs = tMatch[1] || ''
      const inner = tMatch[2] || ''
      const startAttr = extractAttr(attrs, 'start')
      if (startAttr === null) continue

      const text = cleanCueText(inner)
      if (!text) continue

      const startFloat = Number(startAttr)
      const durFloat = Number(extractAttr(attrs, 'dur') || '0')
      if (!Number.isFinite(startFloat) || startFloat < 0) continue

      const startSec = Math.floor(startFloat)
      const endSec = Math.max(
        startSec,
        Math.floor(startFloat + (Number.isFinite(durFloat) && durFloat > 0 ? durFloat : 0)),
      )
      rawCues.push({ startSec, endSec, text })
    }
  }

  if (rawCues.length === 0) {
    return { segments: [], fullText: '', wordCount: 0, durationLabel: null }
  }

  // Merge consecutive tiny cues into ~10-15s or sentence-terminated segments
  const segments: TranscriptSegment[] = []
  let groupStart = rawCues[0].startSec
  let groupEnd = rawCues[0].endSec
  let parts: string[] = []
  let groupWords = 0

  const flush = () => {
    const mergedText = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (mergedText) {
      segments.push({
        startSec: groupStart,
        endSec: Math.max(groupStart, groupEnd),
        text: mergedText,
      })
    }
    parts = []
    groupWords = 0
  }

  for (let i = 0; i < rawCues.length; i++) {
    const cue = rawCues[i]
    if (
      parts.length > 0 &&
      (cue.startSec - groupStart >= 14 || cue.startSec - groupEnd >= 5)
    ) {
      flush()
    }

    if (parts.length === 0) {
      groupStart = cue.startSec
      groupEnd = cue.endSec
    }

    parts.push(cue.text)
    groupEnd = Math.max(groupEnd, cue.endSec)
    groupWords += cue.text.split(/\s+/).filter(Boolean).length

    const elapsed = cue.startSec - groupStart
    const endsSentence = /[.!?]["')\]]*$/.test(cue.text)
    const shouldFlush =
      groupWords >= 24 ||
      (endsSentence && (groupWords >= 8 || elapsed >= 5))

    if (shouldFlush) {
      flush()
    }
  }
  if (parts.length > 0) flush()

  const fullText = segments
    .map((s) => `[${formatTimestamp(s.startSec)}] ${s.text}`)
    .join('\n')

  return {
    segments,
    fullText,
    wordCount: countTranscriptWords(segments),
    durationLabel: deriveDurationLabel(segments),
  }
}

/**
 * Fetch metadata + English captions for a single YouTube video via InnerTube `player`.
 */
export async function fetchYouTubeTranscript(
  videoIdOrUrl: string,
): Promise<YouTubeTranscriptFetchResult> {
  const videoId =
    /^[a-zA-Z0-9_-]{11}$/.test(videoIdOrUrl.trim())
      ? videoIdOrUrl.trim()
      : extractYouTubeVideoId(videoIdOrUrl)

  if (!videoId) {
    return { status: 'unavailable', videoId: videoIdOrUrl, reason: 'Invalid YouTube video ID or URL' }
  }

  try {
    const playerRes = await fetch(INNERTUBE_PLAYER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        context: ANDROID_CONTEXT,
        videoId,
      }),
    })

    if (!playerRes.ok) {
      return {
        status: 'unavailable',
        videoId,
        reason: `InnerTube player HTTP ${playerRes.status}`,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await playerRes.json()) as any
    const playStatus = String(data?.playabilityStatus?.status || '')
    const playReason = String(
      data?.playabilityStatus?.reason ||
        data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText ||
        '',
    )

    if (playStatus !== 'OK') {
      if (/member|sponsor|join this channel/i.test(playReason)) {
        return { status: 'members_only', videoId, reason: playReason || 'Members-only video' }
      }
      return {
        status: 'unavailable',
        videoId,
        reason: playReason || `Playability status: ${playStatus || 'UNKNOWN'}`,
      }
    }

    const details = data?.videoDetails || {}
    const title = String(details.title || '')
    const description = String(details.shortDescription || '')
    const durationSec = Number(details.lengthSeconds || 0) || 0
    const publishDate = data?.microformat?.playerMicroformatRenderer?.publishDate
    const publishedAt = typeof publishDate === 'string' && publishDate ? publishDate : undefined

    const tracks = (data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []) as Array<{
      baseUrl?: string
      languageCode?: string
      kind?: string
    }>

    // Prefer manual English over ASR English, then any en-* variant
    const chosen =
      tracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ||
      tracks.find((t) => t.languageCode === 'en') ||
      tracks.find((t) => /^en(?:-|$)/i.test(t.languageCode || '') && t.kind !== 'asr') ||
      tracks.find((t) => /^en(?:-|$)/i.test(t.languageCode || ''))

    if (!chosen?.baseUrl) {
      return {
        status: 'no_captions',
        videoId,
        title,
        description,
        publishedAt,
        durationSec,
      }
    }

    const capRes = await fetch(chosen.baseUrl, {
      headers: { 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
      signal: AbortSignal.timeout(12000),
    })

    if (!capRes.ok) {
      return {
        status: 'unavailable',
        videoId,
        reason: `Caption track HTTP ${capRes.status}`,
      }
    }

    const xml = await capRes.text()
    const parsed = parseYouTubeCaptionXml(xml)
    if (parsed.segments.length === 0) {
      return {
        status: 'no_captions',
        videoId,
        title,
        description,
        publishedAt,
        durationSec,
      }
    }

    return {
      status: 'ok',
      videoId,
      title,
      description,
      publishedAt,
      durationSec,
      durationLabel: parsed.durationLabel || (durationSec > 0 ? formatTimestamp(durationSec) : null),
      language: chosen.languageCode || 'en',
      sourceLabel: chosen.kind === 'asr' ? 'YouTube Auto-Captions' : 'YouTube Captions',
      wordCount: parsed.wordCount,
      segments: parsed.segments,
      fullText: parsed.fullText,
    }
  } catch (err) {
    return {
      status: 'unavailable',
      videoId,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

function isMembersOnlyBlob(obj: unknown): boolean {
  try {
    const raw = JSON.stringify(obj)
    return /members only|sponsors only|badge_style_members|members-only/i.test(raw)
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractVideoFromRenderer(item: any): ChannelVideoItem | null {
  const lockup = item?.richItemRenderer?.content?.lockupViewModel
  if (lockup?.contentId) {
    const videoId = String(lockup.contentId)
    const metaVm = lockup.metadata?.lockupMetadataViewModel
    const title = String(metaVm?.title?.content || '').trim()
    const rows = (metaVm?.metadata?.contentMetadataViewModel?.metadataRows || []) as Array<{
      metadataParts?: Array<{ text?: { content?: string } }>
    }>
    const metaTexts = rows.flatMap((r) => (r.metadataParts || []).map((p) => p.text?.content || ''))
    const publishedText = metaTexts.find((t) => /ago|streamed|premiered/i.test(t))
    const overlays = lockup.contentImage?.thumbnailViewModel?.overlays || []
    let durationLabel: string | undefined
    for (const ov of overlays) {
      const badgeText = ov?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text
      if (typeof badgeText === 'string' && /^\d+:\d+/.test(badgeText.trim())) {
        durationLabel = badgeText.trim()
        break
      }
    }

    return {
      videoId,
      title: title || `Video ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      durationLabel,
      publishedText,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isShort: false,
      isMembersOnly: isMembersOnlyBlob(lockup.contentImage) || isMembersOnlyBlob(metaVm?.metadata),
    }
  }

  const vr = item?.richItemRenderer?.content?.videoRenderer
  if (vr?.videoId) {
    const videoId = String(vr.videoId)
    const title = String(vr.title?.runs?.map((r: { text?: string }) => r.text).join('') || '').trim()
    return {
      videoId,
      title: title || `Video ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      durationLabel: vr.lengthText?.simpleText,
      publishedText: vr.publishedTimeText?.simpleText,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isShort: false,
      isMembersOnly: isMembersOnlyBlob(vr.badges),
    }
  }

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractShortFromRenderer(item: any): ChannelVideoItem | null {
  const sl = item?.richItemRenderer?.content?.shortsLockupViewModel
  if (sl) {
    const videoId =
      sl.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
      String(sl.entityId || '').replace(/^shorts-shelf-item-/, '')
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null
    const rawTitle =
      sl.overlayMetadata?.primaryText?.content ||
      String(sl.accessibilityText || '').replace(/,\s*[\d.,]+(?:\s*\w+)?\s*views\s*-\s*play Short$/i, '')
    return {
      videoId,
      title: String(rawTitle || `Short ${videoId}`).trim(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isShort: true,
      isMembersOnly: isMembersOnlyBlob(sl),
    }
  }

  const reel = item?.richItemRenderer?.content?.reelItemRenderer
  if (reel?.videoId) {
    const videoId = String(reel.videoId)
    return {
      videoId,
      title: String(reel.headline?.simpleText || `Short ${videoId}`).trim(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isShort: true,
      isMembersOnly: isMembersOnlyBlob(reel),
    }
  }

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCommunityPost(item: any): ChannelCommunityPostItem | null {
  const bp = item?.backstagePostThreadRenderer?.post?.backstagePostRenderer
  if (!bp?.postId) return null

  const postId = String(bp.postId)
  const text = (bp.contentText?.runs || [])
    .map((r: { text?: string }) => r.text || '')
    .join('')
    .trim()
  const publishedText = bp.publishedTimeText?.runs?.[0]?.text
  const isMembersOnly = Boolean(bp.sponsorsOnlyBadge)

  const imageUrls: string[] = []
  const att = bp.backstageAttachment
  const singleThumbs = att?.backstageImageRenderer?.image?.thumbnails
  if (Array.isArray(singleThumbs) && singleThumbs.length > 0) {
    const best = singleThumbs[singleThumbs.length - 1]?.url
    if (best) imageUrls.push(String(best))
  }
  const multiImgs = att?.postMultiImageRenderer?.images
  if (Array.isArray(multiImgs)) {
    for (const imgObj of multiImgs) {
      const thumbs = imgObj?.backstageImageRenderer?.image?.thumbnails
      if (Array.isArray(thumbs) && thumbs.length > 0) {
        const best = thumbs[thumbs.length - 1]?.url
        if (best) imageUrls.push(String(best))
      }
    }
  }

  return {
    postId,
    url: `https://www.youtube.com/post/${postId}`,
    text,
    publishedText,
    imageUrls,
    isMembersOnly,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBrowseItemsAndToken(data: any, tab: 'videos' | 'shorts' | 'posts', isFirstPage: boolean): { items: any[]; nextToken: string | null } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawItems: any[] = []
  if (isFirstPage) {
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedTab = tabs.find((t: any) => t?.tabRenderer?.selected)
    const content = selectedTab?.tabRenderer?.content
    if (tab === 'posts') {
      rawItems = content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || []
    } else {
      rawItems = content?.richGridRenderer?.contents || []
    }
  } else {
    const actions = data?.onResponseReceivedActions || []
    for (const act of actions) {
      const ci = act?.appendContinuationItemsAction?.continuationItems
      if (Array.isArray(ci)) {
        rawItems = ci
        break
      }
    }
  }

  let nextToken: string | null = null
  for (const it of rawItems) {
    const tok = it?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
    if (typeof tok === 'string' && tok) {
      nextToken = tok
    }
  }

  return { items: rawItems, nextToken }
}

/**
 * Paginate public items from a YouTube channel's Videos, Shorts, or Community Posts tab.
 */
export async function browseYouTubeChannelTab(
  channelId: string,
  tab: 'videos',
  opts?: { maxPages?: number },
): Promise<{ items: ChannelVideoItem[]; membersOnlySkipped: number }>
export async function browseYouTubeChannelTab(
  channelId: string,
  tab: 'shorts',
  opts?: { maxPages?: number },
): Promise<{ items: ChannelVideoItem[]; membersOnlySkipped: number }>
export async function browseYouTubeChannelTab(
  channelId: string,
  tab: 'posts',
  opts?: { maxPages?: number },
): Promise<{ items: ChannelCommunityPostItem[]; membersOnlySkipped: number }>
export async function browseYouTubeChannelTab(
  channelId: string,
  tab: 'videos' | 'shorts' | 'posts',
  opts: { maxPages?: number } = {},
): Promise<{ items: Array<ChannelVideoItem | ChannelCommunityPostItem>; membersOnlySkipped: number }> {
  const maxPages = Math.max(1, Math.min(30, opts.maxPages ?? 15))
  const seen = new Set<string>()
  const collected: Array<ChannelVideoItem | ChannelCommunityPostItem> = []
  let membersOnlySkipped = 0
  let continuation: string | null = null

  for (let page = 0; page < maxPages; page++) {
    const body =
      page === 0
        ? { context: WEB_CONTEXT, browseId: channelId, params: TAB_PARAMS[tab] }
        : { context: WEB_CONTEXT, continuation }

    const res = await fetch(INNERTUBE_BROWSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify(body),
    })

    if (!res.ok) break
    const data = await res.json()
    const { items, nextToken } = extractBrowseItemsAndToken(data, tab, page === 0)

    for (const raw of items) {
      if (tab === 'posts') {
        const parsed = extractCommunityPost(raw)
        if (!parsed) continue
        if (parsed.isMembersOnly) {
          membersOnlySkipped++
          continue
        }
        if (seen.has(parsed.postId)) continue
        seen.add(parsed.postId)
        collected.push(parsed)
      } else {
        const parsed =
          tab === 'videos' ? extractVideoFromRenderer(raw) : extractShortFromRenderer(raw)
        if (!parsed) continue
        if (parsed.isMembersOnly) {
          membersOnlySkipped++
          continue
        }
        if (seen.has(parsed.videoId)) continue
        seen.add(parsed.videoId)
        collected.push(parsed)
      }
    }

    if (!nextToken) break
    continuation = nextToken
  }

  return { items: collected, membersOnlySkipped }
}
