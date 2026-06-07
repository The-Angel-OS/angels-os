/**
 * Gotify Poll Endpoint — GET /api/gotify/poll
 *
 * Vercel Cron target (every 5 min): for each enabled `gotify` connector, fetch
 * recent messages from its Gotify server with that connector's CLIENT token
 * (`C…`, RECEIVE), keep only messages newer than the connector's stored
 * `lastSeenMessageId`, dedupe by Gotify message id, and mirror each onto the AI
 * Bus — so the dashboard + LEO see what the Android client sees (e.g. Uptime-Kuma
 * up/down alerts). Serverless-friendly POLL (a WebSocket `/stream` variant can run
 * on a long-lived node like Nimue later).
 *
 * There can be N gotify connectors per tenant — each has its OWN serverUrl /
 * clientToken / routing in `config`, so we iterate them all.
 *
 * Routing: connector.routingChannel if set, else the AI Bus `gotify` channel.
 * Security: Authorization: Bearer CRON_SECRET (Vercel Cron injects this).
 *
 * Connector config shape (all in the `config` json — no schema change):
 *   { serverUrl, appToken, clientToken, lastSeenMessageId?, limit?, escalation? }
 */
import type { Payload, PayloadHandler } from 'payload'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'
import { ensureSystemSpace } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import { logCaughtError } from '@/utilities/logError'

const trimSlash = (s: string): string => s.replace(/\/+$/, '')
const DEFAULT_LIMIT = 50
const GOTIFY_CHANNEL_SLUG = 'gotify'

interface GotifyMessage {
  id: number
  appid?: number
  message?: string
  title?: string
  priority?: number
  date?: string
  extras?: Record<string, unknown>
}

interface ConnectorPollResult {
  connectorId: string
  created: number
  skipped: number
  lastSeenMessageId: number
  error?: string
}

export const gotifyPollHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Cron auth ────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Find all enabled gotify connectors (across tenants) ──────
  let connectors: Awaited<ReturnType<typeof findAllConnectors>>
  try {
    connectors = await findAllConnectors(payload, 'gotify')
  } catch (err) {
    logCaughtError('gotify-poll/fetch-connectors', err)
    return Response.json({ error: 'Failed to fetch connectors' }, { status: 500 })
  }

  if (connectors.length === 0) {
    return Response.json({ message: 'No gotify connectors found', results: [] })
  }

  const results: ConnectorPollResult[] = []

  for (const connector of connectors) {
    const cfg = (connector.config || {}) as Record<string, unknown>
    const serverUrl = String(cfg.serverUrl || process.env.GOTIFY_SERVER_URL || '').trim()
    const clientToken = String(cfg.clientToken || '').trim()
    const lastSeen = Number(cfg.lastSeenMessageId) || 0
    const limit = Math.min(Math.max(Number(cfg.limit) || DEFAULT_LIMIT, 1), 200)

    if (!serverUrl || !clientToken) {
      await markConnectorError(payload, connector.id, 'Missing serverUrl or clientToken in config')
      results.push({ connectorId: connector.id, created: 0, skipped: 0, lastSeenMessageId: lastSeen, error: 'Missing serverUrl or clientToken' })
      continue
    }

    try {
      const result = await pollOne(payload, {
        connectorId: connector.id,
        tenantId: connector.tenantId,
        routingChannel: connector.routingChannel,
        serverUrl: trimSlash(serverUrl),
        clientToken,
        lastSeen,
        limit,
      })
      results.push(result)

      if (result.error) {
        await markConnectorError(payload, connector.id, result.error)
      } else {
        // Persist new high-water mark + mark active.
        if (result.lastSeenMessageId !== lastSeen) {
          await payload.update({
            collection: 'connectors' as 'payload-locked-documents',
            id: connector.id,
            data: { config: { ...cfg, lastSeenMessageId: result.lastSeenMessageId } } as never,
            overrideAccess: true,
          })
        }
        await markConnectorActive(payload, connector.id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logCaughtError('gotify-poll/connector', err)
      await markConnectorError(payload, connector.id, message)
      results.push({ connectorId: connector.id, created: 0, skipped: 0, lastSeenMessageId: lastSeen, error: message })
    }
  }

  const totalCreated = results.reduce((s, r) => s + r.created, 0)
  return Response.json({ connectors: connectors.length, totalCreated, results })
}

// ─── Per-connector poll ──────────────────────────────────────────
async function pollOne(
  payload: Payload,
  opts: {
    connectorId: string
    tenantId: string
    routingChannel?: string
    serverUrl: string
    clientToken: string
    lastSeen: number
    limit: number
  },
): Promise<ConnectorPollResult> {
  const { connectorId, tenantId, routingChannel, serverUrl, clientToken, lastSeen, limit } = opts

  // Fetch recent messages (Gotify returns newest-first under `messages`).
  const res = await fetch(`${serverUrl}/message?limit=${limit}`, {
    headers: { 'X-Gotify-Key': clientToken },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { connectorId, created: 0, skipped: 0, lastSeenMessageId: lastSeen, error: `Gotify ${res.status}: ${text.slice(0, 200)}` }
  }

  const data = (await res.json()) as { messages?: GotifyMessage[] }
  const all = Array.isArray(data.messages) ? data.messages : []

  // Only messages newer than the high-water mark, oldest-first for chronological insert.
  const fresh = all.filter((m) => Number(m.id) > lastSeen).sort((a, b) => Number(a.id) - Number(b.id))
  if (fresh.length === 0) {
    return { connectorId, created: 0, skipped: 0, lastSeenMessageId: lastSeen }
  }

  // Resolve target space + channel slug.
  const target = await resolveTarget(payload, { tenantId, routingChannel })
  if (!target) {
    return { connectorId, created: 0, skipped: 0, lastSeenMessageId: lastSeen, error: 'Could not resolve AI Bus space/channel' }
  }

  let created = 0
  let skipped = 0
  let maxId = lastSeen

  for (const m of fresh) {
    const gotifyId = Number(m.id)
    if (gotifyId > maxId) maxId = gotifyId

    // Dedupe by Gotify message id (defensive — handles overlap if lastSeen lagged).
    try {
      const existing = await payload.find({
        collection: 'messages' as 'messages',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { 'metadata.gotifyMessageId': { equals: gotifyId } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs?.length) {
        skipped++
        continue
      }
    } catch {
      // fail-open for messages (better a possible dup than a dropped alert)
    }

    const title = (m.title || 'Gotify').trim()
    const bodyText = (m.message || '').trim()
    const content = title ? `🔔 **${title}**\n\n${bodyText}` : bodyText

    try {
      await payload.create({
        collection: 'messages' as 'messages',
        data: {
          content: wrapTextContent(content),
          space: Number(target.spaceId),
          channel: target.channelSlug,
          messageType: 'system',
          visibility: 'tenant',
          metadata: {
            source: 'gotify',
            gotifyMessageId: gotifyId,
            gotifyAppId: m.appid ?? null,
            gotifyPriority: m.priority ?? null,
            gotifyDate: m.date ?? null,
            title,
          },
          tenant: tenantId,
        } as never,
        overrideAccess: true,
      })
      created++
    } catch (err) {
      logCaughtError('gotify-poll/create-message', err)
      skipped++
    }
  }

  return { connectorId, created, skipped, lastSeenMessageId: maxId }
}

/**
 * Resolve the { spaceId, channelSlug } to route gotify messages into.
 * Prefers the connector's routingChannel; else the AI Bus `gotify` channel.
 */
async function resolveTarget(
  payload: Payload,
  opts: { tenantId: string; routingChannel?: string },
): Promise<{ spaceId: number | string; channelSlug: string } | null> {
  // 1. Explicit routing channel on the connector.
  if (opts.routingChannel) {
    try {
      const ch = await payload.findByID({
        collection: 'channels',
        id: opts.routingChannel,
        depth: 0,
        overrideAccess: true,
      })
      if (ch && (ch as { slug?: string }).slug) {
        const spaceRaw = (ch as { space?: unknown }).space
        const spaceId =
          spaceRaw && typeof spaceRaw === 'object'
            ? (spaceRaw as { id: number | string }).id
            : (spaceRaw as number | string)
        if (spaceId != null) return { spaceId, channelSlug: String((ch as { slug: string }).slug) }
      }
    } catch {
      // fall through to AI Bus default
    }
  }

  // 2. AI Bus space + `gotify` channel (self-healed by ensureSystemSpace).
  const spaceId = await ensureSystemSpace(opts.tenantId)
  if (!spaceId) return null
  return { spaceId, channelSlug: GOTIFY_CHANNEL_SLUG }
}
