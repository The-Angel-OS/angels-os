/**
 * Vercel Spend Webhook — POST /api/webhooks/vercel-spend
 *
 * Receives spend management alerts from Vercel.
 * Threshold crossings trigger escalation through the crew chain of command:
 *   50% → Log to CIC
 *   75% → Alert Bridge department
 *  100% → Escalate to Captain
 *
 * Naval metaphor: The Chief Engineer reports fuel status to the bridge.
 *
 * Vercel sends webhooks when spend thresholds are crossed:
 * - `spend-management.alert` — threshold crossed
 * - `spend-management.project-paused` — project auto-paused
 *
 * Sprint 40: CIC Feed — Vercel Credits Monitoring
 *
 * @see src/utilities/vercel-billing.ts — billing API client
 * @see src/endpoints/cic-status.ts — CIC aggregation
 */

import type { PayloadHandler } from 'payload'
import { recordCostEvent } from '@/utilities/recordCostEvent'

export const vercelSpendWebhookHandler: PayloadHandler = async (req) => {
  let body: Record<string, unknown>
  try {
    const rawBody = await (req as Request).text()
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { payload } = req
  const eventType = body.type || body.event || 'unknown'
  const data = (body.data || body.payload || body) as Record<string, unknown>

  // Log the webhook event
  payload.logger.info(`[vercel-spend] Received webhook: ${eventType}`)

  try {
    // Determine severity from event data
    const percentage = typeof data.percentage === 'number' ? data.percentage : null
    const amount = typeof data.amount === 'number' ? data.amount : null
    const limit = typeof data.limit === 'number' ? data.limit : null

    let severity: 'info' | 'warning' | 'critical' = 'info'
    if (percentage != null) {
      if (percentage >= 100) severity = 'critical'
      else if (percentage >= 75) severity = 'warning'
      else severity = 'info'
    }

    // Log to federation audit log if available
    try {
      await payload.create({
        collection: 'federation-audit-log' as any,
        data: {
          event: `vercel-spend-${severity}`,
          message: `Vercel spend alert: ${eventType}${percentage != null ? ` (${percentage}%)` : ''}${amount != null ? ` — $${amount}` : ''}`,
          metadata: {
            eventType,
            percentage,
            amount,
            limit,
            severity,
            raw: data,
          },
          timestamp: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
    } catch {
      // Audit log collection may not exist yet — non-fatal
      payload.logger.warn('[vercel-spend] Could not write to audit log')
    }

    // Operating-Costs ledger — persist platform infra spend (fail-soft).
    // When Vercel reports a spend amount, record it so it shows alongside AI /
    // telephony / storage cost in the panel. Platform-level (no tenant).
    if (amount != null) {
      await recordCostEvent(payload, {
        category: 'infra',
        source: 'vercel-spend',
        provider: 'vercel',
        costCents: Math.round(amount * 100 * 1000) / 1000,
        costEstimated: false, // authoritative from Vercel billing
        metadata: { eventType, percentage, limit, severity },
      })
    }

    return Response.json({
      received: true,
      severity,
      message: `Spend alert processed: ${eventType}`,
    })
  } catch (err: any) {
    payload.logger.error(`[vercel-spend] Error processing webhook: ${err.message}`)
    return Response.json(
      { error: 'Webhook processing failed', detail: err.message },
      { status: 500 },
    )
  }
}
