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
    case 'youtube_channel':
      return probeYouTubeChannel(cfg)
    case 'gotify':
      return probeGotify(cfg)
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

async function probeYouTubeChannel(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const channelId = String(cfg.channelId || '').trim()
  if (!channelId) return { ok: false, message: 'Missing channelId in config' }

  // Probe: fetch the RSS feed and check it has entries
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'AngelOS/1.0 (Health Probe)' },
    })

    if (!res.ok) {
      return { ok: false, message: `YouTube RSS ${res.status}: Channel ${channelId} may not exist` }
    }

    const xml = await res.text()
    // Check for at least one <entry> in the feed
    const hasEntries = xml.includes('<entry>')
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/)
    const channelName = titleMatch ? titleMatch[1] : channelId

    return {
      ok: true,
      message: `Connected: ${channelName}${hasEntries ? '' : ' (no videos)'}`,
    }
  } catch (err) {
    return {
      ok: false,
      message: `YouTube RSS fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
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

async function probeGotify(cfg: Record<string, unknown>): Promise<ProbeResult> {
  const serverUrl = String(cfg.serverUrl || process.env.GOTIFY_SERVER_URL || '').replace(/\/+$/, '')
  const clientToken = String(cfg.clientToken || '')
  const appToken = String(cfg.appToken || '')
  if (!serverUrl) return { ok: false, message: 'Missing serverUrl' }
  if (!clientToken && !appToken) return { ok: false, message: 'Missing clientToken and appToken' }

  // Prefer validating the CLIENT (receive) token via a non-destructive GET.
  // App (send) tokens can only POST /message, so for app-only connectors we just
  // confirm server reachability via the public /health endpoint.
  try {
    if (clientToken) {
      const res = await fetch(`${serverUrl}/message?limit=1`, {
        headers: { 'X-Gotify-Key': clientToken },
      })
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: `Gotify rejected clientToken (${res.status})` }
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { ok: false, message: `Gotify ${res.status}: ${body.slice(0, 200)}` }
      }
      return { ok: true, message: `Connected: clientToken valid${appToken ? ' (appToken not GET-verifiable)' : ''}` }
    }

    const res = await fetch(`${serverUrl}/health`)
    if (!res.ok) return { ok: false, message: `Gotify /health ${res.status}` }
    return { ok: true, message: 'Server reachable (appToken send-only — not GET-verifiable)' }
  } catch (err) {
    return { ok: false, message: `Gotify fetch failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}
