/**
 * Slack Webhook Endpoint — Event Subscriptions handler.
 *
 * POST /api/slack/webhook
 *
 * Handles:
 *   - URL verification challenge (Slack sends this on Event Subscription setup)
 *   - HMAC-SHA256 signature verification via X-Slack-Signature
 *   - Message events → bridge → LEO → reply via chat.postMessage
 *   - Bot message filtering (avoids infinite loops)
 *   - Deduplication via event_id + message ts
 *
 * @see https://api.slack.com/apis/events-api
 */
import type { PayloadHandler } from 'payload'
import crypto from 'crypto'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import {
  findOrCreateBridgeChannel,
  findOrCreateGuestUser,
  markConnectorActive,
  markConnectorError,
  isMessageDuplicate,
  getChannelSource,
  getMessageType,
} from '@/utilities/bridgeHelpers'
import { wrapTextContent } from '@/utilities/messageContent'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { logCaughtError } from '@/utilities/logError'

// ── Module-level connector cache ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connectorCache: Map<string, any> | null = null
let cacheLoadedAt = 0
const CACHE_TTL = 120_000 // 2 minutes

async function resolveConnectorBySigningSecret(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  signingSecret: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  if (!connectorCache || Date.now() - cacheLoadedAt > CACHE_TTL) {
    try {
      const connectors = await findAllConnectors(payload, 'slack')
      connectorCache = new Map()
      for (const conn of connectors) {
        const secret = conn.config?.signingSecret as string
        if (secret) connectorCache.set(secret, conn)
      }
      cacheLoadedAt = Date.now()
    } catch {
      connectorCache = null
      return null
    }
  }
  return connectorCache?.get(signingSecret) || null
}

// ── Main Handler ─────────────────────────────────────────────

export const slackWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const request = req as unknown as Request

  // ── Read raw body for signature verification ────────────────
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── URL Verification Challenge ──────────────────────────────
  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge })
  }

  // ── Signature Verification ──────────────────────────────────
  const timestamp = request.headers.get('x-slack-request-timestamp') || ''
  const slackSignature = request.headers.get('x-slack-signature') || ''

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) {
    return Response.json({ error: 'Request too old' }, { status: 403 })
  }

  // We need to find the connector by trying all signing secrets
  // First, try to load all Slack connectors
  const allConnectors = await findAllConnectors(payload, 'slack')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchedConnector: any = null

  for (const conn of allConnectors) {
    const signingSecret = conn.config?.signingSecret as string
    if (!signingSecret) continue

    const sigBasestring = `v0:${timestamp}:${rawBody}`
    const expectedSig = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')

    const expectedBuf = new Uint8Array(Buffer.from(expectedSig))
    const actualBuf = new Uint8Array(Buffer.from(slackSignature || ''))
    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      matchedConnector = conn
      break
    }
  }

  if (!matchedConnector) {
    // Log but don't reveal details
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── Parse event ─────────────────────────────────────────────
  const event = body.event as Record<string, unknown> | undefined
  if (!event || event.type !== 'message') {
    // Non-message events (reactions, member_joined, etc.) — ack silently
    return Response.json({ ok: true })
  }

  // Skip bot messages to avoid infinite reply loops
  if (event.bot_id || event.subtype === 'bot_message') {
    return Response.json({ ok: true })
  }

  // Skip message subtypes (file_share, message_changed, etc.) — only handle plain text
  if (event.subtype) {
    return Response.json({ ok: true })
  }

  const text = String(event.text || '').trim()
  const userId = String(event.user || '')
  const channelId = String(event.channel || '')
  const messageTs = String(event.ts || '')
  const threadTs = (event.thread_ts as string) || undefined

  if (!text || !userId || !channelId) {
    return Response.json({ ok: true })
  }

  // ── Resolve tenant ──────────────────────────────────────────
  const tenantId = matchedConnector.tenantId
  if (!tenantId) {
    await markConnectorError(payload, matchedConnector.id, 'No tenant assigned')
    return Response.json({ error: 'No tenant' }, { status: 500 })
  }

  // ── Deduplication ───────────────────────────────────────────
  const eventId = String(body.event_id || messageTs)
  const isDup = await isMessageDuplicate(payload, {
    source: 'slack',
    externalMessageId: eventId,
    tenantId,
  })
  if (isDup) {
    return Response.json({ ok: true })
  }

  // ── Process message ─────────────────────────────────────────
  try {
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (!dmSpaceId) {
      return Response.json({ error: 'Failed to resolve DM space' }, { status: 500 })
    }

    const slug = `slack-${userId}`
    const channel = await findOrCreateBridgeChannel(payload, {
      tenantId,
      dmSpaceId: typeof dmSpaceId === 'string' ? parseInt(dmSpaceId, 10) : dmSpaceId,
      slug,
      displayName: `Slack: ${userId}`,
      source: getChannelSource('slack'),
    })

    const guest = await findOrCreateGuestUser(payload, {
      externalId: userId,
      displayName: userId, // Will be resolved to real name on subsequent messages
      source: 'slack',
      tenantId,
    })

    // Store inbound message
    await payload.create({
      collection: 'messages' as 'payload-locked-documents',
      data: {
        tenant: typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId,
        channel: channel.channelId,
        author: guest.id,
        content: wrapTextContent(text),
        type: getMessageType('slack'),
        externalMessageId: messageTs,
      } as any,
      overrideAccess: true,
    })

    // ── LEO Processing ──────────────────────────────────────
    const leoResult = await leoProcessMessage({
      message: text,
      conversationId: channel.channelId,
      tenantId,
      channelSlug: slug,
      spaceId: dmSpaceId,
      payload,
      userContext: { id: guest.id, name: guest.name },
    })

    // ── Reply via Slack API ─────────────────────────────────
    if (leoResult?.text) {
      const botToken = matchedConnector.config?.botToken as string
      if (botToken) {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelId,
            text: leoResult.text,
            thread_ts: threadTs || messageTs, // Reply in thread
          }),
        })
      }
    }

    await markConnectorActive(payload, matchedConnector.id)
    return Response.json({ ok: true })
  } catch (err) {
    await markConnectorError(payload, matchedConnector.id, err instanceof Error ? err.message : 'Unknown error')
    logCaughtError('slack-webhook', err, { tenantId })
    return Response.json({ ok: true }) // Always 200 to Slack
  }
}
