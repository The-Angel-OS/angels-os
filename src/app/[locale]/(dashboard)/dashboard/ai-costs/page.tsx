import { setRequestLocale } from 'next-intl/server'
import AICostsPanel from './AICostsPanel'

/**
 * AI Costs — /dashboard/ai-costs
 *
 * The economic viewscreen of the control panel: what LEO is costing this tenant,
 * with burn rate, projected monthly, free-vs-paid ratio, failover rate, and the
 * model/provider breakdown. Read-only aggregation of per-response telemetry.
 */
export default async function AICostsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <AICostsPanel />
}
