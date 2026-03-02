/**
 * Resolve the best Telegram sender for a given tenant.
 *
 * Mirrors the `resolveWhatsAppSender` pattern — queries the Connectors collection
 * for a `telegram` connector matching the tenant, returns send functions.
 *
 * ## Use Cases
 *
 * - Proactive messaging: appointment reminders, order confirmations
 * - Customer follow-ups triggered by workflows
 * - System notifications to Telegram contacts
 *
 * ## Telegram Bot API
 *
 * - Uses the Bot API sendMessage endpoint
 * - Supports Markdown or HTML formatting
 * - No 24-hour window limitation (unlike WhatsApp)
 * - Rate limit: ~30 messages/second per bot
 *
 * @see src/utilities/resolveConnector.ts
 * @see src/utilities/resolveWhatsAppSender.ts — Sister pattern for WhatsApp
 * @see https://core.telegram.org/bots/api#sendmessage
 */
import type { Payload } from 'payload'
import { resolveConnector } from './resolveConnector'
import { markConnectorActive, markConnectorError } from './bridgeHelpers'
import { logError } from './logError'
import { withRetry } from './outboundRetry'

// ─── Public Interface ────────────────────────────────────────

export interface ResolvedTelegramSender {
  /** Send a text message to a Telegram chat */
  sendText: (chatId: string, text: string, parseMode?: 'Markdown' | 'HTML') => Promise<void>
  /** Bot username (without @) */
  botUsername: string
  /** Provider identifier */
  provider: 'telegram'
  /** Connector ID for tracking */
  connectorId: string
}

/**
 * Resolve the Telegram sender for a given tenant.
 *
 * Returns null if no Telegram connector is configured for the tenant.
 */
export async function resolveTelegramSender(
  payload: Payload,
  tenantId: number | string,
  spaceId?: number | string | null,
): Promise<ResolvedTelegramSender | null> {
  const connector = await resolveConnector(payload, {
    type: 'telegram',
    tenantId,
    spaceId: spaceId ?? undefined,
  })

  if (!connector) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = connector.config as Record<string, any>
  const botToken = String(cfg.botToken || '')
  const botUsername = String(cfg.botUsername || '')

  if (!botToken) {
    logError({ level: 'warning', source: 'resolveTelegramSender', message: 'Connector found but missing botToken', tenantId: String(tenantId) }).catch(() => {})
    return null
  }

  const connectorId = connector.id

  const sendText = async (
    chatId: string,
    text: string,
    parseMode?: 'Markdown' | 'HTML',
  ): Promise<void> => {
    await withRetry(async () => {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            ...(parseMode ? { parse_mode: parseMode } : {}),
          }),
        },
      )

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        const errMsg = `Telegram API ${response.status}: ${errorBody}`
        await markConnectorError(payload, connectorId, errMsg)
        throw new Error(errMsg)
      }
    })

    await markConnectorActive(payload, connectorId)
  }

  return {
    sendText,
    botUsername,
    provider: 'telegram',
    connectorId,
  }
}
