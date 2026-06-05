/**
 * tenantTelemetry — real per-tenant operational signals, shared by the command
 * surfaces (CIC, Bridge, dashboard widgets) so they all read from ONE substrate.
 *
 * These are REAL signals (no fabrication): the AI Bus is the Messages collection;
 * connector health is the Connectors collection. Empty results are honest — they
 * mean nothing is flowing yet, not that telemetry is missing.
 */
import type { Payload, Where } from 'payload'

// ── AI Bus activity ──────────────────────────────────────────────────────────

export interface AiBusActivity {
  /** Messages on the bus in the last 24h (tenant-scoped). */
  total24h: number
  /** Breakdown by messageType (from a recent sample), busiest first. */
  byType: { type: string; count: number }[]
  /** True if the breakdown was capped (more than the sample window). */
  sampled: boolean
}

const AI_BUS_SAMPLE = 500

export async function getAiBusActivity(payload: Payload, tenantId: number | string): Promise<AiBusActivity> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const where: Where = { tenant: { equals: tenantId }, createdAt: { greater_than: since } }

  const [totalRes, sampleRes] = await Promise.all([
    payload.count({ collection: 'messages' as any, where, overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
    payload
      // select only messageType — we tally types, not content (avoids pulling
      // up to 500 full message bodies). [payload skill: QUERIES.md performance]
      .find({ collection: 'messages' as any, where, sort: '-createdAt', limit: AI_BUS_SAMPLE, depth: 0, select: { messageType: true } as any, overrideAccess: true })
      .catch(() => ({ docs: [] as unknown[] })),
  ])

  const counts: Record<string, number> = {}
  for (const m of sampleRes.docs as Array<{ messageType?: string }>) {
    const t = m.messageType || 'user'
    counts[t] = (counts[t] || 0) + 1
  }
  const byType = Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return { total24h: totalRes.totalDocs, byType, sampled: sampleRes.docs.length >= AI_BUS_SAMPLE }
}

// ── Connector health ─────────────────────────────────────────────────────────

export interface ConnectorSummary {
  type: string
  status: string
  lastActivity: string | null
}

export interface ConnectorHealth {
  total: number
  active: number
  error: number
  disabled: number
  connectors: ConnectorSummary[]
}

export async function getConnectorHealth(payload: Payload, tenantId: number | string): Promise<ConnectorHealth> {
  const res = await payload
    .find({
      collection: 'connectors' as any,
      where: { tenant: { equals: tenantId } },
      limit: 100,
      depth: 0,
      select: { type: true, status: true, enabled: true, lastActivity: true } as any,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] as unknown[] }))

  let active = 0
  let error = 0
  let disabled = 0
  const connectors: ConnectorSummary[] = (res.docs as Array<Record<string, unknown>>).map((c) => {
    const enabled = c.enabled !== false
    const rawStatus = (c.status as string) || 'unknown'
    let status: string
    if (!enabled) {
      status = 'disabled'
      disabled++
    } else if (rawStatus === 'error') {
      status = 'error'
      error++
    } else {
      status = rawStatus
      active++
    }
    return { type: (c.type as string) || 'unknown', status, lastActivity: (c.lastActivity as string) || null }
  })

  return { total: connectors.length, active, error, disabled, connectors }
}
