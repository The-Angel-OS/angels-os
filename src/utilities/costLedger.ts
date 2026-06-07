/**
 * costLedger — read-side aggregation over the unified cost-events ledger.
 *
 * Complements aiCostTelemetry.ts (which scans Messages.metadata for the AI
 * history). This reads the `cost-events` collection so the panel can show ALL
 * cost categories (intelligence | telephony | storage | infra | other) from one
 * substrate as they accrue. Fail-soft: if the table doesn't exist yet on this
 * node, returns an empty-but-valid summary.
 *
 * @see src/collections/CostEvents — the ledger
 * @see src/utilities/recordCostEvent.ts — the writer
 */
import type { Payload, Where } from 'payload'

export interface LedgerCategoryBucket {
  category: string
  events: number
  costCents: number
  /** Cost served via the tenant's own key (BYOK) — $0 to the platform. */
  byokCostCents: number
  /** Platform-paid cost (excludes BYOK). */
  platformCostCents: number
}

export interface LedgerProviderBucket {
  provider: string
  category: string
  events: number
  costCents: number
}

export interface CostLedgerSummary {
  windowDays: number
  since: string
  generatedAt: string
  available: boolean
  totals: {
    events: number
    costCents: number
    platformCostCents: number
    byokCostCents: number
  }
  byCategory: LedgerCategoryBucket[]
  byProvider: LedgerProviderBucket[]
  scanned: number
  sampled: boolean
}

const PAGE_SIZE = 500
const SCAN_CAP = 20_000

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Aggregate the cost-events ledger for a tenant over the last N days.
 * Fail-soft — any query error (incl. a missing table) yields available:false.
 */
export async function getCostLedgerSummary(
  payload: Payload,
  tenantId: number | string,
  opts: { days?: number } = {},
): Promise<CostLedgerSummary> {
  const windowDays = Math.max(1, Math.min(90, Math.round(opts.days ?? 30)))
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const generatedAt = new Date().toISOString()

  const base: CostLedgerSummary = {
    windowDays,
    since,
    generatedAt,
    available: false,
    totals: { events: 0, costCents: 0, platformCostCents: 0, byokCostCents: 0 },
    byCategory: [],
    byProvider: [],
    scanned: 0,
    sampled: false,
  }

  const where: Where = {
    tenant: { equals: tenantId },
    occurredAt: { greater_than: since },
  }

  const byCategory = new Map<string, LedgerCategoryBucket>()
  const byProvider = new Map<string, LedgerProviderBucket>()
  let scanned = 0
  let sampled = false

  try {
    let page = 1
    for (;;) {
      const res = await payload.find({
        collection: 'cost-events' as any,
        where,
        sort: '-occurredAt',
        limit: PAGE_SIZE,
        page,
        depth: 0,
        select: { category: true, provider: true, costCents: true, billedToTenantKey: true } as any,
        overrideAccess: true,
      })

      const docs = res.docs as Array<{
        category?: string
        provider?: string
        costCents?: number
        billedToTenantKey?: boolean
      }>

      for (const d of docs) {
        scanned++
        const category = d.category || 'other'
        const provider = d.provider || 'unknown'
        const cost = typeof d.costCents === 'number' ? d.costCents : 0
        const byok = d.billedToTenantKey === true

        base.totals.events++
        base.totals.costCents += cost
        if (byok) base.totals.byokCostCents += cost
        else base.totals.platformCostCents += cost

        let cat = byCategory.get(category)
        if (!cat) {
          cat = { category, events: 0, costCents: 0, byokCostCents: 0, platformCostCents: 0 }
          byCategory.set(category, cat)
        }
        cat.events++
        cat.costCents += cost
        if (byok) cat.byokCostCents += cost
        else cat.platformCostCents += cost

        const pkey = `${category}:${provider}`
        let prov = byProvider.get(pkey)
        if (!prov) {
          prov = { provider, category, events: 0, costCents: 0 }
          byProvider.set(pkey, prov)
        }
        prov.events++
        prov.costCents += cost
      }

      if (scanned >= SCAN_CAP) {
        sampled = true
        break
      }
      if (page >= res.totalPages || docs.length === 0) break
      page++
    }
    base.available = true
  } catch {
    // Table may not exist yet on this node — honest "unavailable", not an error.
    return base
  }

  base.totals.costCents = round3(base.totals.costCents)
  base.totals.platformCostCents = round3(base.totals.platformCostCents)
  base.totals.byokCostCents = round3(base.totals.byokCostCents)
  for (const c of byCategory.values()) {
    c.costCents = round3(c.costCents)
    c.byokCostCents = round3(c.byokCostCents)
    c.platformCostCents = round3(c.platformCostCents)
  }
  for (const p of byProvider.values()) p.costCents = round3(p.costCents)

  base.byCategory = [...byCategory.values()].sort((a, b) => b.costCents - a.costCents || b.events - a.events)
  base.byProvider = [...byProvider.values()].sort((a, b) => b.costCents - a.costCents || b.events - a.events)
  base.scanned = scanned
  base.sampled = sampled
  return base
}
