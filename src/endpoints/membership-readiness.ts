/**
 * Earn-loop readiness — GET /api/membership-ops/readiness?tenant=<slug>
 *
 * One truthful answer to "can this endeavor take a real dollar yet?" — the data
 * behind the dashboard "Ready to Earn" card. The check logic lives in
 * utilities/earnReadiness.ts so the API and the UI can never drift.
 *
 * Booleans only (no account ids / secrets), so it's safe as a public read.
 *
 * @see src/utilities/earnReadiness.ts  @see src/endpoints/membership-checkout.ts
 */
import type { PayloadHandler } from 'payload'
import { getEarnReadiness } from '@/utilities/earnReadiness'

export const membershipReadinessHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const slug = req.headers?.get('x-tenant-id') || url.searchParams.get('tenant') || ''
  if (!slug) return Response.json({ error: 'tenant slug required (x-tenant-id or ?tenant=)' }, { status: 400 })

  const r = await getEarnReadiness(req.payload, { slug })
  if (!r.ok) return Response.json({ error: r.error || `No endeavor "${slug}"` }, { status: 404 })

  return Response.json({
    tenant: r.tenantSlug,
    ready: r.ready,
    billingMode: r.billingMode,
    checks: r.checks,
    nextAction: r.nextAction,
  })
}
