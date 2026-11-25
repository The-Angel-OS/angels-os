/**
 * Public YouTube Channel Preview — POST /api/portal-ops/youtube-preview
 *
 * Powers the 60-second YouTube auto-fill on `/start`. Given a YouTube `@handle`,
 * channel URL, or `UC...` ID, resolves public channel metadata (name, tagline,
 * avatar, banner, channelId) + up to 6 recent public videos via RSS, and checks
 * whether the derived portal handle is available on `*.spacesangels.com`.
 *
 * Zero YouTube Data API quota required; zero DB writes.
 */
import type { PayloadHandler } from 'payload'
import {
  normalizeYouTubeHandle,
  resolveYouTubeChannel,
} from '@/utilities/youtubeChannelResolver'

const RESERVED_HANDLES = new Set([
  'www', 'api', 'admin', 'core', 'mail', 'app', 'platform', 'default',
  'help', 'support', 'start', 'login', 'dashboard', 'shop', 'posts',
  'spaces', 'cdn', 'static', 'assets', 'billing', 'pay', 'auth',
  'oauth', 'mcp', 'docs',
])

async function pickAvailableHandle(
  payload: Parameters<PayloadHandler>[0]['payload'],
  baseHandle: string,
): Promise<{ handle: string; available: boolean }> {
  const normalized = normalizeYouTubeHandle(baseHandle)
  const candidate = normalized.length >= 3 ? normalized : `${normalized || 'creator'}-hq`

  const checkTaken = async (slug: string): Promise<boolean> => {
    if (RESERVED_HANDLES.has(slug)) return true
    const existing = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return Boolean(existing.docs?.length)
  }

  if (!(await checkTaken(candidate))) {
    return { handle: candidate, available: true }
  }

  for (const suffix of ['tv', 'studio', 'hq', 'live']) {
    const alt = `${candidate.slice(0, 25)}-${suffix}`
    if (!(await checkTaken(alt))) {
      return { handle: alt, available: false }
    }
  }

  return { handle: candidate, available: false }
}

export const youtubePreviewHandler: PayloadHandler = async (req) => {
  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const input =
    typeof body.youtubeChannel === 'string'
      ? body.youtubeChannel.trim()
      : typeof body.url === 'string'
        ? body.url.trim()
        : ''

  if (!input || input.length > 250) {
    return Response.json(
      { ok: false, error: 'Enter a YouTube channel URL, @handle, or channel ID.' },
      { status: 400 },
    )
  }

  const channel = await resolveYouTubeChannel(input, { videoLimit: 6, timeoutMs: 6000 })
  if (!channel) {
    return Response.json(
      { ok: false, error: 'Could not recognize that YouTube channel URL or @handle.' },
      { status: 400 },
    )
  }

  const availability = await pickAvailableHandle(req.payload, channel.handle)

  return Response.json({
    ok: true,
    channel: {
      channelId: channel.channelId,
      handle: availability.handle,
      originalHandle: channel.handle,
      handleAvailable: availability.available,
      title: channel.title,
      tagline: channel.tagline,
      description: channel.description,
      avatarUrl: channel.avatarUrl,
      bannerUrl: channel.bannerUrl,
      canonicalUrl: channel.canonicalUrl,
      videoCount: channel.recentVideos.length,
      recentVideos: channel.recentVideos.map((v) => ({
        videoId: v.videoId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        sourceUrl: v.sourceUrl,
      })),
    },
  })
}
