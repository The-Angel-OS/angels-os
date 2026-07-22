/**
 * Resolve the best SMS sender for a given tenant.
 *
 * Mirrors the `resolveWhatsAppSender` pattern — queries the Connectors collection
 * for an `sms` connector matching the tenant, returns a send function.
 *
 * ## Use Cases
 *
 * - Proactive messaging: appointment reminders, OTP codes
 * - Order status notifications
 * - System alerts to SMS contacts
 *
 * ## Twilio REST API
 *
 * - Uses the Twilio Messages resource
 * - Requires Account SID, Auth Token, and a Twilio phone number
 * - Supports plain text only (no rich content)
 * - Rate limits depend on Twilio plan
 *
 * @see src/utilities/resolveConnector.ts
 * @see src/utilities/resolveWhatsAppSender.ts — Sister pattern for WhatsApp
 * @see https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource
 */
import type { Payload } from 'payload'
import { resolveConnector } from './resolveConnector'
import { markConnectorActive, markConnectorError } from './bridgeHelpers'
import { logError } from './logError'
import { withRetry } from './outboundRetry'

// ─── Public Interface ────────────────────────────────────────

export interface ResolvedSmsSender {
  /** Send an SMS text message */
  sendText: (to: string, body: string) => Promise<void>
  /** The Twilio phone number used for sending */
  fromNumber: string
  /** Provider identifier */
  provider: 'twilio'
  /** Connector ID for tracking */
  connectorId: string
}

/**
 * Resolve the SMS sender for a given tenant.
 *
 * Returns null if no SMS connector is configured for the tenant.
 */
export async function resolveSmsSender(
  payload: Payload,
  tenantId: number | string,
  spaceId?: number | string | null,
): Promise<ResolvedSmsSender | null> {
  const connector = await resolveConnector(payload, {
    type: 'sms',
    tenantId,
    spaceId: spaceId ?? undefined,
  })

  // Platform-wide env fallback: no per-tenant connector configured → use the
  // node's own Twilio account (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
  // TWILIO_PHONE_NUMBER). Lets SMS work everywhere with one set of creds;
  // a tenant connector still wins so portals can bring their own number.
  if (!connector) {
    const envSid = process.env.TWILIO_ACCOUNT_SID || ''
    const envToken = process.env.TWILIO_AUTH_TOKEN || ''
    const envFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || ''
    if (!envSid || !envToken || !envFrom) return null
    const credentials = Buffer.from(`${envSid}:${envToken}`).toString('base64')
    const sendText = async (to: string, body: string): Promise<void> => {
      await withRetry(async () => {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${envSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: to.replace(/[^0-9+]/g, ''),
              From: envFrom,
              Body: body,
            }).toString(),
          },
        )
        if (!response.ok) {
          const errorBody = await response.text().catch(() => '')
          throw new Error(`Twilio API ${response.status}: ${errorBody}`)
        }
      })
    }
    return { sendText, fromNumber: envFrom, provider: 'twilio', connectorId: 'env' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = connector.config as Record<string, any>
  const accountSid = String(cfg.accountSid || '')
  const authToken = String(cfg.authToken || '')
  const fromNumber = String(cfg.fromNumber || '')

  if (!accountSid || !authToken || !fromNumber) {
    logError({ level: 'warning', source: 'resolveSmsSender', message: 'Connector found but missing accountSid, authToken, or fromNumber', tenantId: String(tenantId) }).catch(() => {})
    return null
  }

  const connectorId = connector.id

  const sendText = async (to: string, body: string): Promise<void> => {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    await withRetry(async () => {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to.replace(/[^0-9+]/g, ''),
            From: fromNumber,
            Body: body,
          }).toString(),
        },
      )

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        const errMsg = `Twilio API ${response.status}: ${errorBody}`
        await markConnectorError(payload, connectorId, errMsg)
        throw new Error(errMsg)
      }
    })

    await markConnectorActive(payload, connectorId)
  }

  return {
    sendText,
    fromNumber,
    provider: 'twilio',
    connectorId,
  }
}
