/**
 * syncVapiNumber — push a tenant's Vapi phone-number config UP to Vapi.
 *
 * The webhook URL and the failover destination live on the Vapi *phone number*
 * object, not on the assistant, so they can't be set per-call from
 * assistant-request. Without this they're manual API pokes — which is exactly
 * how the number spent weeks pointing at a dead node and forwarding every failed
 * call to one hardcoded mobile.
 *
 * This makes "each portal gets its own bot AND its own failover" a config value:
 * set `tenants.vapi.{phoneNumber, fallbackNumber}` and sync.
 *
 * Vapi gotchas encoded here (both cost us a live call):
 *  - `server.url` is authoritative; `serverUrl` is the legacy field. Setting only
 *    the legacy one changes nothing for real calls — we write both.
 *  - A stale `assistantId` makes Vapi use a stored assistant and NEVER send
 *    `assistant-request` to our webhook, so dynamic per-tenant config is skipped.
 *    We null it unless the tenant explicitly pins one.
 */

const VAPI_API_BASE = 'https://api.vapi.ai'

export interface SyncVapiNumberResult {
  ok: boolean
  skipped?: string
  error?: string
  number?: string
  serverUrl?: string
  fallbackNumber?: string
}

/** E.164-ish check — Vapi rejects anything else, and a silent reject is worse. */
function isE164(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v)
}

export async function syncVapiNumber(
  tenant: Record<string, unknown>,
  opts: { serverUrl?: string } = {},
): Promise<SyncVapiNumberResult> {
  const apiKey = process.env.VAPI_PRIVATE_KEY
  if (!apiKey) return { ok: false, skipped: 'VAPI_PRIVATE_KEY not set' }

  const vapi = tenant.vapi as Record<string, unknown> | undefined
  if (!vapi?.enabled) return { ok: false, skipped: 'vapi.enabled is false' }

  const phoneNumber = typeof vapi.phoneNumber === 'string' ? vapi.phoneNumber.trim() : ''
  if (!phoneNumber) return { ok: false, skipped: 'no vapi.phoneNumber configured' }

  const fallbackNumber = typeof vapi.fallbackNumber === 'string' ? vapi.fallbackNumber.trim() : ''
  if (fallbackNumber && !isE164(fallbackNumber)) {
    return { ok: false, error: `fallbackNumber "${fallbackNumber}" is not E.164 (e.g. +17275551234)` }
  }

  const base =
    opts.serverUrl ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'https://www.payloadnuke.com'
  const serverUrl = `${base.replace(/\/$/, '')}/api/vapi/webhook`

  try {
    // Find the Vapi number id by its E.164 number.
    const listRes = await fetch(`${VAPI_API_BASE}/phone-number`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!listRes.ok) return { ok: false, error: `Vapi list failed: ${listRes.status}` }
    const list = (await listRes.json()) as Array<Record<string, unknown>>
    const want = phoneNumber.replace(/[\s-]/g, '')
    const match = (Array.isArray(list) ? list : []).find(
      (n) => String(n.number || '').replace(/[\s-]/g, '') === want,
    )
    if (!match?.id) return { ok: false, error: `No Vapi number matching ${phoneNumber}` }

    const body: Record<string, unknown> = {
      // Write BOTH: `server.url` is authoritative, `serverUrl` is legacy.
      server: { url: serverUrl, timeoutSeconds: 30 },
      serverUrl,
      // Force the dynamic path — a stored assistant would bypass our webhook.
      assistantId: (vapi.assistantId as string) || null,
    }
    if (fallbackNumber) {
      body.fallbackDestination = { type: 'number', number: fallbackNumber }
    }

    const patchRes = await fetch(`${VAPI_API_BASE}/phone-number/${match.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!patchRes.ok) {
      return { ok: false, error: `Vapi PATCH failed: ${patchRes.status} ${await patchRes.text()}` }
    }
    const updated = (await patchRes.json()) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      ok: true,
      number: updated.number,
      serverUrl: updated.server?.url || updated.serverUrl,
      fallbackNumber: updated.fallbackDestination?.number,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
