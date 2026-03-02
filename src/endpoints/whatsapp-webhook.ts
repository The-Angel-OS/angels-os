/**
 * WhatsApp Webhook — POST /api/whatsapp/webhook + GET (verification)
 *
 * Receives inbound WhatsApp messages via the Meta Cloud API webhook,
 * processes them through LEO, and sends replies back via WhatsApp.
 *
 * ## Multi-Tenant Architecture
 *
 * Each tenant configures their own WhatsApp Business account via the
 * Connectors collection (type: 'whatsapp'). The handler:
 *
 * 1. Verifies Meta webhook signature (X-Hub-Signature-256)
 * 2. Resolves the connector by phone number ID
 * 3. Finds or creates a Payload user from WhatsApp identity
 * 4. Processes through leoProcessMessage()
 * 5. Persists to AI Bus (Messages collection)
 * 6. Sends reply via Meta Cloud API
 *
 * ## Connector Config
 *
 * Stored in Connectors.config JSON:
 * {
 *   "provider": "meta",
 *   "phoneNumberId": "123456789",       // WhatsApp Business phone number ID
 *   "accessToken": "EAAx...",           // Permanent access token
 *   "verifyToken": "custom-verify-...", // Webhook verification token
 *   "appSecret": "abc123...",           // App secret for signature validation
 *   "businessName": "Hayes Cactus Farm" // Display name for messages
 * }
 *
 * ## Supported Message Types
 *
 * - Text messages → processed through LEO
 * - Image messages → logged with caption, image URL in metadata
 * - Document messages → logged with filename
 * - Location messages → logged with lat/lng
 * - Button/Interactive replies → processed as text
 *
 * @see src/utilities/resolveConnector.ts — Connector resolution
 * @see src/endpoints/discord-webhook.ts — Blueprint pattern
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
import type { PayloadHandler, Payload } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { logError } from '@/utilities/logError'

// ─── In-Memory Connector Cache (60s TTL) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connectorCache = new Map<string, { doc: any; loadedAt: number }>()
const CONNECTOR_CACHE_TTL = 60_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCachedConnector(payload: any, connectorId: string): Promise<any | null> {
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
    return cached?.doc || null
  }
}

// ─── Phone Number → Connector Index ──────────────────────────
// Maps WhatsApp phone_number_id to connector doc for O(1) webhook routing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let phoneNumberIndex: Map<string, any> | null = null
let phoneNumberIndexLoadedAt = 0
const INDEX_TTL = 120_000 // 2 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveConnectorByPhoneNumberId(payload: any, phoneNumberId: string): Promise<any | null> {
  // Rebuild index if stale
  if (!phoneNumberIndex || Date.now() - phoneNumberIndexLoadedAt > INDEX_TTL) {
    try {
      const connectors = await findAllConnectors(payload, 'whatsapp')
      phoneNumberIndex = new Map()
      for (const conn of connectors) {
        const pnId = String(conn.config.phoneNumberId || '')
        if (pnId) {
          // Fetch full connector doc for tenant info
          const fullDoc = await getCachedConnector(payload, conn.id)
          if (fullDoc) {
            phoneNumberIndex.set(pnId, fullDoc)
          }
        }
      }
      phoneNumberIndexLoadedAt = Date.now()
    } catch {
      // Fall through — will return null
    }
  }

  return phoneNumberIndex?.get(phoneNumberId) || null
}

// ─── Webhook Verification (GET) ─────────────────────────────

/**
 * Meta sends a GET request to verify the webhook URL.
 * We need to respond with the hub.challenge value.
 */
export const whatsappWebhookVerifyHandler: PayloadHandler = async (req) => {
  const url = new URL((req as Request).url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token || !challenge) {
    return new Response('Missing parameters', { status: 400 })
  }

  // Find any WhatsApp connector with this verify token
  const { payload } = req
  try {
    const connectors = await findAllConnectors(payload, 'whatsapp')
    const matched = connectors.find((c) => String(c.config.verifyToken) === token)

    if (matched) {
      // Return the challenge as plain text (Meta requirement)
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  } catch {
    // Fall through to 403
  }

  return new Response('Invalid verify token', { status: 403 })
}

// ─── Webhook Handler (POST) ──────────────────────────────────

export const whatsappWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Parse request body ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await (req as Request).json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Meta sends a `object: 'whatsapp_business_account'` envelope
  if (body.object !== 'whatsapp_business_account') {
    return Response.json({ status: 'ignored' }, { status: 200 })
  }

  // Process each entry (usually just one)
  const entries = body.entry || []
  const results: Array<{ from: string; replied: boolean }> = []

  for (const entry of entries) {
    const changes = entry.changes || []

    for (const change of changes) {
      if (change.field !== 'messages') continue

      const value = change.value || {}
      const messages = value.messages || []
      const contacts = value.contacts || []
      const metadata = value.metadata || {}
      const phoneNumberId = String(metadata.phone_number_id || '')

      if (!phoneNumberId || messages.length === 0) continue

      // ── Resolve connector by phone number ID ────────────────
      const connector = await resolveConnectorByPhoneNumberId(payload, phoneNumberId)

      if (!connector) {
        await logError({
          source: 'whatsapp-webhook',
          message: `No WhatsApp connector found for phone_number_id: ${phoneNumberId}`,
          details: 'Incoming message ignored — configure a WhatsApp connector with this phone number ID.',
        })
        continue
      }

      if (!connector.enabled || connector.status === 'error') {
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = (connector.config || {}) as Record<string, any>
      const tenantId = connector.tenant

      if (!tenantId) {
        await logError({
          source: 'whatsapp-webhook',
          message: 'WhatsApp connector has no tenant assigned',
          details: `Connector ID: ${connector.id}`,
        })
        continue
      }

      // ── Validate webhook signature ──────────────────────────
      const appSecret = config.appSecret
      if (appSecret) {
        const signature = (req as Request).headers.get('x-hub-signature-256')
        if (signature) {
          const isValid = await verifyWebhookSignature(
            JSON.stringify(body),
            signature,
            String(appSecret),
          )
          if (!isValid) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 })
          }
        }
      }

      // ── Ensure DM space for this tenant ─────────────────────
      const dmSpaceId = await ensureDMSpace(tenantId)
      if (!dmSpaceId) {
        await logError({
          source: 'whatsapp-webhook',
          message: `Failed to ensure DM space for tenant ${tenantId}`,
        })
        continue
      }

      // ── Process each message ────────────────────────────────
      for (const msg of messages) {
        try {
          const fromPhone = msg.from || ''
          const waMessageId = msg.id || ''
          const timestamp = msg.timestamp || ''

          // Resolve contact name
          const contact = contacts.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c.wa_id === fromPhone,
          )
          const contactName = contact?.profile?.name || fromPhone

          // Extract message text based on type
          const { text: messageText, mediaInfo } = extractMessageContent(msg)

          if (!messageText) continue

          // ── Find or create WhatsApp channel ───────────────────
          const sanitizedPhone = fromPhone.replace(/[^0-9]/g, '')
          const channelSlug = `whatsapp-${sanitizedPhone}`

          await findOrCreateWhatsAppChannel(
            payload,
            tenantId,
            Number(dmSpaceId),
            channelSlug,
            contactName,
            fromPhone,
          )

          // ── Resolve Payload user from WhatsApp identity ───────
          const payloadUser = await resolveWhatsAppUser(
            payload,
            fromPhone,
            contactName,
            tenantId,
          )

          // ── Create inbound message ────────────────────────────
          const inboundContent = mediaInfo
            ? `📱 ${messageText}\n\n_[${mediaInfo}]_`
            : messageText

          await payload.create({
            collection: 'messages' as any,
            data: {
              content: wrapTextContent(inboundContent),
              space: Number(dmSpaceId),
              channel: channelSlug,
              messageType: 'whatsapp_message',
              metadata: {
                source: 'whatsapp',
                whatsappMessageId: waMessageId,
                whatsappPhone: fromPhone,
                whatsappContactName: contactName,
                whatsappTimestamp: timestamp,
                connectorId: connector.id,
              },
              tenant: tenantId,
            } as any,
            overrideAccess: true,
          })

          // ── Process through LEO ─────────────────────────────
          const conversationId = `whatsapp-${sanitizedPhone}`
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
              source: 'whatsapp-webhook',
              message: 'LEO response generation failed',
              details: leoErr instanceof Error ? leoErr.message : String(leoErr),
            })
          }

          // ── Persist LEO response ──────────────────────────────
          if (leoReply) {
            await payload.create({
              collection: 'messages' as any,
              data: {
                content: wrapTextContent(leoReply),
                space: Number(dmSpaceId),
                channel: channelSlug,
                messageType: 'ai_agent',
                metadata: {
                  source: 'whatsapp',
                  agentName: 'LEO',
                  conversationId,
                  connectorId: connector.id,
                  replyTo: fromPhone,
                },
                tenant: tenantId,
              } as any,
              overrideAccess: true,
            })
          }

          // ── Send reply via WhatsApp Cloud API ─────────────────
          let replied = false
          if (leoReply && config.accessToken && phoneNumberId) {
            try {
              await sendWhatsAppMessage({
                phoneNumberId,
                accessToken: String(config.accessToken),
                to: fromPhone,
                text: leoReply,
              })
              replied = true
            } catch (sendErr) {
              await logError({
                source: 'whatsapp-webhook',
                message: 'WhatsApp reply failed',
                details: sendErr instanceof Error ? sendErr.message : String(sendErr),
              })
            }
          }

          results.push({ from: fromPhone, replied })
        } catch (msgErr) {
          await logError({
            source: 'whatsapp-webhook',
            message: 'Failed to process WhatsApp message',
            details: msgErr instanceof Error ? msgErr.message : String(msgErr),
          })
        }
      }

      // ── Update connector lastActivity ───────────────────────
      if (results.length > 0) {
        try {
          await payload.update({
            collection: 'connectors' as any,
            id: connector.id,
            data: {
              lastActivity: new Date().toISOString(),
              status: 'active',
              errorMessage: '',
            } as any,
            overrideAccess: true,
          })
          connectorCache.delete(connector.id)
        } catch {
          // Non-critical
        }
      }
    }
  }

  // ── Always return 200 to Meta (they retry on non-200) ───────
  return Response.json({
    status: 'ok',
    processed: results.length,
    results,
  })
}

// ─── Message Content Extraction ──────────────────────────────

function extractMessageContent(msg: any): { text: string; mediaInfo?: string } {
  switch (msg.type) {
    case 'text':
      return { text: msg.text?.body || '' }

    case 'image':
      return {
        text: msg.image?.caption || 'Sent an image',
        mediaInfo: `Image: ${msg.image?.mime_type || 'image'}`,
      }

    case 'document':
      return {
        text: msg.document?.caption || `Sent a document: ${msg.document?.filename || 'file'}`,
        mediaInfo: `Document: ${msg.document?.filename || 'file'}`,
      }

    case 'audio':
      return {
        text: 'Sent an audio message',
        mediaInfo: `Audio: ${msg.audio?.mime_type || 'audio'}`,
      }

    case 'video':
      return {
        text: msg.video?.caption || 'Sent a video',
        mediaInfo: `Video: ${msg.video?.mime_type || 'video'}`,
      }

    case 'location':
      return {
        text: `📍 Location: ${msg.location?.latitude}, ${msg.location?.longitude}${msg.location?.name ? ` — ${msg.location.name}` : ''}`,
      }

    case 'contacts':
      return {
        text: `Shared a contact: ${msg.contacts?.[0]?.name?.formatted_name || 'Unknown'}`,
      }

    case 'interactive':
      // Button replies, list replies
      return {
        text:
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          'Sent an interactive response',
      }

    case 'button':
      return { text: msg.button?.text || 'Pressed a button' }

    case 'sticker':
      return { text: '(sticker)', mediaInfo: 'Sticker' }

    case 'reaction':
      return { text: `Reacted with ${msg.reaction?.emoji || '👍'}` }

    default:
      return { text: msg.text?.body || '' }
  }
}

// ─── WhatsApp Cloud API — Send Message ───────────────────────

interface SendWhatsAppOptions {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
}

async function sendWhatsAppMessage(opts: SendWhatsAppOptions): Promise<void> {
  const { phoneNumberId, accessToken, to, text } = opts

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    },
  )

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`WhatsApp API ${response.status}: ${errorBody}`)
  }
}

// ─── Webhook Signature Verification ──────────────────────────

async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  appSecret: string,
): Promise<boolean> {
  try {
    const crypto = await import('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')
    return signature === `sha256=${expectedSignature}`
  } catch {
    return false
  }
}

// ─── Find or Create WhatsApp DM Channel ──────────────────────

async function findOrCreateWhatsAppChannel(
  payload: Payload,
  tenantId: number | string,
  dmSpaceId: number,
  slug: string,
  contactName: string,
  phoneNumber: string,
): Promise<{ channelId: string; isNew: boolean }> {
  const existing = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { slug: { equals: slug } },
        { tenant: { equals: tenantId } },
        { type: { equals: 'dm' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    return { channelId: String(existing.docs[0].id), isNew: false }
  }

  const channel = await payload.create({
    collection: 'channels',
    data: {
      name: `📱 ${contactName}`,
      slug,
      description: `WhatsApp thread with ${phoneNumber}`,
      type: 'dm',
      source: 'whatsapp',
      space: dmSpaceId,
      isDefault: false,
      tenant: tenantId,
      members: [],
    } as any,
    overrideAccess: true,
  })

  return { channelId: String(channel.id), isNew: true }
}

// ─── Find or Create Payload User from WhatsApp Identity ──────

async function resolveWhatsAppUser(
  payload: Payload,
  phoneNumber: string,
  contactName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantId: any,
): Promise<{ id: string | number; name: string; email: string }> {
  const sanitizedPhone = phoneNumber.replace(/[^0-9]/g, '')
  const syntheticEmail = `whatsapp-${sanitizedPhone}@guests.angel-os.local`

  // Check if guest already exists
  try {
    const existingGuest = await payload.find({
      collection: 'users',
      where: { email: { equals: syntheticEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingGuest.docs?.length > 0) {
      const user = existingGuest.docs[0] as any
      // Update name if it changed
      if (contactName && user.name !== contactName) {
        try {
          await payload.update({
            collection: 'users',
            id: user.id,
            data: { name: contactName } as any,
            overrideAccess: true,
          })
        } catch { /* non-critical */ }
      }
      return {
        id: user.id,
        name: user.name || contactName,
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
        name: contactName || `WhatsApp ${sanitizedPhone}`,
        password: crypto.randomUUID() + crypto.randomUUID(),
        roles: ['customer'],
        socialProviders: [
          {
            provider: 'whatsapp',
            providerId: sanitizedPhone,
            displayName: contactName,
            linkedAt: new Date().toISOString(),
          },
        ],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    return {
      id: user.id,
      name: (user as any).name || contactName,
      email: (user as any).email,
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Failed to create guest user:', err)
    return {
      id: 0,
      name: contactName || `WhatsApp ${sanitizedPhone}`,
      email: syntheticEmail,
    }
  }
}
