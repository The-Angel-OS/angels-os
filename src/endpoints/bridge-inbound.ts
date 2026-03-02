import type { PayloadHandler, Payload } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'

/**
 * POST /api/bridge/inbound
 *
 * Generic inbound message bridge for external channels.
 * Receives messages from any source (SMS, Google Chat, custom webhooks)
 * and routes them through the standard Connector → DM → LEO → Reply pipeline.
 *
 * For WhatsApp and Discord, use their dedicated webhook endpoints instead:
 *   - POST /api/whatsapp/webhook (Meta Cloud API format)
 *   - POST /api/discord/webhook (Discord bot bridge format)
 *
 * This endpoint handles sources that don't have a dedicated webhook:
 *   - SMS (Twilio)
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

    // ── Find or create channel ───────────────────────────────
    await findOrCreateBridgeChannel(
      payload,
      tenantId,
      Number(dmSpaceId),
      channelSlug,
      String(displayName),
      String(source),
    )

    // ── Find or create external user ─────────────────────────
    const user = await findOrCreateExternalUser(
      payload,
      String(externalUserId),
      String(displayName),
      String(source),
      tenantId,
    )

    // ── Map source to messageType ────────────────────────────
    const messageTypeMap: Record<string, string> = {
      sms: 'sms_message',
      email: 'email_message',
      whatsapp: 'whatsapp_message',
      google_chat: 'user',
      webhook: 'user',
    }
    const messageType = messageTypeMap[source as string] || 'user'

    // ── Create inbound message ───────────────────────────────
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
    }

    // ── Update connector activity ────────────────────────────
    if (connectorId) {
      try {
        await payload.update({
          collection: 'connectors' as any,
          id: String(connectorId),
          data: {
            lastActivity: new Date().toISOString(),
            status: 'active',
            errorMessage: '',
          } as any,
          overrideAccess: true,
        })
      } catch {
        // Non-critical
      }
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
      try {
        await payload.update({
          collection: 'connectors' as any,
          id: String(connectorId),
          data: {
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          } as any,
          overrideAccess: true,
        })
      } catch {
        // Non-critical
      }
    }

    return Response.json(
      { message: 'Internal server error', error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────

async function findOrCreateBridgeChannel(
  payload: Payload,
  tenantId: number | string,
  dmSpaceId: number,
  slug: string,
  displayName: string,
  source: string,
): Promise<{ channelId: string }> {
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
    return { channelId: String(existing.docs[0].id) }
  }

  const sourceIcons: Record<string, string> = {
    sms: '📲',
    google_chat: '💬',
    webhook: '🔗',
    whatsapp: '📱',
    email: '📧',
  }
  const icon = sourceIcons[source] || '📨'

  // Map source to channel source enum value
  const channelSourceMap: Record<string, string> = {
    sms: 'sms',
    whatsapp: 'whatsapp',
    email: 'email',
    google_chat: 'google_chat',
    webhook: 'native',
  }
  const channelSource = channelSourceMap[source] || 'native'

  const channel = await payload.create({
    collection: 'channels',
    data: {
      name: `${icon} ${displayName}`,
      slug,
      description: `${source} thread with ${displayName}`,
      type: 'dm',
      source: channelSource,
      space: dmSpaceId,
      isDefault: false,
      tenant: tenantId,
      members: [],
    } as any,
    overrideAccess: true,
  })

  return { channelId: String(channel.id) }
}

async function findOrCreateExternalUser(
  payload: Payload,
  externalUserId: string,
  displayName: string,
  source: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantId: any,
): Promise<{ id: string | number; name: string; email: string }> {
  const sanitizedId = externalUserId.replace(/[^a-zA-Z0-9._@+-]/g, '')
  const syntheticEmail = `${source}-${sanitizedId}@guests.angel-os.local`

  // Check if guest already exists
  try {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: syntheticEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs?.length > 0) {
      const user = existing.docs[0] as any
      return {
        id: user.id,
        name: user.name || displayName,
        email: user.email,
      }
    }
  } catch {
    // Fall through to creation
  }

  // Create new guest
  try {
    const crypto = await import('crypto')
    const user = await payload.create({
      collection: 'users',
      data: {
        email: syntheticEmail,
        name: displayName || `${source} ${sanitizedId}`,
        password: crypto.randomUUID() + crypto.randomUUID(),
        roles: ['customer'],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    return {
      id: user.id,
      name: (user as any).name || displayName,
      email: (user as any).email,
    }
  } catch (err) {
    console.error('[Bridge Inbound] Failed to create guest user:', err)
    return {
      id: 0,
      name: displayName,
      email: syntheticEmail,
    }
  }
}
