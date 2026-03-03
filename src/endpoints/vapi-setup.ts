/**
 * Vapi Setup Endpoint — POST /api/vapi/setup
 *
 * One-shot admin endpoint that configures the Vapi phone number's
 * Server URL to point at our webhook. This wires inbound calls on
 * +1 727-440-8797 to Angel OS so LEO answers the phone.
 *
 * Requires super_admin role. Idempotent — safe to call multiple times.
 *
 * Uses the Vapi REST API:
 *   PATCH https://api.vapi.ai/phone-number/{id}
 *   { "serverUrl": "https://our-domain/api/vapi/webhook" }
 *
 * @see https://docs.vapi.ai/api-reference/phone-numbers/update
 *
 * Sprint 19 — Vapi Voice AI Setup
 */
import type { PayloadHandler } from 'payload'
import { checkRole } from '@/access/utilities'

const VAPI_API_BASE = 'https://api.vapi.ai'

export const vapiSetupHandler: PayloadHandler = async (req) => {
  const { user } = req

  // ─── Auth: super_admin only ─────────────────────────────────
  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!checkRole(['super_admin'], user)) {
    return Response.json({ error: 'Super admin access required.' }, { status: 403 })
  }

  // ─── Validate env vars ──────────────────────────────────────
  const vapiKey = process.env.VAPI_PRIVATE_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID

  if (!vapiKey) {
    return Response.json(
      { error: 'VAPI_PRIVATE_KEY environment variable is not set.' },
      { status: 500 },
    )
  }

  if (!phoneNumberId) {
    return Response.json(
      { error: 'VAPI_PHONE_NUMBER_ID environment variable is not set.' },
      { status: 500 },
    )
  }

  // ─── Derive webhook URL ─────────────────────────────────────
  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    'http://localhost:3000'

  const webhookUrl = `${baseUrl}/api/vapi/webhook`

  // ─── Optional: webhook secret for authentication ────────────
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET || undefined

  // ─── Call Vapi API to update phone number ───────────────────
  try {
    // Build the server configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverConfig: Record<string, any> = {
      url: webhookUrl,
      timeoutSeconds: 20,
    }

    if (webhookSecret) {
      serverConfig.secret = webhookSecret
    }

    const response = await fetch(`${VAPI_API_BASE}/phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Clear any static assistant so the Server URL webhook takes over.
        // Vapi priority: assistantId > squadId > serverUrl — if an assistant
        // is assigned, the server URL is completely ignored.
        assistantId: null,
        squadId: null,
        server: serverConfig,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Vapi Setup] API error:', response.status, errorBody)
      return Response.json(
        {
          error: `Vapi API returned ${response.status}`,
          details: errorBody,
        },
        { status: 502 },
      )
    }

    const result = await response.json()

    console.log('[Vapi Setup] Phone number configured successfully:', {
      phoneNumberId,
      webhookUrl,
      hasSecret: Boolean(webhookSecret),
    })

    return Response.json({
      success: true,
      phoneNumberId,
      webhookUrl,
      hasSecret: Boolean(webhookSecret),
      vapiResponse: {
        id: result.id,
        number: result.number,
        provider: result.provider,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to configure Vapi phone number'
    console.error('[Vapi Setup] Error:', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
