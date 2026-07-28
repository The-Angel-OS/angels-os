/**
 * Connector transports — the medium-agnostic send layer for escalation.
 *
 * Escalation used to be Gotify-only. But Connectors already model 9 mediums
 * (whatsapp/sms/webhook/livekit/discord/telegram/slack/gotify/x_twitter); only the
 * dispatcher was Gotify-shaped. This registry maps a connector `type` → a transport
 * that knows how to push a short escalation message through that medium, reading
 * its own keys off the connector's `config`. dispatchEscalation (escalation.ts)
 * fans an event out to every escalation-enabled connector for the tenant and routes
 * each through `getTransport(connector.type)`.
 *
 * This is the Bisk "DB enabled/disabled assemblies" pattern: each transport is an
 * interchangeable unit, selected by a DB record (the Connector) and gated by its
 * own `config.escalation` policy. New mediums = add a transport; no dispatcher change.
 *
 * Every transport is FAIL-SOFT — returns { ok, error? }, never throws. Escalation
 * must never break the path that triggered it.
 *
 * @see src/utilities/escalation.ts  @see src/utilities/pushNotify.ts
 */
import { pushNotify } from '@/utilities/pushNotify'

export interface EscalationMessage {
  title: string
  message: string
  /** Normalized 0–10 priority (transports map this to their own scheme). */
  priority: number
  extras?: Record<string, unknown>
}

export interface TransportResult {
  ok: boolean
  error?: string
}

export interface ConnectorTransport {
  type: string
  /** True when the connector's config has everything this transport needs to send. */
  ready(config: Record<string, unknown>): boolean
  send(config: Record<string, unknown>, msg: EscalationMessage): Promise<TransportResult>
}

const str = (v: unknown): string => (v == null ? '' : String(v))

// ─── Gotify ──────────────────────────────────────────────────────────────────
const gotifyTransport: ConnectorTransport = {
  type: 'gotify',
  ready: (config) =>
    Boolean((config.serverUrl || process.env.GOTIFY_SERVER_URL) && (config.appToken || process.env.GOTIFY_APP_TOKEN)),
  send: async (config, msg) => {
    const serverUrl = str(config.serverUrl || process.env.GOTIFY_SERVER_URL)
    const appToken = str(config.appToken || process.env.GOTIFY_APP_TOKEN)
    const res = await pushNotify(
      { title: msg.title, message: msg.message, priority: msg.priority, extras: msg.extras },
      { serverUrl, appToken },
    )
    return { ok: res.ok, error: res.error }
  },
}

// ─── Telegram (Bot API sendMessage) ────────────────────────────────────────────
const telegramTransport: ConnectorTransport = {
  type: 'telegram',
  ready: (config) => Boolean(config.botToken && config.chatId),
  send: async (config, msg) => {
    try {
      const url = `https://api.telegram.org/bot${str(config.botToken)}/sendMessage`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: str(config.chatId), text: `*${msg.title}*\n${msg.message}`, parse_mode: 'Markdown' }),
      })
      return res.ok ? { ok: true } : { ok: false, error: `telegram ${res.status}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'telegram send failed' }
    }
  },
}

// ─── Webhook (generic JSON POST — covers Slack/Discord/custom incoming hooks) ───
const webhookTransport: ConnectorTransport = {
  type: 'webhook',
  ready: (config) => Boolean(config.url),
  send: async (config, msg) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.headers && typeof config.headers === 'object') {
        Object.assign(headers, config.headers as Record<string, string>)
      }
      const res = await fetch(str(config.url), {
        method: 'POST',
        headers,
        // `text` is the Slack/Discord-friendly key; full fields included for custom hooks.
        body: JSON.stringify({ text: `${msg.title}\n${msg.message}`, title: msg.title, message: msg.message, priority: msg.priority }),
      })
      return res.ok ? { ok: true } : { ok: false, error: `webhook ${res.status}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'webhook send failed' }
    }
  },
}

const REGISTRY: Record<string, ConnectorTransport> = {
  gotify: gotifyTransport,
  telegram: telegramTransport,
  webhook: webhookTransport,
  // discord/slack are commonly wired via their incoming-webhook URL → use `webhook`.
  // whatsapp/sms/x_twitter/livekit: add transports when those send paths are built.
}

/** The connector types that can currently carry an escalation. */
export const ESCALATION_TRANSPORT_TYPES = Object.keys(REGISTRY)

/** Look up the transport for a connector type, or undefined if unsupported. */
export function getTransport(type: string): ConnectorTransport | undefined {
  return REGISTRY[type]
}
