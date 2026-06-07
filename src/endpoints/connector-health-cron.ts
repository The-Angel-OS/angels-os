/**
 * Connector Health Cron — periodic active health checks.
 *
 * GET /api/connector-ops/health  (NOT /api/connectors/* — collection routes shadow that)
 *
 * Vercel Cron job (every 30 min) that iterates all enabled connectors,
 * runs the per-type probe from connectorProbes.ts, and updates each
 * connector's status accordingly.
 *
 * Protected by CRON_SECRET (same as email-poll and federation heartbeat).
 *
 * Returns: { checked: number, healthy: number, failed: number, results: [...] }
 */
import type { PayloadHandler } from 'payload'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'
import { runProbe } from '@/utilities/connectorProbes'
import { logCaughtError } from '@/utilities/logError'

interface HealthResult {
  id: string
  name: string
  type: string
  ok: boolean
  message: string
  latencyMs: number
}

export const connectorHealthCronHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ── Verify cron authorization ─────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch all enabled connectors (any type) ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let connectors: any[]
  try {
    const result = await payload.find({
      collection: 'connectors' as 'payload-locked-documents',
      where: {
        enabled: { equals: true },
      },
      sort: 'type',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    connectors = result.docs || []
  } catch (err) {
    logCaughtError('connector-health-cron/fetch', err)
    return Response.json({ error: 'Failed to fetch connectors' }, { status: 500 })
  }

  // ── Run probes in parallel (with concurrency limit) ──────────
  const CONCURRENCY = 5
  const results: HealthResult[] = []
  let healthy = 0
  let failed = 0

  for (let i = 0; i < connectors.length; i += CONCURRENCY) {
    const batch = connectors.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (conn) => {
        const type = String(conn.type || '')
        const cfg = (conn.config as Record<string, unknown>) || {}
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
        const connId = String(conn.id)

        // Update connector status
        if (probeResult.ok) {
          await markConnectorActive(payload, connId)
        } else {
          await markConnectorError(payload, connId, probeResult.message)
        }

        return {
          id: connId,
          name: String(conn.name || ''),
          type,
          ok: probeResult.ok,
          message: probeResult.message,
          latencyMs,
        } satisfies HealthResult
      }),
    )

    for (const settledResult of batchResults) {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value)
        if (settledResult.value.ok) healthy++
        else failed++
      } else {
        // Promise.allSettled rejection — shouldn't happen but be safe
        failed++
      }
    }
  }

  // ── Log summary if any failures ──────────────────────────────
  if (failed > 0) {
    const failedNames = results
      .filter((r) => !r.ok)
      .map((r) => `${r.name} (${r.type}): ${r.message}`)
    logCaughtError('connector-health-cron/summary', new Error(`${failed} connector(s) unhealthy`), {
      statusCode: 200, // not an HTTP error — informational
    })
    // Log individual failures for debugging
    for (const name of failedNames.slice(0, 10)) {
      logCaughtError('connector-health-cron/failure', new Error(name))
    }
  }

  return Response.json({
    checked: connectors.length,
    healthy,
    failed,
    results,
  })
}
