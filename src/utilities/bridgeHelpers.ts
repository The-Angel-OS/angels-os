/**
 * Shared bridge helpers for all inbound webhook endpoints.
 *
 * Eliminates duplication between whatsapp-webhook, discord-webhook,
 * telegram-webhook, sms-webhook, and bridge-inbound endpoints.
 *
 * Every connector endpoint needs the same three primitives:
 *   1. findOrCreateBridgeChannel — DM channel per external contact
 *   2. findOrCreateGuestUser — Payload user per external identity
 *   3. updateConnectorActivity — Success/error status tracking
 *
 * @see src/endpoints/whatsapp-webhook.ts
 * @see src/endpoints/telegram-webhook.ts
 * @see src/endpoints/bridge-inbound.ts
 */
import type { Payload } from 'payload'
import { logCaughtError } from './logError'

// ─── Channel Icons per Source ─────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  whatsapp: '📱',
  discord: '🎮',
  telegram: '✈️',
  sms: '📲',
  email: '📧',
  google_chat: '💬',
  slack: '💼',
  webhook: '🔗',
}

// Source → Channels.source enum value
const SOURCE_ENUM_MAP: Record<string, string> = {
  whatsapp: 'whatsapp',
  discord: 'discord',
  telegram: 'telegram',
  sms: 'sms',
  email: 'email',
  google_chat: 'google_chat',
  slack: 'slack',
  webhook: 'native',
}

// Source → Messages.messageType enum value
const MESSAGE_TYPE_MAP: Record<string, string> = {
  whatsapp: 'whatsapp_message',
  discord: 'discord_message',
  telegram: 'telegram_message',
  sms: 'sms_message',
  email: 'email_message',
  google_chat: 'user',
  slack: 'slack_message',
  webhook: 'user',
}

export function getSourceIcon(source: string): string {
  return SOURCE_ICONS[source] || '📨'
}

export function getChannelSource(source: string): string {
  return SOURCE_ENUM_MAP[source] || 'native'
}

export function getMessageType(source: string): string {
  return MESSAGE_TYPE_MAP[source] || 'user'
}

// ─── Find or Create Bridge Channel ────────────────────────────

export interface BridgeChannelResult {
  channelId: string
  isNew: boolean
}

/**
 * Find or create a DM channel for an external contact.
 *
 * Channel slug is deterministic: `{source}-{sanitizedId}`
 * e.g., `whatsapp-15551234567`, `telegram-123456789`
 */
export async function findOrCreateBridgeChannel(
  payload: Payload,
  opts: {
    tenantId: number | string
    dmSpaceId: number
    slug: string
    displayName: string
    source: string
    description?: string
  },
): Promise<BridgeChannelResult> {
  const { tenantId, dmSpaceId, slug, displayName, source, description } = opts

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

  const icon = getSourceIcon(source)
  const channelSource = getChannelSource(source)

  const channel = await payload.create({
    collection: 'channels',
    data: {
      name: `${icon} ${displayName}`,
      slug,
      description: description || `${source} thread with ${displayName}`,
      type: 'dm',
      source: channelSource,
      space: dmSpaceId,
      isDefault: false,
      tenant: tenantId,
      members: [],
    } as any,
    overrideAccess: true,
  })

  return { channelId: String(channel.id), isNew: true }
}

// ─── Find or Create Guest User ────────────────────────────────

export interface GuestUserResult {
  id: string | number
  name: string
  email: string
  isNew: boolean
}

/**
 * Find or create a Payload user for an external identity.
 *
 * Uses a synthetic email: `{source}-{sanitizedId}@guests.angel-os.local`
 * This allows Payload's unique email constraint to handle dedup.
 *
 * For sources that provide identity updates (e.g., WhatsApp profile name changes),
 * the existing user's name is updated on subsequent visits.
 */
export async function findOrCreateGuestUser(
  payload: Payload,
  opts: {
    externalId: string
    displayName: string
    source: string
    tenantId: number | string
    socialProvider?: {
      provider: string
      providerId: string
      displayName?: string
    }
  },
): Promise<GuestUserResult> {
  const { externalId, displayName, source, tenantId, socialProvider } = opts
  const sanitizedId = externalId.replace(/[^a-zA-Z0-9._@+-]/g, '')
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

    if (existing.docs?.length && existing.docs.length > 0) {
      const user = existing.docs[0] as any

      // Update name if it changed
      if (displayName && user.name !== displayName) {
        try {
          await payload.update({
            collection: 'users',
            id: user.id,
            data: { name: displayName } as any,
            overrideAccess: true,
          })
        } catch {
          /* non-critical */
        }
      }

      return {
        id: user.id,
        name: user.name || displayName,
        email: user.email,
        isNew: false,
      }
    }
  } catch {
    // Fall through to creation
  }

  // Create new guest user
  try {
    const crypto = await import('crypto')
    const userData: Record<string, unknown> = {
      email: syntheticEmail,
      name: displayName || `${source} ${sanitizedId}`,
      password: crypto.randomUUID() + crypto.randomUUID(),
      roles: ['customer'],
      tenant: tenantId,
    }

    // Add social provider link if provided
    if (socialProvider) {
      userData.socialProviders = [
        {
          ...socialProvider,
          linkedAt: new Date().toISOString(),
        },
      ]
    }

    const user = await payload.create({
      collection: 'users',
      data: userData as any,
      overrideAccess: true,
    })

    return {
      id: user.id,
      name: (user as any).name || displayName,
      email: (user as any).email,
      isNew: true,
    }
  } catch (err) {
    logCaughtError(`bridgeHelpers/createGuestUser/${source}`, err).catch(() => {})
    return {
      id: 0,
      name: displayName,
      email: syntheticEmail,
      isNew: false,
    }
  }
}

// ─── Connector Activity Tracking ──────────────────────────────

/**
 * Mark a connector as active with a fresh lastActivity timestamp.
 * Clears any previous errorMessage.
 */
export async function markConnectorActive(
  payload: Payload,
  connectorId: string,
): Promise<void> {
  try {
    await payload.update({
      collection: 'connectors' as any,
      id: connectorId,
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

/**
 * Mark a connector as errored with a message.
 */
export async function markConnectorError(
  payload: Payload,
  connectorId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await payload.update({
      collection: 'connectors' as any,
      id: connectorId,
      data: {
        status: 'error',
        errorMessage: errorMessage.slice(0, 500),
      } as any,
      overrideAccess: true,
    })
  } catch {
    // Non-critical
  }
}

// ─── Message Deduplication ────────────────────────────────────

/**
 * Check if a message with this external ID has already been processed.
 * Returns true if the message is a duplicate (should be skipped).
 *
 * Uses the Messages.metadata JSON field to check for source-specific
 * message IDs (e.g., WhatsApp message ID, Telegram update_id).
 */
export async function isMessageDuplicate(
  payload: Payload,
  opts: {
    source: string
    externalMessageId: string
    tenantId: number | string
  },
): Promise<boolean> {
  if (!opts.externalMessageId) return false

  // Metadata field key per source
  const metadataKeyMap: Record<string, string> = {
    whatsapp: 'whatsappMessageId',
    telegram: 'telegramMessageId',
    discord: 'discordMessageId',
    sms: 'smsMessageSid',
  }

  const key = metadataKeyMap[opts.source]
  if (!key) return false

  try {
    const existing = await payload.find({
      collection: 'messages' as any,
      where: {
        and: [
          { tenant: { equals: opts.tenantId } },
          { [`metadata.${key}`]: { equals: opts.externalMessageId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    return (existing.docs?.length || 0) > 0
  } catch {
    // On query failure, allow processing (fail open for messages)
    return false
  }
}
