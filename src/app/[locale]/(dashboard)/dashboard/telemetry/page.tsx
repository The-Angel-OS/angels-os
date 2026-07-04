import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { TelemetryCIC } from './TelemetryCIC'

/**
 * Telemetry — /dashboard/telemetry
 *
 * The Merlin node CIC. Each node that locks onto this portal gets a dedicated channel
 * on the AI Bus; its heartbeat, tool-use, and command/result traffic ARE the telemetry.
 * This page is the lens on that conversation: a roster of the portal's own nodes + the
 * selected node's live control surface (console uplink, screenshots, files, stats).
 *
 * Scope: per-tenant — each portal sees its own nodes (endeavor slug = tenant slug). The
 * federated view-only tier (see contributing nodes elsewhere, can't drive them) lands
 * later. Distinct from /dashboard/cic (crew + tool-metrics) and /dashboard/ai-costs.
 */
export default async function TelemetryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Nodes register per endeavor; a portal's endeavor slug is its tenant slug.
  const { tenant } = await resolveTenantFromHeaders()
  const endeavor = tenant?.slug || ''
  const endeavorName = tenant?.name || endeavor || 'This Portal'

  return <TelemetryCIC endeavor={endeavor} endeavorName={endeavorName} />
}
