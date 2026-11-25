/**
 * Self-Serve Creator Portal Provisioning — POST /api/portal-ops/self-provision
 *
 * Powers the public `/start` 60-second creator onboarding funnel. Requires an
 * authenticated user (`req.user`), validates handle format and reserved subdomains,
 * rejects slug collisions (HTTP 409) so one user cannot overwrite another's portal,
 * enforces per-user portal quota via canonical `provisionPortal()`, stands up the
 * new creator site on `<handle>.spacesangels.com` under the Starter Preview
 * (`portalPlan: 'free'`) tier, and — when a YouTube channel URL / `@handle` / ID
 * is provided — automatically wires a `youtube_channel` Connector + mirrors up to
 * 6 recent public videos into `Posts` so the creator lands on a populated portal.
 */
import type { Payload, PayloadHandler } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'
import { resolveYouTubeChannel } from '@/utilities/youtubeChannelResolver'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

const RESERVED_HANDLES = new Set([
  'www',
  'api',
  'admin',
  'core',
  'mail',
  'app',
  'platform',
  'default',
  'help',
  'support',
  'start',
  'login',
  'dashboard',
  'shop',
  'posts',
  'spaces',
  'cdn',
  'static',
  'assets',
  'billing',
  'pay',
  'auth',
  'oauth',
  'mcp',
  'docs',
])

const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/

async function syncYouTubeBootstrap(
  payload: Payload,
  opts: {
    tenantId: number | string
    youtubeChannel: string
    youtubeChannelId?: string
    portalName: string
  },
): Promise<{ youtubeConnected: boolean; channelId: string | null; importedVideos: number }> {
  const { tenantId, youtubeChannel, youtubeChannelId, portalName } = opts
  const lookupInput = youtubeChannelId || youtubeChannel
  if (!lookupInput) {
    return { youtubeConnected: false, channelId: null, importedVideos: 0 }
  }

  let resolved: Awaited<ReturnType<typeof resolveYouTubeChannel>> = null
  try {
    resolved = await resolveYouTubeChannel(lookupInput, { videoLimit: 6, timeoutMs: 5000 })
  } catch {
    return { youtubeConnected: false, channelId: null, importedVideos: 0 }
  }

  const channelId = resolved?.channelId || (youtubeChannelId?.startsWith('UC') ? youtubeChannelId : null)
  let youtubeConnected = false

  // 1. Register a `youtube_channel` connector so hourly youtube-poll keeps syncing
  if (channelId) {
    try {
      const existingConn = await (payload as any).find({
        collection: 'connectors',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { type: { equals: 'youtube_channel' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (!existingConn.docs?.length) {
        await (payload as any).create({
          collection: 'connectors',
          data: {
            name: `${resolved?.title || portalName} YouTube`,
            type: 'youtube_channel',
            enabled: true,
            status: 'active',
            tenant: tenantId,
            config: {
              channelId,
              limit: 10,
              status: 'published',
            },
          },
          overrideAccess: true,
        })
      }
      youtubeConnected = true
    } catch {
      // Non-fatal — portal provisioning still succeeds
    }
  }

  // 2. Seed recent public videos directly into Posts (deduplicated by sourceUrl)
  let importedVideos = 0
  const videos = resolved?.recentVideos || []
  for (const video of videos.slice(0, 6)) {
    try {
      const dup = await (payload as any).find({
        collection: 'posts',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { sourceUrl: { equals: video.sourceUrl } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (dup.docs?.length) continue

      await (payload as any).create({
        collection: 'posts',
        data: {
          title: video.title || `Video: ${video.videoId}`,
          _status: 'published',
          sourceUrl: video.sourceUrl,
          sourceType: 'youtube',
          publishedOn: video.publishedAt || undefined,
          layout: [
            {
              blockType: 'content',
              columns: [
                {
                  size: 'full',
                  richText: createLexicalContent([
                    createHeadingNode(video.title || `Video: ${video.videoId}`, 'h2'),
                    createParagraphNode(
                      `From ${video.channelName || resolved?.title || 'YouTube'} · Watch on YouTube: ${video.sourceUrl}`,
                    ),
                    ...(video.description
                      ? [createParagraphNode(video.description.slice(0, 2000))]
                      : []),
                  ]),
                },
              ],
            },
          ],
          tenant: tenantId,
        },
        overrideAccess: true,
        context: { disableTranscriptIndex: true },
      })
      importedVideos++
    } catch {
      // Continue with remaining videos
    }
  }

  return { youtubeConnected, channelId, importedVideos }
}

export const selfProvisionPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user?.id) {
    return Response.json(
      { ok: false, error: 'Please sign in or create a free account to launch your portal.' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const rawHandle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : ''
  const handle = rawHandle.replace(/^@/, '').replace(/[^a-z0-9-]/g, '')

  if (!HANDLE_REGEX.test(handle)) {
    return Response.json(
      {
        ok: false,
        error:
          'Handle must be 3–32 characters using lowercase letters, numbers, or hyphens (cannot start or end with a hyphen).',
      },
      { status: 400 },
    )
  }

  if (RESERVED_HANDLES.has(handle)) {
    return Response.json(
      { ok: false, error: `"${handle}" is a reserved system handle. Please choose another.` },
      { status: 400 },
    )
  }

  // Prevent slug hijack: reject if another tenant already holds this slug
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: handle } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existing.docs?.length) {
    return Response.json(
      {
        ok: false,
        error: `"${handle}.spacesangels.com" is already claimed. Pick a slightly different handle.`,
      },
      { status: 409 },
    )
  }

  const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const name = rawName || `${handle.charAt(0).toUpperCase() + handle.slice(1)} Universe`
  const rawTagline = typeof body.tagline === 'string' ? body.tagline.trim().slice(0, 140) : ''
  const tagline = rawTagline || 'Official Creator Storefront, Memberships & Community'
  const youtubeChannel =
    typeof body.youtubeChannel === 'string' ? body.youtubeChannel.trim().slice(0, 200) : ''
  const youtubeChannelId =
    typeof body.youtubeChannelId === 'string' ? body.youtubeChannelId.trim().slice(0, 40) : ''
  const focus = Array.isArray(body.focus)
    ? body.focus.filter((f): f is string => typeof f === 'string').slice(0, 6)
    : []

  const domain = `${handle}.spacesangels.com`
  const descriptionParts = [
    `${name} — built on Angel OS.`,
    focus.length ? `Enabled surfaces: ${focus.join(', ')}.` : '',
    youtubeChannel ? `Source channel: ${youtubeChannel}` : '',
  ].filter(Boolean)

  try {
    const result = await provisionPortal(
      payload,
      {
        name,
        slug: handle,
        domain,
        tagline,
        description: descriptionParts.join(' '),
        endeavorType: 'creator-content',
        portalPlan: 'free',
        networkVisible: false,
      },
      {
        req,
        actingUserId: user.id,
      },
    )

    // Bootstrap YouTube connector + initial public videos when supplied
    const ytSync =
      youtubeChannel || youtubeChannelId
        ? await syncYouTubeBootstrap(payload, {
            tenantId: result.tenant.id,
            youtubeChannel,
            youtubeChannelId: youtubeChannelId || undefined,
            portalName: name,
          })
        : { youtubeConnected: false, channelId: null, importedVideos: 0 }

    const requestedPlan = typeof body.plan === 'string' ? body.plan : 'starter'
    const dashboardUrl = `${result.url}/dashboard`
    const paymentsUrl = `${result.url}/dashboard/admin/settings?tab=payments`
    const planUrl = `${result.url}/dashboard/admin/settings?tab=plan`

    return Response.json({
      ok: true,
      slug: result.tenant.slug,
      tenantId: result.tenant.id,
      domain: result.tenant.domain,
      url: result.url,
      dashboardUrl,
      youtubeConnected: ytSync.youtubeConnected,
      youtubeChannelId: ytSync.channelId,
      importedVideos: ytSync.importedVideos,
      checklist: {
        reviewSiteUrl: result.url,
        connectPaymentsUrl: paymentsUrl,
        upgradePlanUrl: planUrl,
      },
      upgradeHint: requestedPlan !== 'starter' ? planUrl : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isQuota = /already have \d+ of \d+/i.test(message)
    return Response.json(
      { ok: false, error: message },
      { status: isQuota ? 403 : 500 },
    )
  }
}
