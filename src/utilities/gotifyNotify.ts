/**
 * gotifyNotify — fail-soft outbound push to a Gotify server.
 *
 * Gotify SEND uses an **app token** (`A…`): `POST {server}/message` with header
 * `X-Gotify-Key: <appToken>`, body `{ title, message, priority, extras }`.
 *
 * Resolution order for server + token (most specific wins):
 *   1. explicit opts.serverUrl / opts.appToken
 *   2. a `gotify` Connector's config (per tenant) — config.serverUrl / config.appToken
 *   3. env fallback — GOTIFY_SERVER_URL / GOTIFY_APP_TOKEN (this node's own app token)
 *
 * Never throws — returns { ok, status?, error? }. Notifications must never break
 * the path that triggered them (mirrors logError / connector fail-soft policy).
 *
 * @see docs/SESSION_HANDOFF_260607.md  @see src/endpoints/gotify-poll.ts
 */
import type { Payload } from 'payload'
import { resolveConnector } from '@/utilities/resolveConnector'

export interface GotifyMessageInput {
  title: string
  message: string
  /** Gotify priority 0–10 (≥8 typically triggers sound/vibration on the client). */
  priority?: number
  /** Optional Gotify `extras` (e.g. client::display contentType, click actions). */
  extras?: Record<string, unknown>
}

export interface GotifyNotifyResult {
  ok: boolean
  status?: number
  error?: string
  /** Where the server/token came from — useful for tests + debugging. */
  via?: 'opts' | 'connector' | 'env'
}

export interface GotifyTarget {
  serverUrl: string
  appToken: string
  via: 'opts' | 'connector' | 'env'
}

const trimSlash = (s: string): string => s.replace(/\/+$/, '')

/**
 * Resolve the Gotify server URL + app token for a tenant.
 * Returns null when nothing is configured (caller treats as a no-op).
 */
export async function resolveGotifyTarget(
  payload: Payload | null,
  opts: {
    tenantId?: number | string
    spaceId?: number | string | null
    serverUrl?: string
    appToken?: string
  } = {},
): Promise<GotifyTarget | null> {
  // 1. Explicit
  if (opts.serverUrl && opts.appToken) {
    return { serverUrl: trimSlash(opts.serverUrl), appToken: opts.appToken, via: 'opts' }
  }

  // 2. Connector config (per tenant)
  if (payload && opts.tenantId != null) {
    try {
      const connector = await resolveConnector(payload, {
        type: 'gotify',
        tenantId: opts.tenantId,
        spaceId: opts.spaceId ?? null,
      })
      const cfg = (connector?.config || {}) as Record<string, unknown>
      const serverUrl = String(cfg.serverUrl || opts.serverUrl || process.env.GOTIFY_SERVER_URL || '')
      const appToken = String(cfg.appToken || opts.appToken || '')
      if (serverUrl && appToken) {
        return { serverUrl: trimSlash(serverUrl), appToken, via: 'connector' }
      }
    } catch {
      // fall through to env
    }
  }

  // 3. Env fallback (this node's own app token)
  const envServer = opts.serverUrl || process.env.GOTIFY_SERVER_URL
  const envToken = opts.appToken || process.env.GOTIFY_APP_TOKEN
  if (envServer && envToken) {
    return { serverUrl: trimSlash(envServer), appToken: envToken, via: 'env' }
  }

  return null
}

/**
 * Send a Gotify notification. Fail-soft.
 */
export async function gotifyNotify(
  msg: GotifyMessageInput,
  opts: {
    payload?: Payload | null
    tenantId?: number | string
    spaceId?: number | string | null
    serverUrl?: string
    appToken?: string
  } = {},
): Promise<GotifyNotifyResult> {
  try {
    if (!msg?.title && !msg?.message) {
      return { ok: false, error: 'Empty notification (title and message both missing)' }
    }

    const target = await resolveGotifyTarget(opts.payload ?? null, opts)
    if (!target) {
      // Not configured — silent no-op (not an error condition).
      return { ok: false, error: 'No Gotify server/app token configured' }
    }

    // Clamp priority to Gotify's 0–10 range.
    const priority = Math.max(0, Math.min(10, Number.isFinite(msg.priority as number) ? (msg.priority as number) : 5))

    const body: Record<string, unknown> = {
      title: msg.title || 'Angel OS',
      message: msg.message || '',
      priority,
    }
    if (msg.extras && Object.keys(msg.extras).length > 0) body.extras = msg.extras

    const res = await fetch(`${target.serverUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gotify-Key': target.appToken,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: `Gotify ${res.status}: ${text.slice(0, 200)}`, via: target.via }
    }

    return { ok: true, status: res.status, via: target.via }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown gotify error' }
  }
}
