import type { PayloadHandler } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'
import {
  findOrCreateBridgeChannel,
  findOrCreateGuestUser,
  markConnectorActive,
  markConnectorError,
  getMessageType,
} from '@/utilities/bridgeHelpers'

/**
 * POST /api/bridge/inbound
 *
 * Generic inbound message bridge for external channels.
 * Receives messages from any source (SMS, Google Chat, custom webhooks)
 * and routes them through the standard Connector -> DM -> LEO -> Reply pipeline.
 *
 * For WhatsApp and Discord, use their dedicated webhook endpoints instead:
 *   - POST /api/whatsapp/webhook (Meta Cloud API format)
 *   - POST /api/discord/webhook (Discord bot bridge format)
 *   - POST /api/telegram/webhook (Telegram Bot API format)
 *
 * This endpoint handles sources that don't have a dedicated webhook:
 *   - SMS (Twilio) — until dedicated Twilio handler is built
 *   - Google Chat
 *   - Custom webhooks (any source with a connectorId)
 *
 * Body:
 *   - source: 'sms' | 'google_chat' | 'webhook'
 *   - externalUserId: string  (phone number, email address, etc.)
 *   - externalUserName?: string  (display name)
 *   - message: string
 *   - metadata?: Record<string, unknown>  (source-specific data)
 *   - tenantId: string | number
 *   - connectorId?: string  (for webhook secret validation)
 *
 * Headers:
 *   - X-Bridge-Secret: <connector webhookSecret>  (required when connectorId is provided)
 */
export const bridgeInboundHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Parse body ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    source,
    externalUserId,
    externalUserName,
    message,
    metadata,
    tenantId,
    connectorId,
  } = body

  if (!source || !externalUserId || !message || !tenantId) {
    return Response.json(
      { message: 'Missing required fields: source, externalUserId, message, tenantId' },
      { status: 400 },
    )
  }

  const validSources = ['sms', 'google_chat', 'webhook', 'whatsapp', 'email']
  if (!validSources.includes(source as string)) {
    return Response.json(
      { message: `Invalid source. Must be one of: ${validSources.join(', ')}` },
      { status: 400 },
    )
  }

  // ── Validate connector webhook secret (if connectorId provided) ──
  if (connectorId) {
    try {
      const connector = await payload.findByID({
        collection: 'connectors',
        id: String(connectorId),
        depth: 0,
        overrideAccess: true,
      })

      if (!connector) {
        return Response.json({ message: 'Unknown connector' }, { status: 404 })
      }

      if (!(connector as any).enabled || (connector as any).status === 'error') {
        return Response.json({ message: 'Connector is disabled or in error state' }, { status: 403 })
      }

      // Validate webhook secret
      const cfg = ((connector as any).config || {}) as Record<string, unknown>
      const webhookSecret = cfg.webhookSecret
      if (webhookSecret) {
        const incomingSecret = (req as Request).headers.get('x-bridge-secret')
        if (incomingSecret !== String(webhookSecret)) {
          return Response.json({ message: 'Invalid webhook secret' }, { status: 401 })
        }
      }
    } catch (err) {
      return Response.json({ message: 'Failed to validate connector' }, { status: 500 })
    }
  }

  try {
    // ── Ensure DM space ──────────────────────────────────────
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (!dmSpaceId) {
      return Response.json({ message: 'Failed to ensure DM space' }, { status: 500 })
    }

    // ── Build channel slug ───────────────────────────────────
    const sanitizedId = String(externalUserId).replace(/[^a-zA-Z0-9]/g, '')
    const channelSlug = `${source}-${sanitizedId}`
    const displayName = externalUserName || externalUserId

    // ── Find or create channel (shared helper) ───────────────
    await findOrCreateBridgeChannel(payload, {
      tenantId,
      dmSpaceId: Number(dmSpaceId),
      slug: channelSlug,
      displayName: String(displayName),
      source: String(source),
    })

    // ── Find or create external user (shared helper) ─────────
    const user = await findOrCreateGuestUser(payload, {
      externalId: String(externalUserId),
      displayName: String(displayName),
      source: String(source),
      tenantId,
    })

    // ── Map source to messageType (shared helper) ────────────
    const messageType = getMessageType(String(source))

    // ── Create inbound message ───────────────────────────────
    try {
      await payload.create({
        collection: 'messages' as any,
        data: {
          content: wrapTextContent(String(message)),
          space: Number(dmSpaceId),
          channel: channelSlug,
          messageType,
          metadata: {
            source,
            externalUserId,
            ...(connectorId ? { connectorId } : {}),
            ...(metadata && typeof metadata === 'object' ? metadata : {}),
          },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
    } catch (persistErr) {
      console.warn('[bridge-inbound] Non-fatal: failed to persist inbound message:', persistErr)
    }

    // ── Process through LEO ──────────────────────────────────
    const conversationId = `${source}-${sanitizedId}`
    let leoReply = ''
    let agentName = 'LEO'

    try {
      const result = await leoProcessMessage({
        message: String(message),
        conversationId,
        tenantId,
        channelSlug,
        spaceId: Number(dmSpaceId),
        payload,
        userContext: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      leoReply = result.text
      agentName = result.agentName || 'LEO'
    } catch (leoErr) {
      leoReply = 'Thank you for your message. I\'ll follow up shortly.'
      await logError({
        source: 'bridge-inbound',
        message: `LEO response generation failed for ${source}`,
        details: leoErr instanceof Error ? leoErr.message : String(leoErr),
      })
    }

    // ── Persist LEO response ─────────────────────────────────
    if (leoReply) {
      try {
        await payload.create({
          collection: 'messages' as any,
          data: {
            content: wrapTextContent(leoReply),
            space: Number(dmSpaceId),
            channel: channelSlug,
            messageType: 'ai_agent',
            metadata: {
              source,
              agentName,
              conversationId,
              ...(connectorId ? { connectorId } : {}),
            },
            tenant: tenantId,
          } as any,
          overrideAccess: true,
        })
      } catch (persistErr) {
        console.warn('[bridge-inbound] Non-fatal: failed to persist LEO response:', persistErr)
      }
    }

    // ── Update connector activity (shared helper) ────────────
    if (connectorId) {
      await markConnectorActive(payload, String(connectorId))
    }

    return Response.json({
      status: 'ok',
      reply: leoReply,
      conversationId,
      agentName,
      channelSlug,
    })
  } catch (err) {
    await logError({
      source: 'bridge-inbound',
      message: `Bridge inbound processing failed for ${source}`,
      details: err instanceof Error ? err.message : String(err),
    })

    // Mark connector error if applicable
    if (connectorId) {
      await markConnectorError(
        payload,
        String(connectorId),
        err instanceof Error ? err.message : 'Unknown error',
      )
    }

    return Response.json(
      { message: 'Internal server error', error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
