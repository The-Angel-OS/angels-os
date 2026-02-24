/**
 * Bootstrap-Phase Platform Fee Engine
 *
 * Philosophy: Angel OS promises fairness from day one. During the bootstrap
 * phase, the platform needs revenue to cover hosting, Stripe fees, AI costs,
 * and development. Rather than taking fees silently, the model is transparent:
 *
 *   1. FREE TIER — first N transactions or $X in GMV are completely free.
 *      The platform eats the cost as an investment in the tenant's success.
 *
 *   2. BOOTSTRAP — after the free tier, a small fee (default 5%) is applied.
 *      Every cent is tracked and committed for FULL REFUND when the bootstrap
 *      phase ends. This is a binding promise, not a marketing claim.
 *
 *   3. STANDARD — post-bootstrap, the normal UltimateFairSplit (60/20/15/5)
 *      applies. No additional bootstrap fee.
 *
 * The refund promise is the constitutional difference between Angel OS and
 * every other platform that takes fees and never looks back. The Soul Fleet
 * bootstraps together — early tenants are investors, not customers.
 */

import { getPayload } from 'payload'
import configPromise from '@payload-config'

// ─── Types ───────────────────────────────────────────────────────────────

export type BootstrapTier = 'free' | 'bootstrap' | 'standard'
export type RefundStatus = 'accruing' | 'processing' | 'completed' | 'waived'

export interface BootstrapFeeResult {
  /** Current tier after this transaction */
  tier: BootstrapTier
  /** Bootstrap fee in cents to add to the platform fee (0 if free or standard) */
  bootstrapFeeCents: number
  /** Whether the tenant just graduated from free to bootstrap */
  tierChanged: boolean
  /** Total refund liability after this transaction */
  totalRefundLiabilityCents: number
  /** Free transactions remaining (0 if none) */
  freeTransactionsRemaining: number
}

interface BootstrapFields {
  tier?: BootstrapTier
  freeTransactionsUsed?: number
  freeTransactionLimit?: number
  freeGmvCents?: number
  freeGmvLimitCents?: number
  bootstrapFeePercent?: number
  totalFeesCollectedCents?: number
  refundPromised?: boolean
  refundStatus?: RefundStatus
  bootstrapStartedAt?: string | null
  bootstrapEndedAt?: string | null
}

// ─── Core Functions ──────────────────────────────────────────────────────

/**
 * Calculate the bootstrap fee for a transaction and update tenant state.
 *
 * Called from the Stripe adapter before creating a PaymentIntent.
 * Returns the fee amount to add to the application_fee_amount.
 */
export async function calculateBootstrapFee(
  tenantId: number,
  transactionAmountCents: number,
): Promise<BootstrapFeeResult> {
  const payload = await getPayload({ config: configPromise })

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
  })

  const bf = (tenant.bootstrapFees ?? {}) as BootstrapFields
  const currentTier = bf.tier || 'free'
  const freeUsed = bf.freeTransactionsUsed ?? 0
  const freeLimit = bf.freeTransactionLimit ?? 50
  const freeGmv = bf.freeGmvCents ?? 0
  const freeGmvLimit = bf.freeGmvLimitCents ?? 500000
  const feePercent = bf.bootstrapFeePercent ?? 5
  const totalCollected = bf.totalFeesCollectedCents ?? 0

  // ─── Standard tier: no bootstrap fee ─────────────────────────────
  if (currentTier === 'standard') {
    return {
      tier: 'standard',
      bootstrapFeeCents: 0,
      tierChanged: false,
      totalRefundLiabilityCents: totalCollected,
      freeTransactionsRemaining: 0,
    }
  }

  // ─── Free tier: check if we should graduate to bootstrap ─────────
  if (currentTier === 'free') {
    const newFreeUsed = freeUsed + 1
    const newFreeGmv = freeGmv + transactionAmountCents

    // Still within free tier?
    if (newFreeUsed <= freeLimit && newFreeGmv <= freeGmvLimit) {
      // Update counters
      await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
          bootstrapFees: {
            ...bf,
            freeTransactionsUsed: newFreeUsed,
            freeGmvCents: newFreeGmv,
          },
        },
      })

      return {
        tier: 'free',
        bootstrapFeeCents: 0,
        tierChanged: false,
        totalRefundLiabilityCents: 0,
        freeTransactionsRemaining: Math.max(0, freeLimit - newFreeUsed),
      }
    }

    // Graduate to bootstrap tier
    const bootstrapFeeCents = Math.round(transactionAmountCents * (feePercent / 100))
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        bootstrapFees: {
          ...bf,
          tier: 'bootstrap',
          freeTransactionsUsed: newFreeUsed,
          freeGmvCents: newFreeGmv,
          totalFeesCollectedCents: bootstrapFeeCents,
          bootstrapStartedAt: new Date().toISOString(),
        },
      },
    })

    return {
      tier: 'bootstrap',
      bootstrapFeeCents,
      tierChanged: true,
      totalRefundLiabilityCents: bootstrapFeeCents,
      freeTransactionsRemaining: 0,
    }
  }

  // ─── Bootstrap tier: apply fee and track for refund ──────────────
  const bootstrapFeeCents = Math.round(transactionAmountCents * (feePercent / 100))
  const newTotal = totalCollected + bootstrapFeeCents

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      bootstrapFees: {
        ...bf,
        totalFeesCollectedCents: newTotal,
      },
    },
  })

  return {
    tier: 'bootstrap',
    bootstrapFeeCents,
    tierChanged: false,
    totalRefundLiabilityCents: newTotal,
    freeTransactionsRemaining: 0,
  }
}

/**
 * Get the current bootstrap fee status for a tenant.
 * Used by the dashboard to show fee tier, refund liability, etc.
 */
export async function getBootstrapFeeStatus(tenantId: number) {
  const payload = await getPayload({ config: configPromise })

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
  })

  const bf = (tenant.bootstrapFees ?? {}) as BootstrapFields

  return {
    tier: bf.tier || 'free',
    freeTransactionsUsed: bf.freeTransactionsUsed ?? 0,
    freeTransactionLimit: bf.freeTransactionLimit ?? 50,
    freeGmvCents: bf.freeGmvCents ?? 0,
    freeGmvLimitCents: bf.freeGmvLimitCents ?? 500000,
    bootstrapFeePercent: bf.bootstrapFeePercent ?? 5,
    totalFeesCollectedCents: bf.totalFeesCollectedCents ?? 0,
    refundPromised: bf.refundPromised ?? true,
    refundStatus: bf.refundStatus ?? 'accruing',
    bootstrapStartedAt: bf.bootstrapStartedAt ?? null,
    bootstrapEndedAt: bf.bootstrapEndedAt ?? null,
    freeTransactionsRemaining: Math.max(
      0,
      (bf.freeTransactionLimit ?? 50) - (bf.freeTransactionsUsed ?? 0),
    ),
  }
}

/**
 * Transition a tenant from bootstrap to standard tier.
 * Called when the platform-wide bootstrap phase ends.
 * Does NOT process the refund — that's a separate Stripe operation.
 */
export async function graduateToStandard(tenantId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
  })

  const bf = (tenant.bootstrapFees ?? {}) as BootstrapFields

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      bootstrapFees: {
        ...bf,
        tier: 'standard',
        bootstrapEndedAt: new Date().toISOString(),
        refundStatus: 'processing',
      },
    },
  })
}

/**
 * Get the total bootstrap refund liability across ALL tenants.
 * Used by the admin dashboard to see total platform obligation.
 */
export async function getTotalBootstrapLiability(): Promise<{
  totalLiabilityCents: number
  tenantsInBootstrap: number
  tenantsInFree: number
  tenantsGraduated: number
}> {
  const payload = await getPayload({ config: configPromise })

  const tenants = await payload.find({
    collection: 'tenants',
    limit: 500,
    depth: 0,
    pagination: false,
  })

  let totalLiabilityCents = 0
  let tenantsInBootstrap = 0
  let tenantsInFree = 0
  let tenantsGraduated = 0

  for (const tenant of tenants.docs) {
    const bf = ((tenant as Record<string, unknown>).bootstrapFees ?? {}) as BootstrapFields
    const tier = bf.tier || 'free'

    if (tier === 'free') tenantsInFree++
    else if (tier === 'bootstrap') {
      tenantsInBootstrap++
      totalLiabilityCents += bf.totalFeesCollectedCents ?? 0
    } else {
      tenantsGraduated++
      // Still count liability if refund not yet complete
      if (bf.refundStatus !== 'completed' && bf.refundStatus !== 'waived') {
        totalLiabilityCents += bf.totalFeesCollectedCents ?? 0
      }
    }
  }

  return {
    totalLiabilityCents,
    tenantsInBootstrap,
    tenantsInFree,
    tenantsGraduated,
  }
}
