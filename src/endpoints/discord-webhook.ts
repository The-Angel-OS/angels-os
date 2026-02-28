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
 * 3. Finds or creates a Payload user from Discord identity
 * 4. Processes through leoProcessMessage()
 * 5. Persists to AI Bus (Messages collection)
 * 6. Returns response for the bot to send back
 *
 * ## AI Bus Integration
 *
 * Discord messages are persisted with messageType 'discord_message'
 * and metadata.source = 'discord'. This makes Discord conversations
 * visible alongside chat, email, and voice channels.
 *
 * @see src/discord/bot.ts — Bot bridge that sends to this endpoint
 * @see src/utilities/resolveConnector.ts — Connector resolution
 * @see src/endpoints/vapi-webhook.ts — Blueprint for this pattern
 *
 * Sprint 33 — Discord Integration · Multi-Tenant Bot Bridge
 */
import type { PayloadHandler } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { formatForDiscord } from '@/utilities/discord-formatter'

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

    // ─── Resolve Payload user from Discord identity ────────────
    const payloadUser = await resolveDiscordUser(payload, body.userId, body.userName, tenantId)

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

    // ─── Resolve channel slug ──────────────────────────────────
    const channelSlug = body.isDM ? 'discord-dm' : (body.channelName || 'discord')

    // ─── Process through LEO ───────────────────────────────────
    const result = await leoProcessMessage({
      message: messageContent,
      conversationId,
      tenantId,
      channelSlug,
      payload,
      userContext: {
        id: payloadUser.id,
        name: payloadUser.name,
        email: payloadUser.email,
      },
    })

    // ─── Format response for Discord ───────────────────────────
    const formattedText = formatForDiscord(result.text)

    // ─── Persist to AI Bus ─────────────────────────────────────
    try {
      // User message
      await payload.create({
        collection: 'messages' as any,
        data: {
          content: {
            type: 'text',
            text: messageContent,
          },
          messageType: 'discord_message',
          metadata: {
            source: 'discord',
            discordUserId: body.userId,
            discordGuildId: body.guildId,
            discordChannelId: body.channelId,
            connectorId: body.connectorId,
            conversationId,
          },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })

      // LEO response
      await payload.create({
        collection: 'messages' as any,
        data: {
          content: {
            type: 'text',
            text: result.text,
          },
          messageType: 'ai_agent',
          metadata: {
            source: 'discord',
            agentName: result.agentName,
            conversationId,
            connectorId: body.connectorId,
          },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
    } catch (err) {
      // AI Bus persistence is non-fatal — don't fail the response
      console.error('[Discord Webhook] Failed to persist to AI Bus:', err)
    }

    // ─── Update connector lastActivity ─────────────────────────
    try {
      await payload.update({
        collection: 'connectors' as any,
        id: body.connectorId,
        data: {
          lastActivity: new Date().toISOString(),
          status: 'active',
          errorMessage: '',
        } as any,
        overrideAccess: true,
      })
      // Invalidate connector cache for this connector
      connectorCache.delete(body.connectorId)
    } catch {
      // Non-fatal
    }

    // ─── Return response ───────────────────────────────────────
    const response: DiscordWebhookResponse = {
      text: formattedText,
      conversationId: result.conversationId,
      agentName: result.agentName || 'LEO',
    }

    return Response.json(response)
  } catch (err) {
    console.error('[Discord Webhook] Unhandled error:', err)

    // Try to update connector status on error
    if (body.connectorId) {
      try {
        await payload.update({
          collection: 'connectors' as any,
          id: body.connectorId,
          data: {
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          } as any,
          overrideAccess: true,
        })
        connectorCache.delete(body.connectorId)
      } catch {
        // Double-fault — nothing we can do
      }
    }

    return Response.json(
      { error: 'Internal server error', text: 'Sorry, I encountered an error processing your message. Please try again.' },
      { status: 500 },
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Find or create a Payload user from a Discord identity.
 * Looks up by socialProviders.providerId first, creates guest if not found.
 */
async function resolveDiscordUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  discordUserId: string,
  discordUserName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantId: any,
): Promise<{ id: string | number; name: string; email: string }> {
  // Try to find by Discord provider ID
  try {
    const byProvider = await payload.find({
      collection: 'users',
      where: {
        'socialProviders.providerId': { equals: discordUserId },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (byProvider.docs?.length > 0) {
      const user = byProvider.docs[0]
      return {
        id: user.id,
        name: user.name || discordUserName,
        email: user.email,
      }
    }
  } catch {
    // Fall through to guest creation
  }

  // Create guest user
  const syntheticEmail = `discord-${discordUserId}@guests.angel-os.local`

  // Check if guest already exists (may have been created in a previous message)
  try {
    const existingGuest = await payload.find({
      collection: 'users',
      where: { email: { equals: syntheticEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingGuest.docs?.length > 0) {
      const user = existingGuest.docs[0]
      return {
        id: user.id,
        name: user.name || discordUserName,
        email: user.email,
      }
    }
  } catch {
    // Fall through to creation
  }

  // Create new guest user
  try {
    const crypto = await import('crypto')
    const user = await payload.create({
      collection: 'users',
      data: {
        email: syntheticEmail,
        name: discordUserName,
        password: crypto.randomUUID() + crypto.randomUUID(),
        roles: ['customer'],
        socialProviders: [
          {
            provider: 'discord',
            providerId: discordUserId,
            displayName: discordUserName,
            linkedAt: new Date().toISOString(),
          },
        ],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    return {
      id: user.id,
      name: user.name || discordUserName,
      email: user.email,
    }
  } catch (err) {
    console.error('[Discord Webhook] Failed to create guest user:', err)
    // Return a minimal user context so LEO can still respond
    return {
      id: 0,
      name: discordUserName,
      email: syntheticEmail,
    }
  }
}
