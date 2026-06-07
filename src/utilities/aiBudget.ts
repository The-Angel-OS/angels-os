/**
 * aiBudget — per-tenant AI spend budget (the economic close).
 *
 * Bounded free tier per tenant: the platform covers AI cost up to a monthly
 * budget; past it, the tenant routes to its OWN provider key (BYOK, $0 to the
 * platform) or is metered. This module computes the budget STATUS; enforcement
 * lives in leo-stream (env-gated). Non-extractive + transparent — the panel
 * shows exactly what's used and what's left.
 *
 * Spend is derived (not a stored counter): month-to-date AI cost from the same
 * Messages.metadata telemetry the panel reads, so the number always matches what
 * the user sees. Cached per tenant (short TTL) so the hot path doesn't query the
 * DB every request.
 *
 * @see src/utilities/aiCostTelemetry.ts — month-to-date spend source
 * @see src/collections/Tenants — agentWallet (budget override) + aiConfig (BYOK keys)
 */
import type { Payload } from 'payload'
import { getAiCostSummary } from './aiCostTelemetry'

/** Platform default free AI budget, cents/month. Override per-tenant via agentWallet. */
export const DEFAULT_FREE_BUDGET_CENTS = (() => {
  const raw = Number(process.env.AI_FREE_BUDGET_CENTS_PER_MONTH)
  return Number.isFinite(raw) && raw >= 0 ? raw : 500 // $5.00/mo
})()

/** Enforcement is OFF unless explicitly enabled — visibility ships first, safely. */
export function isBudgetEnforcementEnabled(): boolean {
  return process.env.AI_BUDGET_ENFORCEMENT === 'true'
}

export interface TenantAiBudgetStatus {
  /** Monthly budget ceiling in cents (platform-paid). */
  limitCents: number
  /** Month-to-date platform-paid AI spend in cents. */
  spentCents: number
  /** max(0, limit - spent). */
  remainingCents: number
  /** spent / limit, clamped 0..>1. */
  usedRatio: number
  /** True once spend meets/exceeds the limit. */
  overBudget: boolean
  /** True when the tenant has its own text-model provider key (BYOK available). */
  hasOwnKey: boolean
  /** Which BYOK provider would serve (anthropic | openrouter | openai), if any. */
  ownKeyProvider: 'anthropic' | 'openrouter' | 'openai' | null
  /** Whether the limit came from a per-tenant override (agentWallet) or the default. */
  limitSource: 'tenant' | 'default'
  /** Whether enforcement is currently active platform-wide. */
  enforcementEnabled: boolean
}

interface BudgetInputs {
  tenantId: number | string
  /** Tenants.agentWallet group (optional override of the default free budget). */
  agentWallet?: { enabled?: boolean; monthlyBudgetCents?: number } | null
  /** Tenants.aiConfig group (BYOK keys). */
  tenantAiConfig?: Record<string, unknown> | null
}

/** Detect an available BYOK text provider from the tenant's aiConfig. */
export function resolveOwnKeyProvider(
  cfg?: Record<string, unknown> | null,
): TenantAiBudgetStatus['ownKeyProvider'] {
  if (!cfg) return null
  if (typeof cfg.anthropicApiKey === 'string' && cfg.anthropicApiKey.trim()) return 'anthropic'
  if (typeof cfg.openrouterApiKey === 'string' && cfg.openrouterApiKey.trim()) return 'openrouter'
  if (typeof cfg.openaiApiKey === 'string' && cfg.openaiApiKey.trim()) return 'openai'
  return null
}

// ── month-to-date spend cache (per tenant) ─────────────────────────────────────
const SPEND_TTL_MS = 5 * 60 * 1000
const spendCache = new Map<string, { value: number; expires: number }>()

/** Clear a tenant's cached spend (call after a known large spend, or in tests). */
export function invalidateBudgetSpend(tenantId?: number | string): void {
  if (tenantId == null) spendCache.clear()
  else spendCache.delete(String(tenantId))
}

function daysSinceMonthStart(now: number): number {
  const d = new Date(now)
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  return Math.max(1, Math.ceil((now - start) / (24 * 60 * 60 * 1000)) + 1)
}

/**
 * Month-to-date platform-paid AI spend for a tenant, in cents. Cached.
 * Derived from Messages.metadata (the same source the panel shows). Fail-soft → 0.
 */
export async function getMonthToDateSpendCents(
  payload: Payload,
  tenantId: number | string,
  nowMs: number = Date.now(),
): Promise<number> {
  const key = String(tenantId)
  const hit = spendCache.get(key)
  if (hit && hit.expires > nowMs) return hit.value
  let spent = 0
  try {
    const summary = await getAiCostSummary(payload, tenantId, { days: daysSinceMonthStart(nowMs) })
    spent = summary.totals.costCents || 0
  } catch {
    spent = 0
  }
  spendCache.set(key, { value: spent, expires: nowMs + SPEND_TTL_MS })
  return spent
}

/**
 * Compute the full budget status for a tenant. Fail-soft.
 */
export async function getTenantAiBudgetStatus(
  payload: Payload,
  inputs: BudgetInputs,
  nowMs: number = Date.now(),
): Promise<TenantAiBudgetStatus> {
  const override =
    inputs.agentWallet?.enabled && (inputs.agentWallet.monthlyBudgetCents ?? 0) > 0
      ? (inputs.agentWallet!.monthlyBudgetCents as number)
      : null
  const limitCents = override ?? DEFAULT_FREE_BUDGET_CENTS
  const spentCents = await getMonthToDateSpendCents(payload, inputs.tenantId, nowMs)
  const remainingCents = Math.max(0, Math.round((limitCents - spentCents) * 1000) / 1000)
  const usedRatio = limitCents > 0 ? spentCents / limitCents : spentCents > 0 ? Infinity : 0
  const ownKeyProvider = resolveOwnKeyProvider(inputs.tenantAiConfig)

  return {
    limitCents,
    spentCents: Math.round(spentCents * 1000) / 1000,
    remainingCents,
    usedRatio,
    overBudget: limitCents > 0 && spentCents >= limitCents,
    hasOwnKey: ownKeyProvider != null,
    ownKeyProvider,
    limitSource: override != null ? 'tenant' : 'default',
    enforcementEnabled: isBudgetEnforcementEnabled(),
  }
}
