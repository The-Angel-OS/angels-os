/**
 * Log Consolidation — GET/POST /api/log-ops/consolidate
 *
 * The hippocampus's second half: learning to FORGET. The error nervous system
 * writes to `application-logs` on every fault; without pruning, an organism
 * "dies of its own logs." This is the nightly consolidation ("Dreams"):
 *
 *   - Forget: ANYTHING older than `maxDays` (the hard retention ceiling).
 *   - Forget: resolved logs older than `resolvedDays` (they've been handled).
 *   - Forget: info/debug logs older than `noiseDays` (telemetry noise).
 *   - Before pruning, write ONE rollup summary log so the memory of *volume*
 *     survives even as the detail is forgotten.
 *
 * The point of the log is that every fault eventually LANDS here so it can be
 * found and fixed — not that faults accumulate forever. An unresolved error
 * still sitting there after two weeks is one nobody is going to act on; if it
 * matters, it recurs and comes back in. Ken's call, 260820.
 *
 * System-wide (all tenants) — it's the janitor, not a per-tenant tool. Gated by
 * super_admin OR `?key=<CRON_SECRET>` / `Authorization: Bearer <CRON_SECRET>`.
 * `?dry=true` reports what WOULD be forgotten without deleting.
 *
 * @see docs/architecture/ERROR_NERVOUS_SYSTEM_AUDIT_260703.md
 */
import type { PayloadHandler, Where } from 'payload'

const DAY_MS = 24 * 60 * 60 * 1000

export const logConsolidateHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  // Auth: super_admin session OR the shared cron secret.
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const dry = url.searchParams.get('dry') === 'true'
  const resolvedDays = clampDays(url.searchParams.get('resolvedDays'), 14)
  const noiseDays = clampDays(url.searchParams.get('noiseDays'), 7)
  const maxDays = clampDays(url.searchParams.get('maxDays'), 14)
  const now = Date.now()
  const resolvedCutoff = new Date(now - resolvedDays * DAY_MS).toISOString()
  const noiseCutoff = new Date(now - noiseDays * DAY_MS).toISOString()
  const maxCutoff = new Date(now - maxDays * DAY_MS).toISOString()

  // What we forget — anything past the hard ceiling, OR resolved-and-aged, OR
  // info/debug-and-aged. The ceiling is what stops a stale backlog from burying
  // the faults that are actually happening now.
  const forgetWhere: Where = {
    or: [
      { createdAt: { less_than: maxCutoff } },
      { and: [{ resolved: { equals: true } }, { createdAt: { less_than: resolvedCutoff } }] },
      { and: [{ level: { in: ['info', 'debug'] } }, { createdAt: { less_than: noiseCutoff } }] },
    ],
  }

  try {
    const [toForget, unresolved] = await Promise.all([
      payload.count({ collection: 'application-logs', where: forgetWhere, overrideAccess: true }),
      payload.count({
        collection: 'application-logs',
        // Only the ones that SURVIVE this run — the others are about to go.
        where: {
          and: [
            { level: { in: ['error', 'warning'] } },
            { resolved: { not_equals: true } },
            { createdAt: { greater_than_equal: maxCutoff } },
          ],
        },
        overrideAccess: true,
      }),
    ])

    if (dry) {
      return Response.json({
        ok: true, dryRun: true,
        wouldForget: toForget.totalDocs, unresolvedKept: unresolved.totalDocs,
        policy: { maxDays, resolvedDays, noiseDays },
      })
    }

    if (toForget.totalDocs > 0) {
      // The dream: one summary log so the memory of volume survives the pruning.
      await payload.create({
        collection: 'application-logs',
        overrideAccess: true,
        data: {
          level: 'info',
          source: 'log-consolidate',
          message: `Consolidated ${toForget.totalDocs} logs (anything >${maxDays}d + resolved >${resolvedDays}d + info/debug >${noiseDays}d). ${unresolved.totalDocs} unresolved remain inside the window.`,
          resolved: true,
        },
      })
      await payload.delete({ collection: 'application-logs', where: forgetWhere, overrideAccess: true })
    }

    return Response.json({ ok: true, forgot: toForget.totalDocs, unresolvedKept: unresolved.totalDocs, policy: { maxDays, resolvedDays, noiseDays } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[log-consolidate] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/** Retention window in days, clamped to a sane 1–365 (defaults on bad input). */
function clampDays(raw: string | null, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(365, Math.max(1, Math.floor(n)))
}
