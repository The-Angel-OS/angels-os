/**
 * Agent Wallet Service
 *
 * Core wallet operations for LEO as an economic actor in the federation.
 * The wallet is scoped to a tenant (Enterprise) and tracks spending/earning
 * across federation skill invocations.
 *
 * STRUCTURAL GUARDRAILS: The agent CANNOT override its own spending limits.
 * All limits are set by the Enterprise operator and enforced by this service.
 *
 * Constitutional Reference:
 *   Article I — "Sovereignty: Users own their data" (operator controls the wallet)
 *   Article V — "Toward-53: transparent economic model"
 *   Article II — "No automated punishment" (failures are graceful, not punitive)
 */

import type { Payload } from 'payload'
import {
  checkSpendingGuardrails,
  DEFAULT_SPENDING_GUARDRAILS,
  type SkillCategory,
  type SpendingGuardrails,
} from '@/federation/skills'

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalletStatus {
  enabled: boolean
  monthlyBudgetCents: number
  spentThisMonthCents: number
  lifetimeSpentCents: number
  lifetimeEarnedCents: number
  remainingThisMonthCents: number
  guardrails: SpendingGuardrails
  lastResetAt: string | null
}

export interface SpendResult {
  success: boolean
  transactionId?: number
  remainingCents: number
  message: string
  requiresHumanApproval?: boolean
}

// ── Core Operations ────────────────────────────────────────────────────────

/**
 * Check if the agent wallet has sufficient budget for a spend.
 */
export async function canSpend(
  payload: Payload,
  tenantId: number,
  amountCents: number,
  category: SkillCategory = 'catalog',
): Promise<{ allowed: boolean; reason?: string; requiresHumanApproval?: boolean }> {
  const wallet = await getWalletStatus(payload, tenantId)

  if (!wallet.enabled) {
    return { allowed: false, reason: 'Agent wallet is not enabled for this Enterprise' }
  }

  // Get today's spend for daily limit check
  const dailySpend = await getDailySpend(payload, tenantId)

  return checkSpendingGuardrails(
    wallet.guardrails,
    amountCents,
    category,
    dailySpend,
    wallet.spentThisMonthCents,
  )
}

/**
 * Record a spend from the agent wallet.
 */
export async function recordSpend(
  payload: Payload,
  tenantId: number,
  amountCents: number,
  description: string,
  opts: {
    targetFederationId?: string
    targetDomain?: string
    targetName?: string
    skillInvoked?: string
    skillCategory?: SkillCategory
  } = {},
): Promise<SpendResult> {
  // Verify budget first
  const check = await canSpend(payload, tenantId, amountCents, opts.skillCategory || 'catalog')
  if (!check.allowed) {
    return {
      success: false,
      remainingCents: 0,
      message: check.reason || 'Spending not allowed',
    }
  }

  if (check.requiresHumanApproval) {
    return {
      success: false,
      remainingCents: 0,
      message: check.reason || 'Requires human approval',
      requiresHumanApproval: true,
    }
  }

  try {
    // Create transaction record
    const transaction = await payload.create({
      collection: 'agent-transactions' as any,
      data: {
        type: 'spend',
        amountCents,
        currency: 'usd',
        description,
        counterpartyFederationId: opts.targetFederationId,
        counterpartyDomain: opts.targetDomain,
        counterpartyName: opts.targetName,
        skillInvoked: opts.skillInvoked,
        skillCategory: opts.skillCategory,
        status: 'completed',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // Update tenant wallet counters
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    const agentWallet = (tenant as unknown as Record<string, unknown>).agentWallet as
      | Record<string, unknown>
      | undefined

    const currentSpent = (agentWallet?.spentThisMonthCents as number) || 0
    const lifetimeSpent = (agentWallet?.lifetimeSpentCents as number) || 0
    const monthlyBudget = (agentWallet?.monthlyBudgetCents as number) || 0

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        agentWallet: {
          spentThisMonthCents: currentSpent + amountCents,
          lifetimeSpentCents: lifetimeSpent + amountCents,
        },
      } as any,
      overrideAccess: true,
    })

    return {
      success: true,
      transactionId: transaction.id as number,
      remainingCents: Math.max(0, monthlyBudget - currentSpent - amountCents),
      message: `Spent $${(amountCents / 100).toFixed(2)} — ${description}`,
    }
  } catch (err) {
    console.error('[AgentWallet] Spend error:', err)
    return {
      success: false,
      remainingCents: 0,
      message: `Wallet error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

/**
 * Record an earning to the agent wallet.
 */
export async function recordEarning(
  payload: Payload,
  tenantId: number,
  amountCents: number,
  description: string,
  opts: {
    sourceFederationId?: string
    sourceDomain?: string
    sourceName?: string
    skillInvoked?: string
    skillCategory?: SkillCategory
  } = {},
): Promise<{ success: boolean; transactionId?: number; message: string }> {
  try {
    const transaction = await payload.create({
      collection: 'agent-transactions' as any,
      data: {
        type: 'earn',
        amountCents,
        currency: 'usd',
        description,
        counterpartyFederationId: opts.sourceFederationId,
        counterpartyDomain: opts.sourceDomain,
        counterpartyName: opts.sourceName,
        skillInvoked: opts.skillInvoked,
        skillCategory: opts.skillCategory,
        status: 'completed',
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    // Update lifetime earnings
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    const agentWallet = (tenant as unknown as Record<string, unknown>).agentWallet as
      | Record<string, unknown>
      | undefined
    const lifetimeEarned = (agentWallet?.lifetimeEarnedCents as number) || 0

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        agentWallet: {
          lifetimeEarnedCents: lifetimeEarned + amountCents,
        },
      } as any,
      overrideAccess: true,
    })

    return {
      success: true,
      transactionId: transaction.id as number,
      message: `Earned $${(amountCents / 100).toFixed(2)} — ${description}`,
    }
  } catch (err) {
    console.error('[AgentWallet] Earn error:', err)
    return {
      success: false,
      message: `Wallet error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get the current wallet status for a tenant.
 */
export async function getWalletStatus(
  payload: Payload,
  tenantId: number,
): Promise<WalletStatus> {
  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })

    const agentWallet = (tenant as unknown as Record<string, unknown>).agentWallet as
      | Record<string, unknown>
      | undefined

    const enabled = (agentWallet?.enabled as boolean) || false
    const monthlyBudgetCents = (agentWallet?.monthlyBudgetCents as number) || 0
    const spentThisMonthCents = (agentWallet?.spentThisMonthCents as number) || 0
    const lifetimeSpentCents = (agentWallet?.lifetimeSpentCents as number) || 0
    const lifetimeEarnedCents = (agentWallet?.lifetimeEarnedCents as number) || 0
    const lastResetAt = (agentWallet?.lastResetAt as string) || null

    // Parse spending rules or use defaults
    const spendingRules = agentWallet?.spendingRules as Partial<SpendingGuardrails> | undefined
    const guardrails: SpendingGuardrails = {
      ...DEFAULT_SPENDING_GUARDRAILS,
      ...spendingRules,
      monthlyBudgetCents,
    }

    return {
      enabled,
      monthlyBudgetCents,
      spentThisMonthCents,
      lifetimeSpentCents,
      lifetimeEarnedCents,
      remainingThisMonthCents: Math.max(0, monthlyBudgetCents - spentThisMonthCents),
      guardrails,
      lastResetAt,
    }
  } catch {
    return {
      enabled: false,
      monthlyBudgetCents: 0,
      spentThisMonthCents: 0,
      lifetimeSpentCents: 0,
      lifetimeEarnedCents: 0,
      remainingThisMonthCents: 0,
      guardrails: DEFAULT_SPENDING_GUARDRAILS,
      lastResetAt: null,
    }
  }
}

/**
 * Get today's total spend for daily limit checking.
 */
async function getDailySpend(payload: Payload, tenantId: number): Promise<number> {
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const transactions = await payload.find({
      collection: 'agent-transactions' as any,
      where: {
        and: [
          { type: { equals: 'spend' } },
          { status: { equals: 'completed' } },
          { tenant: { equals: tenantId } },
          { createdAt: { greater_than: startOfDay.toISOString() } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })

    return transactions.docs.reduce(
      (sum: number, tx: any) => sum + ((tx as Record<string, unknown>).amountCents as number || 0),
      0,
    )
  } catch {
    return 0
  }
}

/**
 * Reset the monthly budget counter. Called by cron at month start.
 */
export async function resetMonthlyBudget(
  payload: Payload,
  tenantId: number,
): Promise<void> {
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      agentWallet: {
        spentThisMonthCents: 0,
        lastResetAt: new Date().toISOString(),
      },
    } as any,
    overrideAccess: true,
  })
}
