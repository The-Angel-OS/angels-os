/**
 * bootstrapFees — Unit Tests
 *
 * Tests fee tier logic for calculateBootstrapFee, getBootstrapFeeStatus,
 * graduateToStandard, and getTotalBootstrapLiability.
 *
 * Real Payload calls are replaced with a mock payload instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import {
  calculateBootstrapFee,
  getBootstrapFeeStatus,
  graduateToStandard,
  getTotalBootstrapLiability,
} from '@/utilities/bootstrapFees'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTenant(bootstrapFees: Record<string, unknown> = {}) {
  return { id: 1, bootstrapFees }
}

function makePayload(findByIDReturn: Record<string, unknown>, updateReturn = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(findByIDReturn),
    update: vi.fn().mockResolvedValue(updateReturn),
    find: vi.fn().mockResolvedValue({ docs: [] }),
  } as any
}

// ── calculateBootstrapFee ─────────────────────────────────────────────────────

describe('calculateBootstrapFee — standard tier', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns bootstrapFeeCents=0 and tier=standard immediately', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({ tier: 'standard' })))
    const result = await calculateBootstrapFee(1, 1000)
    expect(result.tier).toBe('standard')
    expect(result.bootstrapFeeCents).toBe(0)
    expect(result.tierChanged).toBe(false)
  })

  it('does not call payload.update for standard tier', async () => {
    const payload = makePayload(makeTenant({ tier: 'standard' }))
    mockGetPayload.mockResolvedValue(payload)
    await calculateBootstrapFee(1, 1000)
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe('calculateBootstrapFee — free tier (within limits)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns bootstrapFeeCents=0 when within free tier', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'free',
      freeTransactionsUsed: 5,
      freeTransactionLimit: 50,
      freeGmvCents: 10000,
      freeGmvLimitCents: 500000,
    })))
    const result = await calculateBootstrapFee(1, 5000)
    expect(result.tier).toBe('free')
    expect(result.bootstrapFeeCents).toBe(0)
    expect(result.tierChanged).toBe(false)
  })

  it('counts down freeTransactionsRemaining correctly', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'free',
      freeTransactionsUsed: 40,
      freeTransactionLimit: 50,
      freeGmvCents: 0,
      freeGmvLimitCents: 500000,
    })))
    const result = await calculateBootstrapFee(1, 100)
    // 41 used, 50 limit → 9 remaining
    expect(result.freeTransactionsRemaining).toBe(9)
  })

  it('calls payload.update to increment counters', async () => {
    const payload = makePayload(makeTenant({
      tier: 'free',
      freeTransactionsUsed: 10,
      freeGmvCents: 5000,
    }))
    mockGetPayload.mockResolvedValue(payload)
    await calculateBootstrapFee(1, 2000)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        id: 1,
        data: expect.objectContaining({
          bootstrapFees: expect.objectContaining({
            freeTransactionsUsed: 11,
            freeGmvCents: 7000,
          }),
        }),
      }),
    )
  })

  it('uses default limits when bootstrapFees is empty', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({})))
    const result = await calculateBootstrapFee(1, 1000)
    // Default: 50 transactions, first one should still be free
    expect(result.tier).toBe('free')
    expect(result.bootstrapFeeCents).toBe(0)
    expect(result.freeTransactionsRemaining).toBe(49)
  })
})

describe('calculateBootstrapFee — free tier (graduating to bootstrap)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('graduates to bootstrap when transaction limit exceeded', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'free',
      freeTransactionsUsed: 50, // already at limit
      freeTransactionLimit: 50,
      freeGmvCents: 0,
      freeGmvLimitCents: 500000,
      bootstrapFeePercent: 5,
    })))
    const result = await calculateBootstrapFee(1, 10000)
    expect(result.tier).toBe('bootstrap')
    expect(result.tierChanged).toBe(true)
  })

  it('calculates bootstrap fee as 5% of amount', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'free',
      freeTransactionsUsed: 50,
      freeTransactionLimit: 50,
      freeGmvCents: 0,
      freeGmvLimitCents: 500000,
      bootstrapFeePercent: 5,
    })))
    const result = await calculateBootstrapFee(1, 10000)
    // 5% of 10000 = 500
    expect(result.bootstrapFeeCents).toBe(500)
  })

  it('saves bootstrapStartedAt when graduating', async () => {
    const payload = makePayload(makeTenant({
      tier: 'free',
      freeTransactionsUsed: 50,
      freeTransactionLimit: 50,
      freeGmvCents: 0,
      freeGmvLimitCents: 500000,
    }))
    mockGetPayload.mockResolvedValue(payload)
    await calculateBootstrapFee(1, 1000)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bootstrapFees: expect.objectContaining({
            tier: 'bootstrap',
            bootstrapStartedAt: expect.any(String),
          }),
        }),
      }),
    )
  })
})

describe('calculateBootstrapFee — bootstrap tier', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('applies 5% fee during bootstrap tier', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'bootstrap',
      bootstrapFeePercent: 5,
      totalFeesCollectedCents: 1000,
    })))
    const result = await calculateBootstrapFee(1, 10000)
    expect(result.tier).toBe('bootstrap')
    expect(result.bootstrapFeeCents).toBe(500) // 5% of 10000
    expect(result.tierChanged).toBe(false)
  })

  it('accumulates total refund liability', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'bootstrap',
      bootstrapFeePercent: 5,
      totalFeesCollectedCents: 2000,
    })))
    const result = await calculateBootstrapFee(1, 10000)
    // 2000 existing + 500 new = 2500
    expect(result.totalRefundLiabilityCents).toBe(2500)
  })

  it('calls payload.update with the new total', async () => {
    const payload = makePayload(makeTenant({
      tier: 'bootstrap',
      bootstrapFeePercent: 5,
      totalFeesCollectedCents: 0,
    }))
    mockGetPayload.mockResolvedValue(payload)
    await calculateBootstrapFee(1, 2000)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bootstrapFees: expect.objectContaining({
            totalFeesCollectedCents: 100, // 5% of 2000
          }),
        }),
      }),
    )
  })
})

// ── getBootstrapFeeStatus ──────────────────────────────────────────────────

describe('getBootstrapFeeStatus', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns free tier status with defaults when bootstrapFees is empty', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({})))
    const status = await getBootstrapFeeStatus(1)
    expect(status.tier).toBe('free')
    expect(status.freeTransactionLimit).toBe(50)
    expect(status.bootstrapFeePercent).toBe(5)
    expect(status.refundPromised).toBe(true)
    expect(status.refundStatus).toBe('accruing')
  })

  it('reflects actual stored values', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      tier: 'bootstrap',
      freeTransactionsUsed: 50,
      totalFeesCollectedCents: 3500,
      refundStatus: 'accruing',
    })))
    const status = await getBootstrapFeeStatus(1)
    expect(status.tier).toBe('bootstrap')
    expect(status.freeTransactionsUsed).toBe(50)
    expect(status.totalFeesCollectedCents).toBe(3500)
  })

  it('calculates freeTransactionsRemaining correctly', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      freeTransactionsUsed: 30,
      freeTransactionLimit: 50,
    })))
    const status = await getBootstrapFeeStatus(1)
    expect(status.freeTransactionsRemaining).toBe(20)
  })

  it('freeTransactionsRemaining is never negative', async () => {
    mockGetPayload.mockResolvedValue(makePayload(makeTenant({
      freeTransactionsUsed: 100,
      freeTransactionLimit: 50,
    })))
    const status = await getBootstrapFeeStatus(1)
    expect(status.freeTransactionsRemaining).toBe(0)
  })
})

// ── graduateToStandard ─────────────────────────────────────────────────────

describe('graduateToStandard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates tenant to standard tier', async () => {
    const payload = makePayload(makeTenant({ tier: 'bootstrap', totalFeesCollectedCents: 5000 }))
    mockGetPayload.mockResolvedValue(payload)
    await graduateToStandard(1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bootstrapFees: expect.objectContaining({
            tier: 'standard',
            refundStatus: 'processing',
          }),
        }),
      }),
    )
  })

  it('sets bootstrapEndedAt timestamp', async () => {
    const payload = makePayload(makeTenant({ tier: 'bootstrap' }))
    mockGetPayload.mockResolvedValue(payload)
    await graduateToStandard(1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bootstrapFees: expect.objectContaining({
            bootstrapEndedAt: expect.any(String),
          }),
        }),
      }),
    )
  })
})

// ── getTotalBootstrapLiability ─────────────────────────────────────────────

describe('getTotalBootstrapLiability', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns zeros when no tenants', async () => {
    const payload = {
      findByID: vi.fn(),
      update: vi.fn(),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    } as any
    mockGetPayload.mockResolvedValue(payload)
    const result = await getTotalBootstrapLiability()
    expect(result.totalLiabilityCents).toBe(0)
    expect(result.tenantsInBootstrap).toBe(0)
    expect(result.tenantsInFree).toBe(0)
    expect(result.tenantsGraduated).toBe(0)
  })

  it('aggregates bootstrap fee liability across tenants', async () => {
    const payload = {
      findByID: vi.fn(),
      update: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [
          { bootstrapFees: { tier: 'free' } },
          { bootstrapFees: { tier: 'bootstrap', totalFeesCollectedCents: 1000 } },
          { bootstrapFees: { tier: 'bootstrap', totalFeesCollectedCents: 2500 } },
          { bootstrapFees: { tier: 'standard', totalFeesCollectedCents: 500, refundStatus: 'accruing' } },
        ],
      }),
    } as any
    mockGetPayload.mockResolvedValue(payload)
    const result = await getTotalBootstrapLiability()
    expect(result.tenantsInFree).toBe(1)
    expect(result.tenantsInBootstrap).toBe(2)
    expect(result.tenantsGraduated).toBe(1)
    // 1000 + 2500 (bootstrap) + 500 (graduated, accruing) = 4000
    expect(result.totalLiabilityCents).toBe(4000)
  })

  it('excludes graduated tenants with completed refund status from liability', async () => {
    const payload = {
      findByID: vi.fn(),
      update: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [
          { bootstrapFees: { tier: 'standard', totalFeesCollectedCents: 3000, refundStatus: 'completed' } },
        ],
      }),
    } as any
    mockGetPayload.mockResolvedValue(payload)
    const result = await getTotalBootstrapLiability()
    // Refund completed — should not count in liability
    expect(result.totalLiabilityCents).toBe(0)
  })
})
