/**
 * AI Costs Endpoint — GET /api/cic/ai-costs?days=30
 *
 * The economic viewscreen of the control panel: what LEO is costing this tenant,
 * by day / model / provider, with burn rate, projected monthly, free-vs-paid
 * ratio, failover rate, and latency. READ-ONLY aggregation of the per-response
 * telemetry already captured in Messages.metadata — zero schema dependency.
 *
 * Auth: REQUIRED. Cost/usage data is sensitive operational economics, so unlike
 * cic-status (which has a public aggregate view) this is gated to authenticated
 * users. Tenant resolution mirrors cic-status: x-tenant-id slug, then host.
 *
 * @see src/utilities/aiCostTelemetry.ts — the aggregator
 * @see src/utilities/aiUsage.ts — the capture shape + pricing
 */

import type { PayloadHandler } from 'payload'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { getAiCostSummary } from '@/utilities/aiCostTelemetry'
import { getCostLedgerSummary } from '@/utilities/costLedger'
import { getTenantAiBudgetStatus } from '@/utilities/aiBudget'
import { computeFeeReconciliation, nonAiPlatformCostFromLedger } from '@/utilities/feeReconciliation'

export const aiCostsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  // Cost economics are authenticated-only.
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Resolve tenant — same chain as cic-status / resolveTenantFromHeaders.
  let tenantId: number | null = null
  const tenantSlug = req.headers.get('x-tenant-id')
  if (tenantSlug) {
    const tenant = await fetchTenantBySlug(tenantSlug)
    tenantId = tenant?.id ?? null
  }
  if (!tenantId) {
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host')
    if (host) {
      const tenant = await fetchTenantByDomain(host)
      tenantId = tenant?.id ?? null
    }
  }
  if (!tenantId) {
    return Response.json({ error: 'Tenant context required' }, { status: 400 })
  }

  // days param — clamped inside the aggregator (1..90), default 30.
  const url = (() => {
    try {
      return new URL(req.url || '', 'http://localhost')
    } catch {
      return null
    }
  })()
  const daysRaw = url?.searchParams.get('days')
  const days = daysRaw ? Number(daysRaw) : undefined

  try {
    const windowDays = Number.isFinite(days as number) ? (days as number) : undefined

    // Tenant config for budget status (agentWallet override + BYOK keys). Fail-soft.
    const tenantDoc = await payload
      .findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        select: { agentWallet: true, aiConfig: true, bootstrapFees: true } as any,
        overrideAccess: true,
      })
      .catch(() => null)

    // AI history (Messages.metadata scan) + the unified ledger (all categories) +
    // budget status. All fail-soft; the ledger is "unavailable" until its table exists.
    const [summary, ledger, budget] = await Promise.all([
      getAiCostSummary(payload, tenantId, { days: windowDays }),
      getCostLedgerSummary(payload, tenantId, { days: windowDays }),
      getTenantAiBudgetStatus(payload, {
        tenantId,
        agentWallet: (tenantDoc as any)?.agentWallet ?? null,
        tenantAiConfig: (tenantDoc as any)?.aiConfig ?? null,
      }),
    ])
    // Fee reconciliation — make the platform fee honest against real cost.
    const feeRevenueToDateCents =
      Number((tenantDoc as any)?.bootstrapFees?.totalFeesCollectedCents) || 0
    const reconciliation = computeFeeReconciliation({
      scope: 'tenant',
      windowDays: summary.windowDays,
      aiCostCents: summary.totals.costCents,
      nonAiCostCents: nonAiPlatformCostFromLedger(ledger),
      feeRevenueToDateCents,
    })

    return Response.json({ ...summary, ledger, budget, reconciliation })
  } catch (err: any) {
    return Response.json(
      { error: 'AI cost aggregation failed', detail: err?.message || String(err) },
      { status: 500 },
    )
  }
}
