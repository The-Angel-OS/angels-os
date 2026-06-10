/**
 * X (Twitter) Post Endpoint — POST /api/x/post
 *
 * Posts a single tweet or a thread via the first matching `x_twitter` connector
 * (tenant + optional space). Body shape:
 *
 *   Single:   { "text": "Hello world" }
 *   Thread:   { "tweets": ["Part 1", "Part 2", ...] }
 *   Targeted: { "text": "...", "tenantId": "...", "spaceId": "..." }
 *
 * Auth: Requires a logged-in Payload user (cookie) OR Authorization: Bearer CRON_SECRET.
 * Super-admins bypass tenant scoping; regular users must be in the target tenant.
 *
 * Used by:
 *   - LEO tools `post_to_x` / `post_x_thread`
 *   - Admin UI compose button
 *   - Workflows for auto-cross-posting
 */

import type { PayloadHandler } from 'payload'
import { resolveConnector, findAllConnectors } from '@/utilities/resolveConnector'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'
import {
  ensureFreshToken,
  postTweet,
  postThread,
  type XTwitterConfig,
} from '@/utilities/xTwitterClient'
import { logCaughtError } from '@/utilities/logError'

interface PostBody {
  text?: string
  tweets?: string[]
  tenantId?: string | number
  spaceId?: string | number | null
  connectorId?: string
}

export const xPostHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Authorization ──────────────────────────────────────────────
  const user = req.user as any
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!user && !isCron) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────
  let body: PostBody
  try {
    body = ((await (req as any).json?.()) as PostBody) || {}
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, tweets, tenantId: bodyTenantId, spaceId, connectorId } = body

  if (!text && !(tweets && tweets.length)) {
    return Response.json(
      { error: 'Provide either `text` (string) or `tweets` (array of strings)' },
      { status: 400 },
    )
  }

  // ── Resolve connector ──────────────────────────────────────────
  const isSuperAdmin =
    user &&
    Array.isArray(user.roles) &&
    (user.roles.includes('super_admin') || user.roles.includes('admin'))

  const tenantId =
    bodyTenantId ??
    (user?.tenants?.[0]?.tenant?.id || user?.tenants?.[0]?.tenant) ??
    null

  let connector:
    | { id: string; config: Record<string, unknown> }
    | null = null

  try {
    if (connectorId) {
      const doc = await (payload as any).findByID({
        collection: 'connectors',
        id: connectorId,
        overrideAccess: true,
        depth: 0,
      })
      if (doc && doc.type === 'x_twitter') {
        connector = { id: String(doc.id), config: (doc.config as Record<string, unknown>) || {} }
      }
    } else if (tenantId) {
      connector = await resolveConnector(payload, {
        type: 'x_twitter',
        tenantId,
        spaceId: spaceId ?? null,
      })
    } else if (isCron || isSuperAdmin) {
      const all = await findAllConnectors(payload, 'x_twitter')
      if (all[0]) connector = { id: all[0].id, config: all[0].config }
    }
  } catch (err) {
    logCaughtError('x-post/resolve-connector', err)
    return Response.json({ error: 'Failed to resolve x_twitter connector' }, { status: 500 })
  }

  if (!connector) {
    return Response.json(
      {
        error:
          'No x_twitter connector found for this tenant/space. Configure one at /admin/collections/connectors.',
      },
      { status: 404 },
    )
  }

  // ── Refresh token if needed ────────────────────────────────────
  let cfg = connector.config as unknown as XTwitterConfig
  try {
    cfg = await ensureFreshToken(payload, connector.id, cfg)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed'
    logCaughtError('x-post/refresh-token', err)
    await markConnectorError(payload, connector.id, message)
    return Response.json({ error: message }, { status: 401 })
  }

  // ── Post ───────────────────────────────────────────────────────
  try {
    if (tweets && tweets.length) {
      const result = await postThread(cfg, tweets)
      await markConnectorActive(payload, connector.id)
      return Response.json({ ok: true, kind: 'thread', ...result })
    }

    const result = await postTweet(cfg, { text: text! })
    await markConnectorActive(payload, connector.id)
    return Response.json({ ok: true, kind: 'tweet', tweet: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'X post failed'
    logCaughtError('x-post/publish', err)
    await markConnectorError(payload, connector.id, message)
    return Response.json({ error: message }, { status: 502 })
  }
}
