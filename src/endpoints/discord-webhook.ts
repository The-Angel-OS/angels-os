/**
 * Discord Webhook — POST /api/discord/webhook
 *
 * Receives forwarded Discord messages from bot bridge instances,
 * processes them through LEO, and returns the response.
 *
 * ## Multi-Tenant Architecture
 *
 * Each tenant has their own Discord bot (via Connectors collection).
 * The bot bridge identifies the connector by ID and forwards messages
 * to this endpoint. The handler:
 *
 * 1. Validates the per-connector webhook secret
 * 2. Resolves tenant from the connector
 * 3. Deduplicates via Discord message ID
 * 4. Finds or creates a Payload user from Discord identity
 * 5. Processes through leoProcessMessage()
 * 6. Persists to AI Bus (Messages collection)
 * 7. Returns response for the bot to send back
 *
 * ## AI Bus Integration
 *
 * Discord messages are persisted with messageType 'discord_message'
 * and metadata.source = 'discord'. This makes Discord conversations
 * visible alongside chat, email, and voice channels.
 *
 * @see src/discord/bot.ts — Bot bridge that sends to this endpoint
 * @see src/utilities/bridgeHelpers.ts — Shared bridge utilities
 * @see src/utilities/resolveConnector.ts — Connector resolution
 *
 * Sprint 33 — Discord Integration · Multi-Tenant Bot Bridge
 */
import type { PayloadHandler } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { formatForDiscord } from '@/utilities/discord-formatter'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'
import {
  findOrCreateBridgeChannel,
  findOrCreateGuestUser,
  markConnectorActive,
  markConnectorError,
  isMessageDuplicate,
} from '@/utilities/bridgeHelpers'

// ─── In-Memory Connector Cache (60s TTL) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connectorCache = new Map<string, { doc: any; loadedAt: number }>()
const CONNECTOR_CACHE_TTL = 60_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getConnector(payload: any, connectorId: string): Promise<any | null> {
  const cached = connectorCache.get(connectorId)
  if (cached && Date.now() - cached.loadedAt < CONNECTOR_CACHE_TTL) {
    return cached.doc
  }

  try {
    const doc = await payload.findByID({
      collection: 'connectors',
      id: connectorId,
      depth: 0,
      overrideAccess: true,
    })
    if (doc) {
      connectorCache.set(connectorId, { doc, loadedAt: Date.now() })
    }
    return doc || null
  } catch {
    // Return stale cache on error
    return cached?.doc || null
  }
}

// ─── Request / Response Types ────────────────────────────────

export interface DiscordWebhookRequest {
  type: 'message' | 'slash_command'
  content: string
  connectorId: string
  guildId: string | null
  channelId: string
  channelName: string
  userId: string
  userName: string
  isDM: boolean
  threadId?: string
  commandName?: string
  messageId?: string
}

export interface DiscordWebhookResponse {
  text: string
  conversationId: string
  agentName: string
  images?: Array<{ url: string; alt?: string }>
}

// ─── Main Handler ────────────────────────────────────────────

export const discordWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ─── Parse request body ────────────────────────────────────
  let body: DiscordWebhookRequest
  try {
    body = (await (req as Request).json()) as DiscordWebhookRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  if (!body.content && body.type !== 'slash_command') {
    return Response.json({ error: 'Missing message content' }, { status: 400 })
  }

  if (!body.connectorId) {
    return Response.json({ error: 'Missing connectorId' }, { status: 400 })
  }

  if (!body.userId || !body.userName) {
    return Response.json({ error: 'Missing userId or userName' }, { status: 400 })
  }

  try {
    // ─── Validate connector + webhook secret ───────────────────
    const connector = await getConnector(payload, body.connectorId)

    if (!connector) {
      return Response.json({ error: 'Unknown connector' }, { status: 404 })
    }

    if (connector.type !== 'discord') {
      return Response.json({ error: 'Connector is not a discord type' }, { status: 400 })
    }

    if (!connector.enabled || connector.status === 'error') {
      return Response.json({ error: 'Connector is disabled' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (connector.config || {}) as Record<string, any>
    const webhookSecret = config.webhookSecret

    if (webhookSecret) {
      const incomingSecret = (req as Request).headers.get('x-discord-secret')
      if (incomingSecret !== webhookSecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // ─── Resolve tenant from connector ─────────────────────────
    const tenantId = connector.tenant
    if (!tenantId) {
      return Response.json({ error: 'Connector has no tenant assigned' }, { status: 500 })
    }

    // ─── Deduplication ────────────────────────────────────────
    if (body.messageId) {
      const isDup = await isMessageDuplicate(payload, {
        source: 'discord',
        externalMessageId: body.messageId,
        tenantId,
      })
      if (isDup) {
        return Response.json({ text: '', conversationId: '', agentName: 'LEO' })
      }
    }

    // ─── Ensure DM space ──────────────────────────────────────
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (!dmSpaceId) {
      return Response.json({ error: 'Failed to ensure DM space' }, { status: 500 })
    }

    // ─── Build channel slug ───────────────────────────────────
    const channelSlug = body.isDM
      ? `discord-dm-${body.userId}`
      : `discord-${body.channelId}`

    const channelDisplayName = body.isDM
      ? body.userName
      : `#${body.channelName || body.channelId}`

    // ─── Find or create channel (shared helper) ────────────────
    await findOrCreateBridgeChannel(payload, {
      tenantId,
      dmSpaceId: Number(dmSpaceId),
      slug: channelSlug,
      displayName: channelDisplayName,
      source: 'discord',
      description: body.isDM
        ? `Discord DM with ${body.userName}`
        : `Discord channel #${body.channelName}`,
    })

    // ─── Resolve Payload user (shared helper) ──────────────────
    const payloadUser = await findOrCreateGuestUser(payload, {
      externalId: body.userId,
      displayName: body.userName,
      source: 'discord',
      tenantId,
      socialProvider: {
        provider: 'discord',
        providerId: body.userId,
        displayName: body.userName,
      },
    })

    // ─── Build conversation ID ─────────────────────────────────
    let conversationId: string
    if (body.isDM) {
      conversationId = `discord-dm-${body.userId}`
    } else if (body.threadId) {
      conversationId = `discord-${body.guildId}-${body.threadId}`
    } else {
      conversationId = `discord-${body.guildId}-${body.channelId}`
    }

    // ─── Route slash commands to natural language ──────────────
    let messageContent = body.content || ''
    if (body.type === 'slash_command' && body.commandName) {
      switch (body.commandName) {
        case 'pulse':
          messageContent = 'Show me the federation pulse'
          break
        case 'weather':
          messageContent = 'Give me the federation weather report'
          break
        case 'ask':
          // content already has the question
          break
        default:
          messageContent = messageContent || `/${body.commandName}`
      }
    }

    if (!messageContent) {
      messageContent = 'Hello'
    }

    // ─── Create inbound message ───────────────────────────────
    await payload.create({
      collection: 'messages' as any,
      data: {
        content: wrapTextContent(messageContent),
        space: Number(dmSpaceId),
        channel: channelSlug,
        messageType: 'discord_message',
        metadata: {
          source: 'discord',
          discordUserId: body.userId,
          discordMessageId: body.messageId || '',
          discordGuildId: body.guildId,
          discordChannelId: body.channelId,
          connectorId: body.connectorId,
          conversationId,
        },
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // ─── Process through LEO ───────────────────────────────────
    const result = await leoProcessMessage({
      message: messageContent,
      conversationId,
      tenantId,
      channelSlug,
      spaceId: Number(dmSpaceId),
      payload,
      userContext: {
        id: payloadUser.id,
        name: payloadUser.name,
        email: payloadUser.email,
      },
    })

    // ─── Format response for Discord ───────────────────────────
    const formattedText = formatForDiscord(result.text)

    // ─── Persist LEO response ──────────────────────────────────
    if (result.text) {
      await payload.create({
        collection: 'messages' as any,
        data: {
          content: wrapTextContent(result.text),
          space: Number(dmSpaceId),
          channel: channelSlug,
          messageType: 'ai_agent',
          metadata: {
            source: 'discord',
            agentName: result.agentName || 'LEO',
            conversationId,
            connectorId: body.connectorId,
          },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
    }

    // ─── Update connector activity (shared helper) ─────────────
    await markConnectorActive(payload, body.connectorId)
    connectorCache.delete(body.connectorId)

    // ─── Return response ───────────────────────────────────────
    const response: DiscordWebhookResponse = {
      text: formattedText,
      conversationId: result.conversationId,
      agentName: result.agentName || 'LEO',
    }

    return Response.json(response)
  } catch (err) {
    await logError({
      source: 'discord-webhook',
      message: 'Failed to process Discord message',
      details: err instanceof Error ? err.message : String(err),
    })

    // Mark connector error (shared helper)
    if (body.connectorId) {
      await markConnectorError(
        payload,
        body.connectorId,
        err instanceof Error ? err.message : 'Unknown error',
      )
      connectorCache.delete(body.connectorId)
    }

    return Response.json(
      { error: 'Internal server error', text: 'Sorry, I encountered an error processing your message. Please try again.' },
      { status: 500 },
    )
  }
}
