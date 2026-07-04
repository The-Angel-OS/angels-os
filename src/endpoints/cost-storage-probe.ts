/**
 * Storage Cost Probe — GET/POST /api/cost-ops/storage-probe
 *
 * Derives per-tenant object-storage cost from the Media collection (sum of
 * filesize) and records a monthly `storage` cost-event per tenant into the
 * Operating-Costs ledger. Point-in-time snapshot: idempotent per calendar month
 * (skips a tenant that already has a storage snapshot this month) so re-runs
 * don't inflate the ledger.
 *
 * Auth: super_admin, or a cron caller presenting CRON_SECRET (x-cron-secret
 * header or ?cron_secret=). Meant to run ~monthly via cron.
 *
 * Rate: STORAGE_COST_CENTS_PER_GB_MONTH (default 2.3 ≈ Vercel Blob $0.023/GB·mo).
 *
 * @see src/collections/CostEvents — the ledger
 */
import type { PayloadHandler } from 'payload'
import { recordCostEvent } from '@/utilities/recordCostEvent'
import { logError } from '@/utilities/logError'

const BYTES_PER_GB = 1024 * 1024 * 1024
const PAGE = 500

function ratePerGbCents(): number {
  const raw = Number(process.env.STORAGE_COST_CENTS_PER_GB_MONTH)
  return Number.isFinite(raw) && raw >= 0 ? raw : 2.3
}

function isAuthorized(req: Parameters<PayloadHandler>[0]): boolean {
  const user = req.user as Record<string, unknown> | null
  const roles = Array.isArray(user?.roles) ? (user!.roles as string[]) : []
  if (roles.includes('super_admin')) return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const headerSecret = req.headers.get('x-cron-secret')
  let querySecret: string | null = null
  try {
    querySecret = new URL(req.url || '', 'http://localhost').searchParams.get('cron_secret')
  } catch {
    /* ignore */
  }
  return headerSecret === secret || querySecret === secret
}

export const costStorageProbeHandler: PayloadHandler = async (req) => {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { payload } = req
  const now = new Date()
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const rate = ratePerGbCents()

  try {
    // Sum media filesize per tenant (scan, depth 0, only the fields we need).
    const bytesByTenant = new Map<string, number>()
    let page = 1
    for (;;) {
      const res = await payload.find({
        collection: 'media' as any,
        limit: PAGE,
        page,
        depth: 0,
        select: { filesize: true, tenant: true } as any,
        overrideAccess: true,
      })
      for (const m of res.docs as Array<{ filesize?: number; tenant?: number | { id?: number } }>) {
        const tid = typeof m.tenant === 'object' && m.tenant ? m.tenant.id : m.tenant
        if (tid == null) continue
        const bytes = typeof m.filesize === 'number' ? m.filesize : 0
        bytesByTenant.set(String(tid), (bytesByTenant.get(String(tid)) || 0) + bytes)
      }
      if (page >= res.totalPages || res.docs.length === 0) break
      page++
    }

    const results: Array<{ tenantId: string; gb: number; costCents: number; recorded: boolean }> = []
    for (const [tenantId, bytes] of bytesByTenant) {
      if (bytes <= 0) continue
      const gb = bytes / BYTES_PER_GB
      const costCents = Math.round(gb * rate * 1000) / 1000

      // Idempotent per month: skip if a storage snapshot already exists this month.
      const existing = await payload
        .count({
          collection: 'cost-events' as any,
          where: {
            tenant: { equals: Number(tenantId) },
            category: { equals: 'storage' },
            source: { equals: 'blob-probe' },
            occurredAt: { greater_than_equal: monthStart },
          },
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 }))

      if (existing.totalDocs > 0) {
        results.push({ tenantId, gb: Math.round(gb * 1000) / 1000, costCents, recorded: false })
        continue
      }

      await recordCostEvent(payload, {
        tenantId: Number(tenantId),
        category: 'storage',
        source: 'blob-probe',
        provider: 'vercel-blob',
        costCents,
        costEstimated: true,
        quantity: Math.round(gb * 1000) / 1000,
        unit: 'gb',
        occurredAt: now.toISOString(),
        metadata: { period: monthKey, bytes, rateCentsPerGbMonth: rate },
      })
      results.push({ tenantId, gb: Math.round(gb * 1000) / 1000, costCents, recorded: true })
    }

    return Response.json({
      ok: true,
      period: monthKey,
      rateCentsPerGbMonth: rate,
      tenants: results.length,
      recorded: results.filter((r) => r.recorded).length,
      results,
    })
  } catch (err: any) {
    await logError({
      source: 'cost-storage-probe',
      message: `Storage probe failed: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
    })
    return Response.json({ error: 'Storage probe failed', detail: err?.message || String(err) }, { status: 500 })
  }
}
