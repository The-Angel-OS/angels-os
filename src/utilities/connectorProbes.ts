/**
 * Connector Probes — per-type health check functions.
 *
 * Shared by:
 *   - POST /api/connectors/test (on-demand, single connector)
 *   - GET  /api/connectors/health (cron, all enabled connectors)
 *
 * Each probe performs a lightweight, non-destructive API call to verify
 * credentials and connectivity. Returns { ok, message }.
 */

export interface ProbeResult {
  ok: boolean
  message: string
}

/**
 * Run the appropriate health probe for a connector type.
 */
export async function runProbe(
  type: string,
  cfg: Record<string, unknown>,
): Promise<ProbeResult> {
  switch (type) {
    case 'whatsapp':
      return probeWhatsApp(cfg)
    case 'telegram':
      return probeTelegram(cfg)
    case 'sms':
      return probeSms(cfg)
    case 'email_outbound':
      return probeEmailOutbound(cfg)
    case 'discord':
      return probeDiscord(cfg)
    case 'slack':
      return probeSlack(cfg)
    case 'email_inbound':
      return { ok: true, message: 'IMAP probe not implemented (requires TCP connection)' }
    default:
      return { ok: true, message: `No active probe available for type: ${type}` }
  }
}

// ─── Per-Type Probes ──────────────────────────────────────────

async function probeWhatsApp(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const phoneNumberId = String(cfg.phoneNumberId || '')
  const accessToken = String(cfg.accessToken || '')
  if (!phoneNumberId || !accessToken) return { ok: false, message: 'Missing phoneNumberId or accessToken' }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, message: `Meta API ${res.status}: ${body.slice(0, 200)}` }
  }

  const data = (await res.json()) as Record<string, unknown>
  return {
    ok: true,
    message: `Connected: ${data.verified_name || data.display_phone_number || phoneNumberId}`,
  }
}

async function probeTelegram(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const botToken = String(cfg.botToken || '')
  if (!botToken) return { ok: false, message: 'Missing botToken' }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, message: `Telegram API ${res.status}: ${body.slice(0, 200)}` }
  }

  const data = (await res.json()) as { result?: { username?: string } }
  return { ok: true, message: `Connected: @${data.result?.username || 'unknown'}` }
}

async function probeSms(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const accountSid = String(cfg.accountSid || '')
  const authToken = String(cfg.authToken || '')
  if (!accountSid || !authToken) return { ok: false, message: 'Missing accountSid or authToken' }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, message: `Twilio API ${res.status}: ${body.slice(0, 200)}` }
  }

  const data = (await res.json()) as { friendly_name?: string }
  return { ok: true, message: `Connected: ${data.friendly_name || accountSid}` }
}

async function probeEmailOutbound(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const apiKey = String(cfg.resendApiKey || cfg.apiKey || '')
  if (!apiKey) return { ok: true, message: 'SMTP mode — no API key probe available' }

  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, message: `Resend API ${res.status}: ${body.slice(0, 200)}` }
  }

  return { ok: true, message: 'Resend API key is valid' }
}

async function probeDiscord(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const botToken = String(cfg.botToken || '')
  if (!botToken) return { ok: false, message: 'Missing botToken' }

  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${botToken}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, message: `Discord API ${res.status}: ${body.slice(0, 200)}` }
  }

  const data = (await res.json()) as { username?: string }
  return { ok: true, message: `Connected: ${data.username || 'bot'}` }
}

async function probeSlack(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const botToken = String(cfg.botToken || '')
  if (!botToken) return { ok: false, message: 'Missing botToken' }

  const res = await fetch('https://slack.com/api/auth.test', {
    headers: { Authorization: `Bearer ${botToken}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, message: `Slack API ${res.status}: ${body.slice(0, 200)}` }
  }

  const data = (await res.json()) as { ok: boolean; user?: string; team?: string; error?: string }
  if (!data.ok) return { ok: false, message: `Slack error: ${data.error || 'unknown'}` }
  return { ok: true, message: `Connected: ${data.user || 'bot'} in ${data.team || 'workspace'}` }
}
