/**
 * agentWallet — Unit Tests
 *
 * Tests wallet status, spend/earn recording, and monthly budget reset.
 * Payload is passed as a parameter — no module-level mocking needed for it.
 * The federation/skills module is mocked to isolate wallet orchestration logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const { mockCheckSpendingGuardrails } = vi.hoisted(() => ({
  mockCheckSpendingGuardrails: vi.fn(),
}))

vi.mock('@/federation/skills', () => ({
  checkSpendingGuardrails: mockCheckSpendingGuardrails,
  DEFAULT_SPENDING_GUARDRAILS: {
    maxPerTransactionCents: 1000,
    maxDailySpendCents: 5000,
    monthlyBudgetCents: 10000,
    allowedCategories: ['catalog', 'booking', 'content', 'analytics'],
    humanApprovalThresholdCents: 500,
  },
}))

import {
  getWalletStatus,
  canSpend,
  recordSpend,
  recordEarning,
  resetMonthlyBudget,
} from '@/utilities/agentWallet'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeAgentWallet(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    monthlyBudgetCents: 5000,
    spentThisMonthCents: 500,
    lifetimeSpentCents: 1200,
    lifetimeEarnedCents: 800,
    lastResetAt: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makePayload({
  agentWallet = makeAgentWallet(),
  findDocs = [],
  createReturn = { id: 101 },
}: {
  agentWallet?: Record<string, unknown> | undefined
  findDocs?: unknown[]
  createReturn?: unknown
} = {}) {
  const tenant = agentWallet !== undefined ? { agentWallet } : {}
  return {
    findByID: vi.fn().mockResolvedValue(tenant),
    find: vi.fn().mockResolvedValue({ docs: findDocs }),
    create: vi.fn().mockResolvedValue(createReturn),
    update: vi.fn().mockResolvedValue({}),
  } as any
}

// ── getWalletStatus ───────────────────────────────────────────────────────────

describe('getWalletStatus', () => {
  it('returns correct values from stored agentWallet', async () => {
    const payload = makePayload()
    const status = await getWalletStatus(payload, 1)
    expect(status.enabled).toBe(true)
    expect(status.monthlyBudgetCents).toBe(5000)
    expect(status.spentThisMonthCents).toBe(500)
    expect(status.lifetimeSpentCents).toBe(1200)
    expect(status.lifetimeEarnedCents).toBe(800)
    expect(status.lastResetAt).toBe('2026-03-01T00:00:00Z')
  })

  it('computes remainingThisMonthCents as budget minus spent', async () => {
    const payload = makePayload({
      agentWallet: makeAgentWallet({ monthlyBudgetCents: 5000, spentThisMonthCents: 1500 }),
    })
    const status = await getWalletStatus(payload, 1)
    expect(status.remainingThisMonthCents).toBe(3500)
  })

  it('clamps remainingThisMonthCents to 0 when overspent', async () => {
    const payload = makePayload({
      agentWallet: makeAgentWallet({ monthlyBudgetCents: 100, spentThisMonthCents: 200 }),
    })
    const status = await getWalletStatus(payload, 1)
    expect(status.remainingThisMonthCents).toBe(0)
  })

  it('returns disabled defaults when tenant has no agentWallet', async () => {
    const payload = { findByID: vi.fn().mockResolvedValue({}) } as any
    const status = await getWalletStatus(payload, 1)
    expect(status.enabled).toBe(false)
    expect(status.monthlyBudgetCents).toBe(0)
  })

  it('returns disabled defaults when findByID throws', async () => {
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error('DB fail')),
    } as any
    const status = await getWalletStatus(payload, 1)
    expect(status.enabled).toBe(false)
  })

  it('merges spendingRules with DEFAULT_SPENDING_GUARDRAILS', async () => {
    const payload = makePayload({
      agentWallet: makeAgentWallet({
        monthlyBudgetCents: 9999,
        spendingRules: { maxPerTransactionCents: 250 },
      }),
    })
    const status = await getWalletStatus(payload, 1)
    expect(status.guardrails.maxPerTransactionCents).toBe(250)
    // monthlyBudgetCents from agentWallet should override default
    expect(status.guardrails.monthlyBudgetCents).toBe(9999)
  })
})

// ── canSpend ──────────────────────────────────────────────────────────────────

describe('canSpend', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns not allowed when wallet is disabled', async () => {
    const payload = makePayload({
      agentWallet: makeAgentWallet({ enabled: false }),
    })
    const result = await canSpend(payload, 1, 100)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not enabled')
  })

  it('delegates to checkSpendingGuardrails when enabled', async () => {
    const payload = makePayload()
    mockCheckSpendingGuardrails.mockReturnValue({ allowed: true })
    const result = await canSpend(payload, 1, 100)
    expect(result.allowed).toBe(true)
    expect(mockCheckSpendingGuardrails).toHaveBeenCalled()
  })

  it('propagates requiresHumanApproval from guardrail check', async () => {
    const payload = makePayload()
    mockCheckSpendingGuardrails.mockReturnValue({
      allowed: true,
      requiresHumanApproval: true,
      reason: 'Exceeds threshold',
    })
    const result = await canSpend(payload, 1, 600)
    expect(result.requiresHumanApproval).toBe(true)
  })
})

// ── recordSpend ───────────────────────────────────────────────────────────────

describe('recordSpend', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns success=false when canSpend is denied', async () => {
    const payload = makePayload({ agentWallet: makeAgentWallet({ enabled: false }) })
    const result = await recordSpend(payload, 1, 100, 'test spend')
    expect(result.success).toBe(false)
  })

  it('returns success=false with requiresHumanApproval when guardrail blocks', async () => {
    const payload = makePayload()
    mockCheckSpendingGuardrails.mockReturnValue({
      allowed: true,
      requiresHumanApproval: true,
      reason: 'Needs approval',
    })
    const result = await recordSpend(payload, 1, 600, 'big spend')
    expect(result.success).toBe(false)
    expect(result.requiresHumanApproval).toBe(true)
  })

  it('creates transaction and updates tenant on successful spend', async () => {
    const payload = makePayload()
    mockCheckSpendingGuardrails.mockReturnValue({ allowed: true })
    const result = await recordSpend(payload, 1, 200, 'catalog browse')
    expect(result.success).toBe(true)
    expect(result.transactionId).toBe(101)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'agent-transactions',
        data: expect.objectContaining({ type: 'spend', amountCents: 200 }),
      }),
    )
    expect(payload.update).toHaveBeenCalled()
  })

  it('includes spend message with dollar amount', async () => {
    const payload = makePayload()
    mockCheckSpendingGuardrails.mockReturnValue({ allowed: true })
    const result = await recordSpend(payload, 1, 150, 'test')
    expect(result.message).toContain('$1.50')
  })

  it('returns success=false when payload.create throws', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ agentWallet: makeAgentWallet() }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockRejectedValue(new Error('DB error')),
      update: vi.fn(),
    } as any
    mockCheckSpendingGuardrails.mockReturnValue({ allowed: true })
    const result = await recordSpend(payload, 1, 100, 'test')
    expect(result.success).toBe(false)
    expect(result.message).toContain('DB error')
  })

  it('stores optional metadata on the transaction', async () => {
    const payload = makePayload()
    mockCheckSpendingGuardrails.mockReturnValue({ allowed: true })
    await recordSpend(payload, 1, 100, 'buy skill', {
      targetFederationId: 'fed-123',
      targetDomain: 'peer.example.com',
      skillInvoked: 'search_catalog',
      skillCategory: 'catalog',
    })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          counterpartyFederationId: 'fed-123',
          counterpartyDomain: 'peer.example.com',
          skillInvoked: 'search_catalog',
        }),
      }),
    )
  })
})

// ── recordEarning ─────────────────────────────────────────────────────────────

describe('recordEarning', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates earn transaction and updates lifetime earnings', async () => {
    const payload = makePayload({ agentWallet: makeAgentWallet({ lifetimeEarnedCents: 800 }) })
    const result = await recordEarning(payload, 1, 300, 'skill invocation fee')
    expect(result.success).toBe(true)
    expect(result.transactionId).toBe(101)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'earn', amountCents: 300 }),
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentWallet: expect.objectContaining({ lifetimeEarnedCents: 1100 }),
        }),
      }),
    )
  })

  it('includes earn message with dollar amount', async () => {
    const payload = makePayload()
    const result = await recordEarning(payload, 1, 250, 'test')
    expect(result.message).toContain('$2.50')
  })

  it('returns success=false when payload.create throws', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ agentWallet: makeAgentWallet() }),
      create: vi.fn().mockRejectedValue(new Error('write fail')),
      update: vi.fn(),
    } as any
    const result = await recordEarning(payload, 1, 100, 'test')
    expect(result.success).toBe(false)
    expect(result.message).toContain('write fail')
  })
})

// ── resetMonthlyBudget ────────────────────────────────────────────────────────

describe('resetMonthlyBudget', () => {
  it('resets spentThisMonthCents to 0 and sets lastResetAt', async () => {
    const payload = makePayload()
    await resetMonthlyBudget(payload, 1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        id: 1,
        data: expect.objectContaining({
          agentWallet: expect.objectContaining({
            spentThisMonthCents: 0,
          }),
        }),
      }),
    )
    const updateCall = payload.update.mock.calls[0][0]
    expect(updateCall.data.agentWallet.lastResetAt).toBeTruthy()
  })
})
