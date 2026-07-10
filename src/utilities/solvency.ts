/**
 * solvency — the one number Kenneth has to keep positive.
 *
 * "Make it so easy all you have to do is ensure the $$'s stay positive." This is
 * that readout: does the money the PLATFORM actually keeps exceed what the
 * platform actually spends to run? It is the human-in-the-loop floor beneath the
 * self-healing organism — the organism watches its own wounds (error nervous
 * system), Kenneth watches this one line.
 *
 * Two honest, non-double-counted substrates, both already written by real events:
 *   • Revenue in — `justice-fund-transactions` (type='allocation'). EVERY successful
 *     Stripe charge writes exactly one row here (donation → 100%, Connect sale → 5%),
 *     carrying `sourceTotalCents` (the full gross charge) AND `amountCents` (what the
 *     platform/Justice Fund actually KEEPS). Platform-retained is the money that can
 *     cover infra. @see src/endpoints/stripe-webhooks.ts
 *   • Cost out — `cost-events` (intelligence | telephony | storage | infra), summed
 *     excluding BYOK (a tenant's own key is $0 to the platform). @see src/utilities/costLedger.ts
 *
 * We deliberately IGNORE the token ledger / wallets here — that is a separate
 * currency (AT/KC/LT) whose floats are empty; folding it in would read $0 and lie.
 * Justice Fund `disbursement` rows (grants paid out to people) are surfaced as a
 * separate line: mission spending, not infra — they don't muddy the "are we
 * covering our running costs" verdict.
 *
 * Fail-soft per source: a missing collection on a node yields zeros + available:false
 * for that leg, never an error.
 */
import type { Payload, Where } from 'payload'

export interface SolvencyLeg {
  /** Gross Stripe volume processed (full charge amounts, cents). */
  grossProcessedCents: number
  /** What the platform/Justice Fund actually KEEPS (cents) — covers infra. */
  platformRetainedCents: number
  /** Justice Fund grants paid OUT to recipients (cents) — mission, not infra. */
  disbursedCents: number
  /** Platform-paid infra/AI/telephony/storage cost (cents), excludes BYOK. */
  infraCostCents: number
  /** platformRetainedCents − infraCostCents. The number to keep ≥ 0. */
  operationalNetCents: number
  /** Charge / event counts, for "is this a real signal or one lucky dollar?" */
  revenueEvents: number
  costEvents: number
}

export interface SolvencySnapshot {
  generatedAt: string
  /** The rolling window (days) the `window` leg covers. */
  windowDays: number
  /** Whether each substrate answered (a table may not exist on this node yet). */
  available: { revenue: boolean; cost: boolean }
  /** Last N days. */
  window: SolvencyLeg
  /** All time. */
  lifetime: SolvencyLeg
  /** Human one-liner: the verdict Kenneth reads. */
  verdict: string
  /** 'positive' | 'watch' | 'negative' — for the tile's color. */
  status: 'positive' | 'watch' | 'negative'
  /** The single biggest cost category (lifetime), if any — the lever to pull. */
  topCostCategory: { category: string; costCents: number } | null
}

const PAGE = 500
const SCAN_CAP = 50_000

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** Sum justice-fund-transactions since `sinceISO` (or all time when undefined). */
async function sumRevenue(
  payload: Payload,
  sinceISO?: string,
): Promise<{ ok: boolean; alloc: { gross: number; retained: number; n: number }; disbursed: number }> {
  const out = { ok: false, alloc: { gross: 0, retained: 0, n: 0 }, disbursed: 0 }
  const base: Where = sinceISO ? { createdAt: { greater_than: sinceISO } } : {}
  try {
    let page = 1
    let scanned = 0
    for (;;) {
      const res = await payload.find({
        collection: 'justice-fund-transactions' as any,
        where: { and: [{ status: { equals: 'completed' } }, base] },
        limit: PAGE,
        page,
        depth: 0,
        select: { type: true, amountCents: true, sourceTotalCents: true } as any,
        overrideAccess: true,
        sort: '-createdAt',
      })
      const docs = res.docs as Array<{ type?: string; amountCents?: number; sourceTotalCents?: number }>
      for (const d of docs) {
        scanned++
        const amt = typeof d.amountCents === 'number' ? d.amountCents : 0
        if (d.type === 'allocation') {
          out.alloc.gross += typeof d.sourceTotalCents === 'number' ? d.sourceTotalCents : amt
          out.alloc.retained += amt
          out.alloc.n++
        } else if (d.type === 'disbursement') {
          out.disbursed += amt
        }
      }
      if (scanned >= SCAN_CAP || page >= res.totalPages || docs.length === 0) break
      page++
    }
    out.ok = true
  } catch {
    return out
  }
  return out
}

/** Sum cost-events since `sinceISO` (or all time), platform-paid only, by category. */
async function sumCost(
  payload: Payload,
  sinceISO?: string,
): Promise<{ ok: boolean; platformCents: number; n: number; byCategory: Map<string, number> }> {
  const out = { ok: false, platformCents: 0, n: 0, byCategory: new Map<string, number>() }
  const base: Where = sinceISO ? { occurredAt: { greater_than: sinceISO } } : {}
  try {
    let page = 1
    let scanned = 0
    for (;;) {
      const res = await payload.find({
        collection: 'cost-events' as any,
        where: base,
        limit: PAGE,
        page,
        depth: 0,
        select: { category: true, costCents: true, billedToTenantKey: true } as any,
        overrideAccess: true,
        sort: '-occurredAt',
      })
      const docs = res.docs as Array<{ category?: string; costCents?: number; billedToTenantKey?: boolean }>
      for (const d of docs) {
        scanned++
        if (d.billedToTenantKey === true) continue // BYOK — $0 to the platform
        const cost = typeof d.costCents === 'number' ? d.costCents : 0
        out.platformCents += cost
        out.n++
        const cat = d.category || 'other'
        out.byCategory.set(cat, (out.byCategory.get(cat) || 0) + cost)
      }
      if (scanned >= SCAN_CAP || page >= res.totalPages || docs.length === 0) break
      page++
    }
    out.ok = true
  } catch {
    return out
  }
  return out
}

/**
 * The platform-wide solvency snapshot. Read-only, platform-global (justice-fund
 * transactions have no tenant; cost-events are summed across all tenants).
 */
export async function getSolvencySnapshot(
  payload: Payload,
  opts: { windowDays?: number } = {},
): Promise<SolvencySnapshot> {
  const windowDays = Math.max(1, Math.min(365, Math.round(opts.windowDays ?? 30)))
  const sinceISO = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const [revWin, revLife, costWin, costLife] = await Promise.all([
    sumRevenue(payload, sinceISO),
    sumRevenue(payload, undefined),
    sumCost(payload, sinceISO),
    sumCost(payload, undefined),
  ])

  const leg = (
    rev: Awaited<ReturnType<typeof sumRevenue>>,
    cost: Awaited<ReturnType<typeof sumCost>>,
  ): SolvencyLeg => ({
    grossProcessedCents: rev.alloc.gross,
    platformRetainedCents: rev.alloc.retained,
    disbursedCents: rev.disbursed,
    infraCostCents: cost.platformCents,
    operationalNetCents: rev.alloc.retained - cost.platformCents,
    revenueEvents: rev.alloc.n,
    costEvents: cost.n,
  })

  const window = leg(revWin, costWin)
  const lifetime = leg(revLife, costLife)

  // Biggest lifetime cost category — the lever to pull if we go red.
  let topCostCategory: { category: string; costCents: number } | null = null
  for (const [category, costCents] of costLife.byCategory) {
    if (!topCostCategory || costCents > topCostCategory.costCents) topCostCategory = { category, costCents }
  }

  const net = lifetime.operationalNetCents
  let status: SolvencySnapshot['status']
  let verdict: string
  if (net > 0) {
    status = 'positive'
    verdict = `POSITIVE — the platform has kept ${usd(lifetime.platformRetainedCents)} and spent ${usd(lifetime.infraCostCents)} to run, net +${usd(net)}. The lamp stays lit.`
  } else if (net === 0 && lifetime.platformRetainedCents === 0 && lifetime.infraCostCents === 0) {
    status = 'watch'
    verdict = `No money has moved yet — $0 in, $0 out. The first dollar makes this real.`
  } else if (net >= 0) {
    status = 'watch'
    verdict = `EVEN — kept ${usd(lifetime.platformRetainedCents)}, spent ${usd(lifetime.infraCostCents)}. Break-even; one more earner tips it positive.`
  } else {
    status = 'negative'
    const lever = topCostCategory ? ` Biggest cost lever: ${topCostCategory.category} (${usd(topCostCategory.costCents)}).` : ''
    verdict = `NEGATIVE — spent ${usd(lifetime.infraCostCents)} to run, kept only ${usd(lifetime.platformRetainedCents)}, short ${usd(-net)}.${lever}`
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    available: { revenue: revLife.ok, cost: costLife.ok },
    window,
    lifetime,
    verdict,
    status,
    topCostCategory,
  }
}
