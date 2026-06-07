/**
 * Unit tests for per-tenant AI budget status (aiBudget.ts).
 * Spend is derived from the Messages.metadata scan (getAiCostSummary), so we mock
 * payload.find to return ai_agent telemetry docs.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTenantAiBudgetStatus,
  resolveOwnKeyProvider,
  invalidateBudgetSpend,
  DEFAULT_FREE_BUDGET_CENTS,
} from '@/utilities/aiBudget'

function payloadWithSpend(costCentsPerDoc: number[], pageSize = 500) {
  // getAiCostSummary calls payload.find on 'messages'; emit telemetry docs.
  const docs = costCentsPerDoc.map((c) => ({
    metadata: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', costCents: c, totalTokens: 100 },
    createdAt: new Date().toISOString(),
  }))
  return {
    find: async ({ page = 1, limit = pageSize }: { page?: number; limit?: number }) => {
      const start = (page - 1) * limit
      const slice = docs.slice(start, start + limit)
      return { docs: slice, totalDocs: docs.length, totalPages: Math.max(1, Math.ceil(docs.length / limit)), page }
    },
  } as any
}

beforeEach(() => invalidateBudgetSpend())

describe('resolveOwnKeyProvider', () => {
  it('detects anthropic > openrouter > openai precedence', () => {
    expect(resolveOwnKeyProvider({ anthropicApiKey: 'sk', openaiApiKey: 'oa' })).toBe('anthropic')
    expect(resolveOwnKeyProvider({ openrouterApiKey: 'or', openaiApiKey: 'oa' })).toBe('openrouter')
    expect(resolveOwnKeyProvider({ openaiApiKey: 'oa' })).toBe('openai')
  })
  it('returns null when no key / blank', () => {
    expect(resolveOwnKeyProvider(null)).toBeNull()
    expect(resolveOwnKeyProvider({ anthropicApiKey: '   ' })).toBeNull()
    expect(resolveOwnKeyProvider({})).toBeNull()
  })
})

describe('getTenantAiBudgetStatus', () => {
  it('uses the default free budget when no tenant override', async () => {
    const s = await getTenantAiBudgetStatus(payloadWithSpend([]), { tenantId: 1 })
    expect(s.limitCents).toBe(DEFAULT_FREE_BUDGET_CENTS)
    expect(s.limitSource).toBe('default')
    expect(s.spentCents).toBe(0)
    expect(s.overBudget).toBe(false)
    expect(s.remainingCents).toBe(DEFAULT_FREE_BUDGET_CENTS)
  })

  it('applies an agentWallet override when enabled', async () => {
    const s = await getTenantAiBudgetStatus(payloadWithSpend([]), {
      tenantId: 2,
      agentWallet: { enabled: true, monthlyBudgetCents: 2000 },
    })
    expect(s.limitCents).toBe(2000)
    expect(s.limitSource).toBe('tenant')
  })

  it('ignores agentWallet when disabled or zero', async () => {
    const s = await getTenantAiBudgetStatus(payloadWithSpend([]), {
      tenantId: 3,
      agentWallet: { enabled: false, monthlyBudgetCents: 9999 },
    })
    expect(s.limitCents).toBe(DEFAULT_FREE_BUDGET_CENTS)
  })

  it('computes spent + remaining + overBudget from telemetry', async () => {
    // 600 cents spent against a 500-cent default budget → over budget
    const s = await getTenantAiBudgetStatus(payloadWithSpend([300, 300]), { tenantId: 4 })
    expect(s.spentCents).toBeCloseTo(600, 3)
    expect(s.overBudget).toBe(true)
    expect(s.remainingCents).toBe(0)
    expect(s.usedRatio).toBeGreaterThan(1)
  })

  it('reports BYOK availability from aiConfig', async () => {
    const s = await getTenantAiBudgetStatus(payloadWithSpend([]), {
      tenantId: 5,
      tenantAiConfig: { openrouterApiKey: 'or-key' },
    })
    expect(s.hasOwnKey).toBe(true)
    expect(s.ownKeyProvider).toBe('openrouter')
  })

  it('caches spend per tenant (second call does not re-scan)', async () => {
    let calls = 0
    const payload = {
      find: async () => {
        calls++
        return { docs: [{ metadata: { model: 'm/x', provider: 'gateway', costCents: 10, totalTokens: 1 }, createdAt: new Date().toISOString() }], totalDocs: 1, totalPages: 1, page: 1 }
      },
    } as any
    await getTenantAiBudgetStatus(payload, { tenantId: 99 })
    const callsAfterFirst = calls
    await getTenantAiBudgetStatus(payload, { tenantId: 99 })
    expect(calls).toBe(callsAfterFirst) // cached
  })
})
