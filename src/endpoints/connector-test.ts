/**
 * Connector Test Endpoint — Active health probe for any connector.
 *
 * POST /api/connectors/test
 * Body: { connectorId: string }
 *
 * Runs a lightweight, non-destructive probe against the external service
 * to verify credentials and connectivity. Per-type probes:
 *
 *   - whatsapp:       GET Meta Graph API phone number info
 *   - telegram:       GET Bot API `getMe`
 *   - sms:            GET Twilio Account resource
 *   - email_inbound:  IMAP NOOP (skipped — requires long-lived connection)
 *   - email_outbound: Resend API key verification via GET /domains
 *   - discord:        GET Discord Application info via bot token
 *   - slack:          GET Slack auth.test
 *
 * Returns: { status: 'ok' | 'error', message: string, latencyMs: number }
 *
 * @see src/utilities/connectorProbes.ts — shared probe functions
 * @see src/utilities/bridgeHelpers.ts — markConnectorActive / markConnectorError
 */
import type { PayloadHandler } from 'payload'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'
import { runProbe } from '@/utilities/connectorProbes'

export const connectorTestHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  // ── Auth ────────────────────────────────────────────────────
  if (!user || !('roles' in user) || !Array.isArray(user.roles)) {
    return Response.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
  }
  const roles = (user.roles ?? []) as string[]
  const isAdmin = roles.some((r) => ['super_admin', 'tenant_admin', 'admin'].includes(r))
  if (!isAdmin) {
    return Response.json({ status: 'error', message: 'Forbidden: requires admin role' }, { status: 403 })
  }

  // ── Parse body ──────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 })
  }

  const connectorId = body.connectorId as string
  if (!connectorId) {
    return Response.json({ status: 'error', message: 'connectorId is required' }, { status: 400 })
  }

  // ── Fetch connector ─────────────────────────────────────────
  let connector
  try {
    connector = await payload.findByID({
      collection: 'connectors' as 'payload-locked-documents',
      id: connectorId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return Response.json({ status: 'error', message: 'Connector not found' }, { status: 404 })
  }

  if (!connector) {
    return Response.json({ status: 'error', message: 'Connector not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = (connector as any).type as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = ((connector as any).config as Record<string, any>) || {}

  // ── Run type-specific probe ─────────────────────────────────
  const start = Date.now()
  let probeResult: { ok: boolean; message: string }

  try {
    probeResult = await runProbe(type, cfg)
  } catch (err) {
    probeResult = {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown probe error',
    }
  }

  const latencyMs = Date.now() - start

  // ── Update connector status ─────────────────────────────────
  if (probeResult.ok) {
    await markConnectorActive(payload, connectorId)
  } else {
    await markConnectorError(payload, connectorId, probeResult.message)
  }

  return Response.json({
    status: probeResult.ok ? 'ok' : 'error',
    message: probeResult.message,
    latencyMs,
  })
}
