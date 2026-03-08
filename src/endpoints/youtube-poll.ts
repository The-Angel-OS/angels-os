/**
 * YouTube Channel Poll Endpoint — GET /api/youtube/poll
 *
 * Vercel Cron target (every 60 minutes): iterates all enabled `youtube_channel`
 * connectors, fetches each channel's RSS feed, and creates Posts for any new
 * videos not already ingested (deduplicated via sourceUrl).
 *
 * Connector config shape:
 *   {
 *     "channelId": "UC...",          // YouTube channel ID (required)
 *     "limit": 10,                   // Max videos per poll (default 10, max 15)
 *     "status": "published",         // Post status: "draft" | "published" (default "published")
 *     "categories": ["Ministry"]     // Optional category names to assign
 *   }
 *
 * Security: Protected by Authorization: Bearer CRON_SECRET.
 * Vercel Cron automatically injects this header in production.
 */

import type { Payload, PayloadHandler, Where } from 'payload'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'
import { fetchYouTubeChannelFeed } from '@/utilities/youtubeMetadata'
import { logCaughtError } from '@/utilities/logError'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

// ─── Types ────────────────────────────────────────────────────────────────

interface ConnectorConfig {
  channelId?: string
  limit?: number
  status?: 'draft' | 'published'
  categories?: string[]
}

interface PollResult {
  connectorId: string
  channelId: string
  created: number
  skipped: number
  failed: number
  error?: string
}

// ─── Handler ──────────────────────────────────────────────────────────────

export const youtubePollHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Verify cron authorization ─────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Find all enabled youtube_channel connectors ───────────────
  let connectors: Awaited<ReturnType<typeof findAllConnectors>>
  try {
    connectors = await findAllConnectors(payload, 'youtube_channel')
  } catch (err) {
    logCaughtError('youtube-poll/fetch-connectors', err)
    return Response.json({ error: 'Failed to fetch connectors' }, { status: 500 })
  }

  if (connectors.length === 0) {
    return Response.json({ message: 'No youtube_channel connectors found', results: [] })
  }

  // ── Process each connector ────────────────────────────────────
  const results: PollResult[] = []

  for (const connector of connectors) {
    const cfg = connector.config as unknown as ConnectorConfig
    const channelId = cfg?.channelId?.trim()

    if (!channelId) {
      await markConnectorError(payload, connector.id, 'Missing channelId in config')
      results.push({
        connectorId: connector.id,
        channelId: '',
        created: 0,
        skipped: 0,
        failed: 0,
        error: 'Missing channelId in config',
      })
      continue
    }

    try {
      const result = await pollSingleChannel(payload, {
        connectorId: connector.id,
        tenantId: connector.tenantId,
        channelId,
        limit: Math.min(Math.max(Number(cfg.limit) || 10, 1), 15),
        status: cfg.status === 'draft' ? 'draft' : 'published',
        categoryNames: cfg.categories,
      })

      results.push(result)

      if (!result.error) {
        await markConnectorActive(payload, connector.id)
      } else {
        await markConnectorError(payload, connector.id, result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logCaughtError('youtube-poll/connector', err)
      await markConnectorError(payload, connector.id, message)
      results.push({
        connectorId: connector.id,
        channelId,
        created: 0,
        skipped: 0,
        failed: 0,
        error: message,
      })
    }
  }

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0)
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)

  return Response.json({
    connectors: connectors.length,
    totalCreated,
    totalSkipped,
    results,
  })
}

// ─── Per-Channel Poll Logic ───────────────────────────────────────────────

async function pollSingleChannel(
  payload: Payload,
  opts: {
    connectorId: string
    tenantId: string
    channelId: string
    limit: number
    status: 'draft' | 'published'
    categoryNames?: string[]
  },
): Promise<PollResult> {
  const { connectorId, tenantId, channelId, limit, status, categoryNames } = opts

  // Fetch the RSS feed (no API key required)
  const feed = await fetchYouTubeChannelFeed(channelId, limit)
  if (feed.length === 0) {
    return {
      connectorId,
      channelId,
      created: 0,
      skipped: 0,
      failed: 0,
      error: 'No videos in RSS feed (channel may not exist or has no public videos)',
    }
  }

  // Resolve categories once (by name → ID)
  const categoryIds: (number | string)[] = []
  if (categoryNames?.length) {
    for (const name of categoryNames) {
      try {
        const found = await (payload as any).find({
          collection: 'categories',
          where: { title: { contains: name } } as Where,
          limit: 1,
          overrideAccess: true,
        })
        if (found.docs[0]) categoryIds.push(found.docs[0].id)
      } catch {
        // Non-critical — skip category
      }
    }
  }

  let created = 0
  let skipped = 0
  let failed = 0

  for (const video of feed) {
    // Deduplication: check if sourceUrl already exists
    try {
      const existing = await (payload as any).find({
        collection: 'posts',
        where: { sourceUrl: { equals: video.sourceUrl } } as Where,
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs[0]) {
        skipped++
        continue
      }
    } catch {
      // If dedup check fails, skip this video to avoid duplicates
      skipped++
      continue
    }

    // Create the post
    try {
      const contentParts = [
        `From **${video.channelName || 'YouTube'}**`,
        `[Watch on YouTube](${video.sourceUrl})`,
      ]
      if (video.description) contentParts.push('', video.description)

      const postData: Record<string, any> = {
        title: video.title || `Video: ${video.videoId}`,
        _status: status,
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
                    `From ${video.channelName || 'YouTube'} · Watch on YouTube: ${video.sourceUrl}`,
                  ),
                  ...(video.description
                    ? [createParagraphNode(video.description)]
                    : []),
                ]),
              },
            ],
          },
        ],
        tenant: tenantId,
      }

      if (categoryIds.length) postData.categories = categoryIds

      await (payload as any).create({
        collection: 'posts',
        data: postData,
        overrideAccess: true,
      })
      created++
    } catch (err) {
      logCaughtError('youtube-poll/create-post', err)
      failed++
    }
  }

  return { connectorId, channelId, created, skipped, failed }
}
