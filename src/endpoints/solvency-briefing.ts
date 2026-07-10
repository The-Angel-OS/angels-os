/**
 * Solvency Briefing — GET /api/solvency-ops/briefing
 *
 * The daily "are the dollars still positive?" ping — pushed to Kenneth without
 * him opening anything. Runs on the Vercel cron (see vercel.json), CRON_SECRET or
 * super_admin gated (mirrors log-consolidate).
 *
 * Deliberately MEDIUM-AGNOSTIC. Gotify is not the concept — escalation is. This
 * writes the verdict through `dispatchEscalation` (eventType 'maintenance_note'),
 * which (a) records it DURABLY in the operator's AI-Bus `system-log` (config-free,
 * survives with zero connectors) and (b) fans out through EVERY bound connector —
 * Gotify today, SMS/email/Telegram/webhook tomorrow — with no change here. Adding
 * a channel is adding a connector, not editing this file.
 *
 * Targeting: platform financials are operator data, so we dispatch only to tenants
 * that own an enabled connector (i.e. someone set up notifications there). Pass
 * ?tenant=N to force one. ?dry=true previews without dispatching.
 *
 * @see src/utilities/solvency.ts  @see src/utilities/gotifyEscalation.ts
 */
import type { PayloadHandler } from 'payload'
import { getSolvencySnapshot } from '@/utilities/solvency'
import { dispatchEscalation } from '@/utilities/gotifyEscalation'

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** Distinct tenant ids that own at least one enabled connector. */
async function resolveConnectorTenants(payload: Parameters<PayloadHandler>[0]['payload']): Promise<Array<number | string>> {
  try {
    const res = await payload.find({
      collection: 'connectors' as never,
      where: { enabled: { equals: true } } as never,
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    const ids = new Set<number | string>()
    for (const d of res.docs as Array<{ tenant?: number | string | { id?: number | string } }>) {
      const t = d.tenant
      const id = typeof t === 'object' && t ? t.id : t
      if (id != null) ids.add(id)
    }
    return [...ids]
  } catch {
    return []
  }
}

export const solvencyBriefingHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  // Auth: super_admin session OR the shared cron secret (same shape as log-consolidate).
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const dry = url.searchParams.get('dry') === 'true'
  const tenantParam = url.searchParams.get('tenant')

  const snapshot = await getSolvencySnapshot(payload)
  const s = snapshot

  const icon = s.status === 'positive' ? '🟢' : s.status === 'watch' ? '🟡' : '🔴'
  const net = s.lifetime.operationalNetCents
  const title = `${icon} Solvency: ${net >= 0 ? '+' : '−'}${usd(Math.abs(net))} net`
  const message = [
    s.verdict,
    '',
    `Lifetime: kept ${usd(s.lifetime.platformRetainedCents)} · infra ${usd(s.lifetime.infraCostCents)} · net ${net >= 0 ? '+' : '−'}${usd(Math.abs(net))}`,
    `Last ${s.windowDays}d: net ${s.window.operationalNetCents >= 0 ? '+' : '−'}${usd(Math.abs(s.window.operationalNetCents))}`,
    ...(s.topCostCategory ? [`Top cost: ${s.topCostCategory.category} (${usd(s.topCostCategory.costCents)})`] : []),
  ].join('\n')

  // A red day pushes louder than a green one.
  const priority = s.status === 'negative' ? 7 : s.status === 'watch' ? 4 : 2

  const targets = tenantParam
    ? [Number.isNaN(Number(tenantParam)) ? tenantParam : Number(tenantParam)]
    : await resolveConnectorTenants(payload)

  if (dry) {
    return Response.json({ ok: true, dry: true, snapshot, briefing: { title, message, priority }, targets })
  }

  const dispatched: Array<{ tenant: number | string; matched: number; sent: number; suppressed: number; failed: number }> = []
  for (const tenantId of targets) {
    try {
      const r = await dispatchEscalation(payload, {
        tenantId,
        eventType: 'maintenance_note',
        title,
        message,
        priority,
        dedupeKey: 'solvency-daily',
      })
      dispatched.push({ tenant: tenantId, ...r })
    } catch {
      /* fail-soft per tenant */
    }
  }

  return Response.json({
    ok: true,
    status: s.status,
    net: net,
    targetsCount: targets.length,
    dispatched,
    verdict: s.verdict,
  })
}
