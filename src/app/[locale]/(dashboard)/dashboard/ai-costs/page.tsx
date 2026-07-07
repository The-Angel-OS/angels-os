import { setRequestLocale } from 'next-intl/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import AICostsPanel from './AICostsPanel'
import ProviderSwitchboard from './ProviderSwitchboard'
import { BootstrapFeeCard } from './BootstrapFeeCard'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getBootstrapFeeStatus, getTotalBootstrapLiability } from '@/utilities/bootstrapFees'

/**
 * AI Costs — /dashboard/ai-costs
 *
 * The economic viewscreen of the control panel: what LEO is costing this tenant,
 * with burn rate, projected monthly, free-vs-paid ratio, failover rate, and the
 * model/provider breakdown. Read-only aggregation of per-response telemetry.
 *
 * Also home to the platform fee-tier card (free → bootstrap → standard) — a
 * billing/cost concept moved off the main dashboard to consolidate the
 * "what this costs" story in one place.
 */
export default async function AICostsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Resolve fee status + (super-admin) platform liability, fail-soft.
  let feeStatus: Awaited<ReturnType<typeof getBootstrapFeeStatus>> | null = null
  let platformLiability: Awaited<ReturnType<typeof getTotalBootstrapLiability>> | null = null
  let isSuperAdmin = false
  try {
    const payload = await getPayload({ config: configPromise })
    const headersList = await nextHeaders()
    const { user } = await payload.auth({ headers: headersList })
    isSuperAdmin = Boolean((user as { roles?: string[] } | null)?.roles?.includes('super_admin'))
    const { tenant: currentTenant } = await resolveTenantFromHeaders()
    const [feeResult, liabilityResult] = await Promise.all([
      currentTenant?.id ? getBootstrapFeeStatus(currentTenant.id as number).catch(() => null) : Promise.resolve(null),
      isSuperAdmin ? getTotalBootstrapLiability().catch(() => null) : Promise.resolve(null),
    ])
    feeStatus = feeResult
    platformLiability = liabilityResult
  } catch {
    /* fee card is non-critical — render the AI cost panel regardless */
  }

  return (
    <div className="space-y-6">
      {feeStatus && (
        <BootstrapFeeCard feeStatus={feeStatus} platformLiability={platformLiability} isSuperAdmin={isSuperAdmin} />
      )}
      <ProviderSwitchboard />
      <AICostsPanel />
    </div>
  )
}
