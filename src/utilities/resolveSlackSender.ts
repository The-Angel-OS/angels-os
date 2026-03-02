/**
 * Slack Outbound Sender — resolves Slack bot credentials and returns a sender.
 *
 * Usage:
 *   const sender = await resolveSlackSender(payload, tenantId)
 *   if (sender) await sender.sendText('#general', 'Hello!')
 */
import type { Payload } from 'payload'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { withRetry } from '@/utilities/outboundRetry'
import { logCaughtError } from '@/utilities/logError'

export interface ResolvedSlackSender {
  sendText: (channel: string, text: string, threadTs?: string) => Promise<void>
  botToken: string
  provider: 'slack'
  connectorId: string
}

export async function resolveSlackSender(
  payload: Payload,
  tenantId: number | string,
  _spaceId?: number | string | null,
): Promise<ResolvedSlackSender | null> {
  const connectors = await findAllConnectors(payload, 'slack')
  // findAllConnectors already filters to enabled + non-error connectors
  const connector = connectors.find(
    (c) => String(c.tenantId) === String(tenantId),
  )

  if (!connector) return null

  const botToken = connector.config?.botToken as string
  if (!botToken) return null

  return {
    botToken,
    provider: 'slack',
    connectorId: String(connector.id),
    sendText: async (channel: string, text: string, threadTs?: string) => {
      await withRetry(async () => {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel,
            text,
            ...(threadTs && { thread_ts: threadTs }),
          }),
        })

        if (!res.ok) {
          throw new Error(`Slack API HTTP ${res.status}`)
        }

        const data = (await res.json()) as { ok: boolean; error?: string }
        if (!data.ok) {
          // Slack returns 200 even for errors — throw to trigger retry for transient errors
          const isRetryable = ['timeout', 'service_unavailable', 'request_timeout', 'internal_error'].includes(data.error || '')
          if (isRetryable) throw new Error(`Slack API error: ${data.error}`)
          // Non-retryable error — log and bail
          logCaughtError('slack-sender', new Error(`Slack API error: ${data.error}`), { tenantId })
        }
      })
    },
  }
}
