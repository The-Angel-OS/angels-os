/**
 * Telegram Webhook — POST /api/telegram/webhook
 *
 * Receives inbound Telegram messages via Bot API webhook,
 * processes them through LEO, and sends replies back via Telegram.
 *
 * ## Multi-Tenant Architecture
 *
 * Each tenant configures their own Telegram bot via the Connectors
 * collection (type: 'telegram'). The handler:
 *
 * 1. Validates webhook secret via X-Telegram-Bot-Api-Secret-Token header
 * 2. Resolves the connector by bot token prefix (bot user ID)
 * 3. Deduplicates via Telegram update_id
 * 4. Finds or creates a Payload user from Telegram identity
 * 5. Processes through leoProcessMessage()
 * 6. Persists to AI Bus (Messages collection)
 * 7. Sends reply via Telegram Bot API
 *
 * ## Connector Config
 *
 * Stored in Connectors.config JSON:
 * {
 *   "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
 *   "webhookSecret": "my-custom-secret"  // For X-Telegram-Bot-Api-Secret-Token
 * }
 *
 * ## Supported Message Types
 *
 * - Text messages -> processed through LEO
 * - Photo messages -> logged with caption
 * - Document messages -> logged with filename
 * - Voice/Audio messages -> logged as audio
 * - Video messages -> logged with caption
 * - Location messages -> logged with lat/lng
 * - Contact messages -> logged with phone + name
 * - Sticker messages -> logged as sticker
 *
 * ## Webhook Setup
 *
 * After creating the connector, set the webhook URL via Telegram Bot API:
 *   curl https://api.telegram.org/bot{TOKEN}/setWebhook \
 *     -F "url=https://yourdomain.com/api/telegram/webhook" \
 *     -F "secret_token={WEBHOOK_SECRET}"
 *
 * @see src/utilities/bridgeHelpers.ts — Shared bridge utilities
 * @see https://core.telegram.org/bots/api#update
 */
import type { PayloadHandler } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { logError } from '@/utilities/logError'
import {
  findOrCreateBridgeChannel,
  findOrCreateGuestUser,
  markConnectorActive,
  isMessageDuplicate,
} from '@/utilities/bridgeHelpers'

// ─── Bot Token → Connector Index ─────────────────────────────
// Maps bot user ID (first part of token, e.g., "123456") to connector
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let botIndex: Map<string, any> | null = null
let botIndexLoadedAt = 0
const BOT_INDEX_TTL = 120_000 // 2 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveConnectorBySecret(payload: any, secretToken: string): Promise<any | null> {
  // Rebuild index if stale
  if (!botIndex || Date.now() - botIndexLoadedAt > BOT_INDEX_TTL) {
    try {
      const connectors = await findAllConnectors(payload, 'telegram')
      botIndex = new Map()
      for (const conn of connectors) {
        const secret = String(conn.config.webhookSecret || '')
        if (secret) {
          // Fetch full doc for tenant info
          const fullDoc = await payload.findByID({
            collection: 'connectors',
            id: conn.id,
            depth: 0,
            overrideAccess: true,
          })
          if (fullDoc) {
            botIndex.set(secret, fullDoc)
          }
        }
      }
      botIndexLoadedAt = Date.now()
    } catch {
      // Fall through
    }
  }

  return botIndex?.get(secretToken) || null
}

// ─── Webhook Handler (POST) ──────────────────────────────────

export const telegramWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Parse request body ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await (req as Request).json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Telegram sends Updates: https://core.telegram.org/bots/api#update
  const updateId = body.update_id
  const message = body.message || body.edited_message || body.channel_post

  if (!message) {
    // Could be a callback_query, inline_query, etc. — acknowledge and skip
    return Response.json({ status: 'ignored' })
  }

  // ── Resolve connector by webhook secret ─────────────────────
  const secretToken = (req as Request).headers.get('x-telegram-bot-api-secret-token') || ''

  if (!secretToken) {
    return Response.json({ error: 'Missing secret token' }, { status: 401 })
  }

  const connector = await resolveConnectorBySecret(payload, secretToken)

  if (!connector) {
    await logError({
      source: 'telegram-webhook',
      message: 'No Telegram connector found for webhook secret',
      details: 'Incoming message ignored — configure a Telegram connector with this webhook secret.',
    })
    return Response.json({ error: 'Unknown bot' }, { status: 404 })
  }

  if (!connector.enabled || connector.status === 'error') {
    return Response.json({ status: 'ignored' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = (connector.config || {}) as Record<string, any>
  const botToken = String(config.botToken || '')
  const tenantId = connector.tenant

  if (!tenantId || !botToken) {
    await logError({
      source: 'telegram-webhook',
      message: 'Telegram connector missing tenant or botToken',
      details: `Connector ID: ${connector.id}`,
    })
    return Response.json({ error: 'Misconfigured connector' }, { status: 500 })
  }

  try {
    // ── Extract sender info ───────────────────────────────────
    const from = message.from || {}
    const telegramUserId = String(from.id || '')
    const firstName = from.first_name || ''
    const lastName = from.last_name || ''
    const username = from.username || ''
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || telegramUserId
    const chatId = String(message.chat?.id || '')

    if (!telegramUserId || !chatId) {
      return Response.json({ status: 'ignored' })
    }

    // ── Deduplication ────────────────────────────────────────
    // Telegram guarantees update_id uniqueness, but retries may occur
    if (updateId) {
      const isDup = await isMessageDuplicate(payload, {
        source: 'telegram',
        externalMessageId: String(updateId),
        tenantId,
      })
      if (isDup) {
        return Response.json({ status: 'duplicate' })
      }
    }

    // ── Extract message content ──────────────────────────────
    const { text: messageText, mediaInfo } = extractTelegramContent(message)

    if (!messageText) {
      return Response.json({ status: 'no_content' })
    }

    // ── Ensure DM space ──────────────────────────────────────
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (!dmSpaceId) {
      await logError({
        source: 'telegram-webhook',
        message: `Failed to ensure DM space for tenant ${tenantId}`,
      })
      return Response.json({ error: 'Internal error' }, { status: 500 })
    }

    // ── Find or create channel (shared helper) ────────────────
    const channelSlug = `telegram-${telegramUserId}`

    await findOrCreateBridgeChannel(payload, {
      tenantId,
      dmSpaceId: Number(dmSpaceId),
      slug: channelSlug,
      displayName,
      source: 'telegram',
      description: `Telegram thread with ${displayName}${username ? ` (@${username})` : ''}`,
    })

    // ── Resolve Payload user (shared helper) ──────────────────
    const payloadUser = await findOrCreateGuestUser(payload, {
      externalId: telegramUserId,
      displayName,
      source: 'telegram',
      tenantId,
      socialProvider: {
        provider: 'telegram',
        providerId: telegramUserId,
        displayName,
      },
    })

    // ── Create inbound message ───────────────────────────────
    const inboundContent = mediaInfo
      ? `${messageText}\n\n_[${mediaInfo}]_`
      : messageText

    await payload.create({
      collection: 'messages' as any,
      data: {
        content: wrapTextContent(inboundContent),
        space: Number(dmSpaceId),
        channel: channelSlug,
        messageType: 'telegram_message',
        metadata: {
          source: 'telegram',
          telegramMessageId: String(updateId || message.message_id || ''),
          telegramUserId,
          telegramUsername: username,
          telegramChatId: chatId,
          connectorId: connector.id,
        },
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // ── Process through LEO ──────────────────────────────────
    const conversationId = `telegram-${telegramUserId}`
    let leoReply = ''

    try {
      const result = await leoProcessMessage({
        message: messageText,
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
      leoReply = result.text
    } catch (leoErr) {
      leoReply = `Thank you for reaching out! I've received your message and will follow up shortly.`
      await logError({
        source: 'telegram-webhook',
        message: 'LEO response generation failed',
        details: leoErr instanceof Error ? leoErr.message : String(leoErr),
      })
    }

    // ── Persist LEO response ─────────────────────────────────
    if (leoReply) {
      await payload.create({
        collection: 'messages' as any,
        data: {
          content: wrapTextContent(leoReply),
          space: Number(dmSpaceId),
          channel: channelSlug,
          messageType: 'ai_agent',
          metadata: {
            source: 'telegram',
            agentName: 'LEO',
            conversationId,
            connectorId: connector.id,
            replyTo: chatId,
          },
          tenant: tenantId,
        } as any,
        overrideAccess: true,
      })
    }

    // ── Send reply via Telegram Bot API ───────────────────────
    let replied = false
    if (leoReply && botToken && chatId) {
      try {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: leoReply,
          parseMode: 'Markdown',
        })
        replied = true
      } catch (sendErr) {
        // Retry without Markdown if parsing fails (Telegram is strict about MarkdownV2)
        try {
          await sendTelegramMessage({
            botToken,
            chatId,
            text: leoReply,
          })
          replied = true
        } catch (retryErr) {
          await logError({
            source: 'telegram-webhook',
            message: 'Telegram reply failed',
            details: retryErr instanceof Error ? retryErr.message : String(retryErr),
          })
        }
      }
    }

    // ── Update connector activity ────────────────────────────
    await markConnectorActive(payload, connector.id)
    // Clear bot index cache so config changes take effect
    if (botIndex) botIndex.delete(secretToken)

    return Response.json({
      status: 'ok',
      replied,
    })
  } catch (err) {
    await logError({
      source: 'telegram-webhook',
      message: 'Failed to process Telegram message',
      details: err instanceof Error ? err.message : String(err),
    })

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ─── Telegram Content Extraction ─────────────────────────────

function extractTelegramContent(msg: any): { text: string; mediaInfo?: string } {
  // Text message
  if (msg.text) {
    return { text: msg.text }
  }

  // Photo
  if (msg.photo) {
    return {
      text: msg.caption || 'Sent a photo',
      mediaInfo: 'Photo',
    }
  }

  // Document
  if (msg.document) {
    return {
      text: msg.caption || `Sent a document: ${msg.document.file_name || 'file'}`,
      mediaInfo: `Document: ${msg.document.file_name || 'file'}`,
    }
  }

  // Voice
  if (msg.voice) {
    return {
      text: 'Sent a voice message',
      mediaInfo: `Voice: ${msg.voice.duration || 0}s`,
    }
  }

  // Audio
  if (msg.audio) {
    return {
      text: msg.caption || `Sent audio: ${msg.audio.title || 'untitled'}`,
      mediaInfo: `Audio: ${msg.audio.title || msg.audio.file_name || 'audio'}`,
    }
  }

  // Video
  if (msg.video) {
    return {
      text: msg.caption || 'Sent a video',
      mediaInfo: `Video: ${msg.video.duration || 0}s`,
    }
  }

  // Video note (round video)
  if (msg.video_note) {
    return {
      text: 'Sent a video message',
      mediaInfo: `Video Note: ${msg.video_note.duration || 0}s`,
    }
  }

  // Location
  if (msg.location) {
    return {
      text: `Location: ${msg.location.latitude}, ${msg.location.longitude}`,
    }
  }

  // Venue
  if (msg.venue) {
    return {
      text: `Venue: ${msg.venue.title}${msg.venue.address ? ` — ${msg.venue.address}` : ''}`,
    }
  }

  // Contact
  if (msg.contact) {
    return {
      text: `Shared a contact: ${msg.contact.first_name || ''} ${msg.contact.last_name || ''}`.trim() +
        (msg.contact.phone_number ? ` (${msg.contact.phone_number})` : ''),
    }
  }

  // Sticker
  if (msg.sticker) {
    return {
      text: `(sticker: ${msg.sticker.emoji || ''})`,
      mediaInfo: 'Sticker',
    }
  }

  // Poll
  if (msg.poll) {
    return {
      text: `Poll: ${msg.poll.question}`,
    }
  }

  return { text: '' }
}

// ─── Telegram Bot API — Send Message ─────────────────────────

interface SendTelegramOptions {
  botToken: string
  chatId: string
  text: string
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'
}

async function sendTelegramMessage(opts: SendTelegramOptions): Promise<void> {
  const { botToken, chatId, text, parseMode } = opts

  // Telegram has a 4096 char limit per message
  const MAX_LENGTH = 4096
  const chunks = splitText(text, MAX_LENGTH)

  for (const chunk of chunks) {
    const bodyObj: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
    }
    if (parseMode) {
      bodyObj.parse_mode = parseMode
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Telegram API ${response.status}: ${errorBody}`)
    }
  }
}

// ─── Text Splitting ──────────────────────────────────────────

function splitText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    // Try to split at paragraph boundary
    let splitAt = remaining.lastIndexOf('\n\n', maxLength)
    if (splitAt < maxLength * 0.3) {
      // Try newline
      splitAt = remaining.lastIndexOf('\n', maxLength)
    }
    if (splitAt < maxLength * 0.3) {
      // Try sentence boundary
      splitAt = remaining.lastIndexOf('. ', maxLength)
      if (splitAt > 0) splitAt += 1 // Include the period
    }
    if (splitAt < maxLength * 0.3) {
      // Hard split at space
      splitAt = remaining.lastIndexOf(' ', maxLength)
    }
    if (splitAt < 1) {
      // Hard split at max length
      splitAt = maxLength
    }

    chunks.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }

  return chunks
}
