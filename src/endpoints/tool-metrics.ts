/**
 * Tool metrics — GET /api/metrics-ops/tools
 *
 * The read-model over the tool-chain audit data we already capture: every LEO
 * turn persists `Message.metadata.toolChain = { source, failed, steps:[{name,
 * status,ms}] }` (ExecutionTrace.toJSON). Because each step carries a roundtrip
 * `ms`, aggregating those steps yields APM-grade analytics for free — no new
 * instrumentation. Returns per-tool count / error-rate / p50·p95·p99 latency.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Read-only.
 * Params: ?tenant=<id> (filter), ?limit=<n> messages to scan (default 2000),
 *         ?since=<ISO> (only messages on/after).
 *
 * ⚠️ SCALE: scans recent ai_agent messages. At high volume, roll up periodically
 * into a metrics collection and read aggregates instead. See
 * docs/planning/WORKS_AS_JSON.md rationale (same denormalize-at-scale pattern).
 */
import type { PayloadHandler, Where } from 'payload'

interface Step { name?: string; status?: string; ms?: number }

/** Nearest-rank percentile over an ascending-sorted number[]. */
function pct(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1))
  return sortedAsc[i]
}

export const toolMetricsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  const tenant = url.searchParams.get('tenant')
  const limit = Math.min(10000, Math.max(1, Number(url.searchParams.get('limit')) || 2000))
  const since = url.searchParams.get('since')

  try {
    const where: Where = { messageType: { equals: 'ai_agent' } }
    if (tenant && /^\d+$/.test(tenant)) where.tenant = { equals: Number(tenant) }
    if (since) where.createdAt = { greater_than_equal: since }

    const res = await payload.find({
      collection: 'messages',
      where,
      sort: '-createdAt',
      limit,
      depth: 0,
      overrideAccess: true,
      select: { metadata: true, createdAt: true },
    })

    // Group step ms by tool name, and response telemetry by provider/model.
    const byTool = new Map<string, { ms: number[]; errors: number }>()
    const byModel = new Map<string, { ms: number[]; cost: number; tokens: number; n: number }>()
    let tracesWithSteps = 0
    let stepsTotal = 0
    for (const m of res.docs as Array<Record<string, unknown>>) {
      const md = m.metadata as Record<string, unknown> | undefined

      // Per-model latency + cost. Only count COMPLETED responses (latencyMs
      // present) — streaming-placeholder messages carry a model but no telemetry.
      const model = md?.model as string | undefined
      if (typeof md?.latencyMs === 'number' && model) {
        const key = `${(md?.provider as string) ?? '?'} / ${model}`
        const e = byModel.get(key) ?? { ms: [], cost: 0, tokens: 0, n: 0 }
        e.n++
        e.ms.push(md.latencyMs)
        if (typeof md?.costCents === 'number') e.cost += md.costCents
        if (typeof md?.totalTokens === 'number') e.tokens += md.totalTokens
        byModel.set(key, e)
      }

      // Per-tool step latency.
      const steps = (md as { toolChain?: { steps?: Step[] } } | undefined)?.toolChain?.steps
      if (!Array.isArray(steps) || !steps.length) continue
      tracesWithSteps++
      for (const s of steps) {
        if (s.status === 'skip') continue
        const name = s.name || 'unknown'
        const e = byTool.get(name) ?? { ms: [], errors: 0 }
        if (typeof s.ms === 'number') e.ms.push(s.ms)
        if (s.status === 'fail') e.errors++
        byTool.set(name, e)
        stepsTotal++
      }
    }

    const tools = [...byTool.entries()]
      .map(([name, e]) => {
        const sorted = [...e.ms].sort((a, b) => a - b)
        const calls = Math.max(e.ms.length, e.errors)
        return {
          name,
          calls,
          errorRate: calls ? +(e.errors / calls).toFixed(3) : 0,
          p50: pct(sorted, 50),
          p95: pct(sorted, 95),
          p99: pct(sorted, 99),
          maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
        }
      })
      .sort((a, b) => b.p95 - a.p95) // slowest first — the optimization queue

    const models = [...byModel.entries()]
      .map(([name, e]) => {
        const sorted = [...e.ms].sort((a, b) => a - b)
        return {
          name,
          responses: e.n,
          p50: pct(sorted, 50),
          p95: pct(sorted, 95),
          p99: pct(sorted, 99),
          totalCostCents: +e.cost.toFixed(2),
          avgTokens: e.n ? Math.round(e.tokens / e.n) : 0,
        }
      })
      .sort((a, b) => b.responses - a.responses)

    return Response.json({
      ok: true,
      tenant: tenant || null,
      messagesScanned: res.docs.length,
      tracesWithSteps,
      stepsTotal,
      tools,
      models,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[tool-metrics] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
