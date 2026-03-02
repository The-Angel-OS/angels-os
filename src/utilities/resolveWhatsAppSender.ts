/**
 * Resolve the best WhatsApp sender for a given tenant.
 *
 * Mirrors the `resolveEmailSender` pattern — queries the Connectors collection
 * for a `whatsapp` connector matching the tenant, returns a send function.
 *
 * ## Use Cases
 *
 * - Proactive messaging: appointment reminders, order confirmations
 * - Customer follow-ups triggered by workflows
 * - System notifications to WhatsApp contacts
 *
 * ## WhatsApp Cloud API Constraints
 *
 * - You can only send free-form text within 24 hours of the customer's last message
 *   (the "customer service window").
 * - Outside 24 hours, you must use pre-approved Message Templates.
 * - This utility supports both modes via `sendText()` and `sendTemplate()`.
 *
 * @see src/utilities/resolveConnector.ts
 * @see src/utilities/resolveEmailSender.ts — Sister pattern for email
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */
import type { Payload } from 'payload'
import { resolveConnector } from './resolveConnector'

// ─── Public Interface ────────────────────────────────────────

export interface WhatsAppMessage {
  /** Recipient phone number in international format (e.g., '15551234567') */
  to: string
  /** Text body for free-form messages */
  text?: string
  /** Template name for template messages (required outside 24h window) */
  templateName?: string
  /** Template language code (default: 'en_US') */
  templateLanguage?: string
  /** Template parameters (positional, for body component) */
  templateParameters?: string[]
}

export interface ResolvedWhatsAppSender {
  /** Send a free-form text message (within 24h customer service window) */
  sendText: (to: string, text: string) => Promise<void>
  /** Send a template message (works outside 24h window) */
  sendTemplate: (msg: WhatsAppMessage) => Promise<void>
  /** The connector's phone number ID */
  phoneNumberId: string
  /** Business name from connector config */
  businessName: string
  /** Provider identifier */
  provider: 'meta'
  /** Connector ID for tracking */
  connectorId: string
}

/**
 * Resolve the WhatsApp sender for a given tenant.
 *
 * Returns null if no WhatsApp connector is configured for the tenant.
 * Unlike email which has a boot-time fallback, WhatsApp requires explicit
 * connector configuration — there is no env-var fallback.
 */
export async function resolveWhatsAppSender(
  payload: Payload,
  tenantId: number | string,
  spaceId?: number | string | null,
): Promise<ResolvedWhatsAppSender | null> {
  const connector = await resolveConnector(payload, {
    type: 'whatsapp',
    tenantId,
    spaceId: spaceId ?? undefined,
  })

  if (!connector) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = connector.config as Record<string, any>
  const phoneNumberId = String(cfg.phoneNumberId || '')
  const accessToken = String(cfg.accessToken || '')
  const businessName = String(cfg.businessName || 'Angel OS')

  if (!phoneNumberId || !accessToken) {
    console.warn('[resolveWhatsAppSender] Connector found but missing phoneNumberId or accessToken')
    return null
  }

  const connectorId = connector.id

  // ── Send Text Message ────────────────────────────────────
  const sendText = async (to: string, text: string): Promise<void> => {
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
          to: to.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: text },
        }),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      const errMsg = `WhatsApp API ${response.status}: ${errorBody}`

      // Mark connector error
      await markWhatsAppConnectorError(payload, connectorId, errMsg)
      throw new Error(errMsg)
    }

    // Update connector activity on success
    await updateWhatsAppConnectorActivity(payload, connectorId)
  }

  // ── Send Template Message ────────────────────────────────
  const sendTemplate = async (msg: WhatsAppMessage): Promise<void> => {
    if (!msg.templateName) {
      throw new Error('templateName is required for template messages')
    }

    // Build template components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: any[] = []
    if (msg.templateParameters && msg.templateParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: msg.templateParameters.map((p) => ({
          type: 'text',
          text: p,
        })),
      })
    }

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
          to: msg.to.replace(/[^0-9]/g, ''),
          type: 'template',
          template: {
            name: msg.templateName,
            language: { code: msg.templateLanguage || 'en_US' },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      const errMsg = `WhatsApp Template API ${response.status}: ${errorBody}`
      await markWhatsAppConnectorError(payload, connectorId, errMsg)
      throw new Error(errMsg)
    }

    await updateWhatsAppConnectorActivity(payload, connectorId)
  }

  return {
    sendText,
    sendTemplate,
    phoneNumberId,
    businessName,
    provider: 'meta',
    connectorId,
  }
}

// ─── Connector Observability Helpers ─────────────────────────

async function updateWhatsAppConnectorActivity(payload: Payload, connectorId: string): Promise<void> {
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

async function markWhatsAppConnectorError(
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
