/**
 * SMS Webhook — POST /api/sms/webhook
 *
 * Receives inbound SMS messages via Twilio webhook,
 * processes them through LEO, and sends replies back via Twilio.
 *
 * ## Multi-Tenant Architecture
 *
 * Each tenant configures their own Twilio account via the Connectors
 * collection (type: 'sms'). The handler:
 *
 * 1. Validates Twilio request signature (X-Twilio-Signature)
 * 2. Resolves the connector by the receiving phone number ("To")
 * 3. Deduplicates via Twilio MessageSid
 * 4. Finds or creates a Payload user from phone identity
 * 5. Processes through leoProcessMessage()
 * 6. Persists to AI Bus (Messages collection)
 * 7. Responds with TwiML containing LEO's reply
 *
 * ## Connector Config
 *
 * Stored in Connectors.config JSON:
 * {
 *   "accountSid": "ACxxxxxxxx",
 *   "authToken": "your_auth_token",
 *   "phoneNumber": "+15551234567"
 * }
 *
 * ## Twilio Webhook Format
 *
 * Twilio sends form-encoded POST with fields:
 *   - MessageSid: Unique message ID
 *   - From: Sender phone (+15551234567)
 *   - To: Receiving phone (+15559876543)
 *   - Body: Message text
 *   - NumMedia: Number of media attachments
 *   - MediaUrl0..N: Media attachment URLs
 *
 * Must respond with TwiML (text/xml). LEO's reply goes in <Message> element.
 *
 * @see src/utilities/bridgeHelpers.ts — Shared bridge utilities
 * @see https://www.twilio.com/docs/messaging/guides/webhook-request
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

// ─── Phone Number → Connector Index ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let phoneIndex: Map<string, any> | null = null
let phoneIndexLoadedAt = 0
const PHONE_INDEX_TTL = 120_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveConnectorByPhone(payload: any, toNumber: string): Promise<any | null> {
  if (!phoneIndex || Date.now() - phoneIndexLoadedAt > PHONE_INDEX_TTL) {
    try {
      const connectors = await findAllConnectors(payload, 'sms')
      phoneIndex = new Map()
      for (const conn of connectors) {
        const phone = normalizePhone(String(conn.config.phoneNumber || ''))
        if (phone) {
          const fullDoc = await payload.findByID({
            collection: 'connectors',
            id: conn.id,
            depth: 0,
            overrideAccess: true,
          })
          if (fullDoc) {
            phoneIndex.set(phone, fullDoc)
          }
        }
      }
      phoneIndexLoadedAt = Date.now()
    } catch {
      // Fall through
    }
  }

  return phoneIndex?.get(normalizePhone(toNumber)) || null
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '')
}

// ─── Webhook Handler (POST) ──────────────────────────────────

export const smsWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Parse Twilio form-encoded body ──────────────────────────
  let formData: URLSearchParams
  try {
    const rawBody = await (req as Request).text()
    formData = new URLSearchParams(rawBody)
  } catch {
    return twimlResponse('Invalid request body')
  }

  const messageSid = formData.get('MessageSid') || ''
  const fromPhone = formData.get('From') || ''
  const toPhone = formData.get('To') || ''
  const body = formData.get('Body') || ''
  const numMedia = parseInt(formData.get('NumMedia') || '0', 10)

  if (!fromPhone || !toPhone || !body) {
    return twimlResponse('Missing required fields')
  }

  // ── Resolve connector by receiving phone number ─────────────
  const connector = await resolveConnectorByPhone(payload, toPhone)

  if (!connector) {
    await logError({
      source: 'sms-webhook',
      message: `No SMS connector found for phone: ${toPhone}`,
      details: 'Configure an SMS connector with this phone number.',
    })
    return twimlResponse('Thank you for your message.')
  }

  if (!connector.enabled || connector.status === 'error') {
    return twimlResponse('This service is currently unavailable.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = (connector.config || {}) as Record<string, any>
  const tenantId = connector.tenant

  if (!tenantId) {
    return twimlResponse('Service configuration error.')
  }

  // ── Validate Twilio signature (optional but recommended) ────
  const authToken = config.authToken
  if (authToken) {
    const twilioSignature = (req as Request).headers.get('x-twilio-signature')
    if (twilioSignature) {
      const requestUrl = (req as Request).url
      const isValid = await verifyTwilioSignature(
        requestUrl,
        formData,
        twilioSignature,
        String(authToken),
      )
      if (!isValid) {
        return twimlResponse('Unauthorized')
      }
    }
  }

  try {
    // ── Deduplication ────────────────────────────────────────
    if (messageSid) {
      const isDup = await isMessageDuplicate(payload, {
        source: 'sms',
        externalMessageId: messageSid,
        tenantId,
      })
      if (isDup) {
        return twimlResponse('') // Empty TwiML — don't re-reply
      }
    }

    // ── Ensure DM space ──────────────────────────────────────
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (!dmSpaceId) {
      return twimlResponse('Service temporarily unavailable.')
    }

    // ── Find or create channel (shared helper) ────────────────
    const sanitizedPhone = fromPhone.replace(/[^0-9]/g, '')
    const channelSlug = `sms-${sanitizedPhone}`

    await findOrCreateBridgeChannel(payload, {
      tenantId,
      dmSpaceId: Number(dmSpaceId),
      slug: channelSlug,
      displayName: fromPhone,
      source: 'sms',
      description: `SMS thread with ${fromPhone}`,
    })

    // ── Resolve Payload user (shared helper) ──────────────────
    const payloadUser = await findOrCreateGuestUser(payload, {
      externalId: sanitizedPhone,
      displayName: fromPhone,
      source: 'sms',
      tenantId,
    })

    // ── Build message text with media info ────────────────────
    let messageText = body
    if (numMedia > 0) {
      const mediaUrls: string[] = []
      for (let i = 0; i < numMedia; i++) {
        const url = formData.get(`MediaUrl${i}`)
        if (url) mediaUrls.push(url)
      }
      if (mediaUrls.length > 0) {
        messageText += `\n\n_[${mediaUrls.length} media attachment${mediaUrls.length > 1 ? 's' : ''}]_`
      }
    }

    // ── Create inbound message ───────────────────────────────
    await payload.create({
      collection: 'messages' as any,
      data: {
        content: wrapTextContent(messageText),
        space: Number(dmSpaceId),
        channel: channelSlug,
        messageType: 'sms_message',
        metadata: {
          source: 'sms',
          smsMessageSid: messageSid,
          smsFrom: fromPhone,
          smsTo: toPhone,
          connectorId: connector.id,
        },
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // ── Process through LEO ──────────────────────────────────
    const conversationId = `sms-${sanitizedPhone}`
    let leoReply = ''

    try {
      const result = await leoProcessMessage({
        message: body,
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
      leoReply = 'Thank you for your message. We\'ll follow up shortly.'
      await logError({
        source: 'sms-webhook',
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
            source: 'sms',
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

    // ── Update connector activity ────────────────────────────
    await markConnectorActive(payload, connector.id)

    // ── Respond with TwiML ───────────────────────────────────
    // Twilio sends the <Message> content back as an SMS reply
    return twimlResponse(leoReply || '')
  } catch (err) {
    await logError({
      source: 'sms-webhook',
      message: 'Failed to process SMS',
      details: err instanceof Error ? err.message : String(err),
    })
    return twimlResponse('We received your message. Please try again shortly.')
  }
}

// ─── TwiML Response Helper ───────────────────────────────────

function twimlResponse(message: string): Response {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─── Twilio Signature Verification ───────────────────────────

async function verifyTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string,
  authToken: string,
): Promise<boolean> {
  try {
    const crypto = await import('crypto')

    // Twilio signature: HMAC-SHA1 of URL + sorted params concatenated
    const sortedKeys = Array.from(params.keys()).sort()
    let data = url
    for (const key of sortedKeys) {
      data += key + (params.get(key) || '')
    }

    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(data)
      .digest('base64')

    return signature === expectedSignature
  } catch {
    return false
  }
}
