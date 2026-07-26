/**
 * BootstrapFeeCard — the platform fee-tier status (free → bootstrap → standard).
 *
 * Lives on the AI Costs tab (the economic viewscreen), alongside AI spend — it's a
 * billing/cost concept (free-transaction allowance, GMV cap, bootstrap fee + refund
 * liability), not main-dashboard chrome. Presentational; data is fetched server-side
 * on the ai-costs page (getBootstrapFeeStatus / getTotalBootstrapLiability).
 */

export interface BootstrapFeeStatus {
  tier: string
  freeTransactionsUsed: number
  freeTransactionLimit: number
  freeGmvCents: number
  freeGmvLimitCents: number
  bootstrapFeePercent: number
  totalFeesCollectedCents: number
  refundPromised: boolean
  refundStatus: string
  freeTransactionsRemaining: number
}

export interface PlatformLiability {
  totalLiabilityCents: number
  tenantsInBootstrap: number
  tenantsInFree: number
  tenantsGraduated: number
}

export function BootstrapFeeCard({
  feeStatus,
  platformLiability,
  isSuperAdmin,
}: {
  feeStatus: BootstrapFeeStatus
  platformLiability: PlatformLiability | null
  isSuperAdmin: boolean
}) {
  const tierConfig = {
    free: {
      color: 'border-emerald-200 dark:border-emerald-800',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      dot: 'bg-emerald-500',
      label: 'Free Tier',
      description: `${feeStatus.freeTransactionsRemaining} free transactions remaining`,
    },
    bootstrap: {
      color: 'border-amber-200 dark:border-amber-800',
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      dot: 'bg-amber-500',
      label: 'Bootstrap Phase',
      description: `${feeStatus.bootstrapFeePercent}% fee — full refund promised`,
    },
    standard: {
      color: 'border-blue-200 dark:border-blue-800',
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      dot: 'bg-blue-500',
      label: 'Standard',
      description: 'Standard platform rate — you keep 95%',
    },
  }

  const tier = tierConfig[feeStatus.tier as keyof typeof tierConfig] || tierConfig.free

  return (
    <div className={`rounded-lg border ${tier.color} ${tier.bg} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-block h-3 w-3 rounded-full ${tier.dot}`} />
          <div>
            <h3 className="font-semibold">{tier.label}</h3>
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          </div>
        </div>

        {feeStatus.tier === 'free' && (
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {feeStatus.freeTransactionsUsed}/{feeStatus.freeTransactionLimit}
            </p>
            <p className="text-xs text-muted-foreground">transactions used</p>
          </div>
        )}

        {feeStatus.tier === 'bootstrap' && (
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ${(feeStatus.totalFeesCollectedCents / 100).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              collected — {feeStatus.refundPromised ? 'refund committed' : 'refund waived'}
            </p>
          </div>
        )}
      </div>

      {/* Free tier progress bar */}
      {feeStatus.tier === 'free' && feeStatus.freeTransactionLimit > 0 && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-emerald-200/50 dark:bg-emerald-800/30">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, (feeStatus.freeTransactionsUsed / feeStatus.freeTransactionLimit) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ${(feeStatus.freeGmvCents / 100).toFixed(0)} / ${(feeStatus.freeGmvLimitCents / 100).toFixed(0)} GMV
          </p>
        </div>
      )}

      {/* Super admin: platform-wide liability */}
      {isSuperAdmin && platformLiability && (
        <div className="mt-4 grid grid-cols-4 gap-3 border-t border-current/10 pt-3">
          <div className="text-center">
            <p className="text-lg font-bold">${(platformLiability.totalLiabilityCents / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Refund Liability</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{platformLiability.tenantsInFree}</p>
            <p className="text-xs text-muted-foreground">Free Tier</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{platformLiability.tenantsInBootstrap}</p>
            <p className="text-xs text-muted-foreground">Bootstrap</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{platformLiability.tenantsGraduated}</p>
            <p className="text-xs text-muted-foreground">Graduated</p>
          </div>
        </div>
      )}
    </div>
  )
}
