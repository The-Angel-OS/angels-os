/**
 * Justice Fund Engine — Edge-Case Tests (Sprint 36 D2)
 *
 * Adversarial and boundary tests for reserve management, crisis allocations,
 * floating-point rounding, period boundaries, and projection edge cases.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/justiceFundEngine.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FundTransaction {
  id: string
  type: 'collection' | 'allocation' | 'disbursement' | 'crisis_allocation' | 'refund'
  amount: number
  currency: string
  timestamp: string
  sourceOrderId?: string
  guardianId?: number
  description: string
  balanceAfter: number
}

interface MonthlyReport {
  period: string
  openingBalance: number
  totalCollected: number
  totalDisbursed: number
  crisisAllocations: number
  closingBalance: number
  activeGuardians: number
  newGuardians: number
  graduatedGuardians: number
  runwayMonths: number
  transactions: FundTransaction[]
}

interface AllocationPlan {
  period: string
  guardianAllocations: {
    guardianId: number
    beneficiaryName: string
    cohort: string
    amount: number
    isActive: boolean
  }[]
  totalPlanned: number
  availableBalance: number
  shortfall: number
  canFulfill: boolean
}

interface FundProjection {
  months: {
    period: string
    projectedBalance: number
    projectedBurn: number
    projectedCollections: number
  }[]
  sustainableNewGuardians: number
  monthsUntilCritical: number
  recommendation: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRISIS_MULTIPLIER = 3
const MIN_RESERVE_RATIO = 0.2
const RUNWAY_WARNING_MONTHS = 6
const RUNWAY_CRITICAL_MONTHS = 3

// ---------------------------------------------------------------------------
// Pure function re-implementations
// ---------------------------------------------------------------------------

function recordCollection(
  currentBalance: number, amount: number, orderId: string, timestamp: string,
): FundTransaction {
  const balanceAfter = Math.round((currentBalance + amount) * 100) / 100
  return {
    id: `txn_col_${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}`,
    type: 'collection', amount, currency: 'usd', timestamp, sourceOrderId: orderId,
    description: `Justice Fund collection from order ${orderId}`, balanceAfter,
  }
}

function recordDisbursement(
  currentBalance: number, amount: number, guardianId: number, period: string, timestamp: string,
): FundTransaction {
  const balanceAfter = Math.round((currentBalance - amount) * 100) / 100
  return {
    id: `txn_dis_${guardianId}_${period}`, type: 'disbursement', amount, currency: 'usd',
    timestamp, guardianId,
    description: `Monthly allocation for Guardian #${guardianId}, period ${period}`, balanceAfter,
  }
}

function recordCrisisAllocation(
  currentBalance: number, amount: number, guardianId: number, reason: string, timestamp: string,
): FundTransaction {
  const balanceAfter = Math.round((currentBalance - amount) * 100) / 100
  return {
    id: `txn_crisis_${guardianId}_${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}`,
    type: 'crisis_allocation', amount, currency: 'usd', timestamp, guardianId,
    description: `Crisis allocation for Guardian #${guardianId}: ${reason}`, balanceAfter,
  }
}

function validateCrisisAllocation(
  normalBudget: number, requestedAmount: number, availableBalance: number,
): { valid: boolean; reason?: string } {
  const maxCrisis = normalBudget * CRISIS_MULTIPLIER
  if (requestedAmount <= 0) return { valid: false, reason: 'Amount must be positive.' }
  if (requestedAmount > maxCrisis) {
    return {
      valid: false,
      reason: `Crisis allocation cannot exceed ${CRISIS_MULTIPLIER}x normal budget ($${maxCrisis.toFixed(2)}).`,
    }
  }
  if (requestedAmount > availableBalance) {
    return {
      valid: false,
      reason: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, requested: $${requestedAmount.toFixed(2)}.`,
    }
  }
  return { valid: true }
}

function generateAllocationPlan(
  period: string,
  guardians: { guardianId: number; beneficiaryName: string; cohort: string; monthlyBudget: number; status: string }[],
  availableBalance: number,
): AllocationPlan {
  const activeGuardians = guardians.filter((g) => g.status === 'active')
  const allocations = activeGuardians.map((g) => ({
    guardianId: g.guardianId, beneficiaryName: g.beneficiaryName, cohort: g.cohort,
    amount: g.monthlyBudget, isActive: true,
  }))
  const totalPlanned = allocations.reduce((sum, a) => sum + a.amount, 0)
  const shortfall = totalPlanned > availableBalance ? totalPlanned - availableBalance : 0
  return { period, guardianAllocations: allocations, totalPlanned, availableBalance, shortfall, canFulfill: shortfall === 0 }
}

function projectFundBalance(
  currentBalance: number, monthlyCollectionRate: number, monthlyBurn: number,
  months: number = 12, startPeriod: string = '2026-03',
): FundProjection {
  const projections: FundProjection['months'] = []
  let balance = currentBalance
  let monthsUntilCritical = Infinity
  const [startYear, startMonth] = startPeriod.split('-').map(Number)

  for (let i = 0; i < months; i++) {
    const year = startYear + Math.floor((startMonth - 1 + i) / 12)
    const month = ((startMonth - 1 + i) % 12) + 1
    const period = `${year}-${String(month).padStart(2, '0')}`
    balance = Math.round((balance + monthlyCollectionRate - monthlyBurn) * 100) / 100
    projections.push({ period, projectedBalance: balance, projectedBurn: monthlyBurn, projectedCollections: monthlyCollectionRate })
    if (balance <= 0 && monthsUntilCritical === Infinity) monthsUntilCritical = i + 1
  }

  const netMonthly = monthlyCollectionRate - monthlyBurn
  const sustainableNewGuardians = netMonthly > 0 ? Math.floor(netMonthly / 83.33) : 0

  let recommendation: string
  if (monthsUntilCritical <= RUNWAY_CRITICAL_MONTHS) {
    recommendation = 'CRITICAL: Fund will be depleted within 3 months. Halt new guardian assignments. Consider reducing allocations.'
  } else if (monthsUntilCritical <= RUNWAY_WARNING_MONTHS) {
    recommendation = 'WARNING: Fund runway is below 6 months. Do not add new guardians until collections increase.'
  } else if (sustainableNewGuardians > 0) {
    recommendation = `HEALTHY: Fund can sustainably support ${sustainableNewGuardians} additional guardian(s) per month.`
  } else {
    recommendation = 'STABLE: Fund is sustaining current guardians but cannot add new ones without increased collections.'
  }

  return { months: projections, sustainableNewGuardians, monthsUntilCritical, recommendation }
}

function generateMonthlyReport(
  period: string, transactions: FundTransaction[], activeGuardians: number,
  newGuardians: number, graduatedGuardians: number, openingBalance: number,
): MonthlyReport {
  const periodTransactions = transactions.filter((t) => t.timestamp.startsWith(period))
  const totalCollected = periodTransactions.filter((t) => t.type === 'collection').reduce((sum, t) => sum + t.amount, 0)
  const totalDisbursed = periodTransactions.filter((t) => t.type === 'disbursement').reduce((sum, t) => sum + t.amount, 0)
  const crisisAllocations = periodTransactions.filter((t) => t.type === 'crisis_allocation').reduce((sum, t) => sum + t.amount, 0)
  const closingBalance = Math.round((openingBalance + totalCollected - totalDisbursed - crisisAllocations) * 100) / 100
  const monthlyBurn = totalDisbursed + crisisAllocations
  const runwayMonths = monthlyBurn > 0 ? closingBalance / monthlyBurn : Infinity
  return {
    period, openingBalance, totalCollected, totalDisbursed, crisisAllocations,
    closingBalance, activeGuardians, newGuardians, graduatedGuardians, runwayMonths,
    transactions: periodTransactions,
  }
}

function calculateMinReserve(totalCollected: number): number {
  return Math.round(totalCollected * MIN_RESERVE_RATIO * 100) / 100
}

function wouldViolateReserve(
  currentBalance: number, disbursementAmount: number, totalCollected: number,
): boolean {
  const afterDisbursement = currentBalance - disbursementAmount
  const minReserve = calculateMinReserve(totalCollected)
  return afterDisbursement < minReserve
}

// ---------------------------------------------------------------------------
// Edge-Case Tests
// ---------------------------------------------------------------------------

describe('Justice Fund Engine — Edge Cases', () => {
  // =========================================================================
  // 1. Crisis Allocation at Exact 3x Boundary
  // =========================================================================
  describe('crisis allocation at exact 3x boundary', () => {
    it('allows crisis allocation at exactly 3x normal budget', () => {
      const result = validateCrisisAllocation(100, 300, 500)
      expect(result.valid).toBe(true)
    })

    it('rejects at 3x + $0.01 (exceeds multiplier)', () => {
      const result = validateCrisisAllocation(100, 300.01, 500)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('exceed')
    })

    it('rejects when at 3x but balance insufficient', () => {
      // 3x is valid ($300) but balance is only $250
      const result = validateCrisisAllocation(100, 300, 250)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Insufficient balance')
    })

    it('rejects zero amount', () => {
      const result = validateCrisisAllocation(100, 0, 500)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('positive')
    })

    it('rejects negative amount', () => {
      const result = validateCrisisAllocation(100, -50, 500)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('positive')
    })
  })

  // =========================================================================
  // 2. Reserve Violation at Exact Threshold
  // =========================================================================
  describe('reserve violation at exact threshold', () => {
    it('does NOT violate when balance after disbursement equals minReserve', () => {
      // totalCollected=1000, minReserve=200, balance=300, disbursement=100
      // afterDisbursement = 200, minReserve = 200 → 200 < 200 is false
      const result = wouldViolateReserve(300, 100, 1000)
      expect(result).toBe(false)
    })

    it('DOES violate when balance after is one cent below minReserve', () => {
      // afterDisbursement = 199.99, minReserve = 200
      const result = wouldViolateReserve(300, 100.01, 1000)
      expect(result).toBe(true)
    })

    it('calculates minReserve correctly with rounding', () => {
      // 333.33 * 0.2 = 66.666 → rounds to 66.67
      expect(calculateMinReserve(333.33)).toBe(66.67)
    })

    it('handles zero totalCollected', () => {
      // minReserve = 0, any positive balance is fine
      expect(wouldViolateReserve(100, 50, 0)).toBe(false)
    })
  })

  // =========================================================================
  // 3. Floating-Point Accumulation in Projections
  // =========================================================================
  describe('floating-point accumulation in projections', () => {
    it('maintains cent-level accuracy over 36-month projection', () => {
      const projection = projectFundBalance(10000, 83.33, 83.33, 36, '2026-01')
      // Net = 0 each month, so balance should remain exactly $10,000
      for (const month of projection.months) {
        expect(month.projectedBalance).toBe(10000)
      }
    })

    it('rounding does not accumulate errors with fractional rates', () => {
      // $100/month collection, $33.33/month burn → net +$66.67
      const projection = projectFundBalance(0, 100, 33.33, 12, '2026-01')
      const lastMonth = projection.months[11]
      // Expected: 12 * 66.67 = 800.04
      expect(lastMonth.projectedBalance).toBeCloseTo(800.04, 2)
    })
  })

  // =========================================================================
  // 4. Period Year Rollover in Projections
  // =========================================================================
  describe('projection year rollover', () => {
    it('correctly rolls from December to January', () => {
      const projection = projectFundBalance(1000, 100, 50, 5, '2026-10')
      const periods = projection.months.map((m) => m.period)
      expect(periods).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'])
    })

    it('handles start at December specifically', () => {
      const projection = projectFundBalance(500, 50, 10, 3, '2026-12')
      const periods = projection.months.map((m) => m.period)
      expect(periods).toEqual(['2026-12', '2027-01', '2027-02'])
    })

    it('handles single-month projection', () => {
      const projection = projectFundBalance(1000, 100, 50, 1, '2026-06')
      expect(projection.months).toHaveLength(1)
      expect(projection.months[0].period).toBe('2026-06')
      expect(projection.months[0].projectedBalance).toBe(1050)
    })
  })

  // =========================================================================
  // 5. Empty and Zero-Balance Allocation Plan
  // =========================================================================
  describe('allocation plan edge cases', () => {
    it('empty plan with zero guardians and zero balance', () => {
      const plan = generateAllocationPlan('2026-03', [], 0)
      expect(plan.canFulfill).toBe(true)
      expect(plan.shortfall).toBe(0)
      expect(plan.totalPlanned).toBe(0)
      expect(plan.guardianAllocations).toHaveLength(0)
    })

    it('filters out non-active guardians', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'A', cohort: 'unhoused', monthlyBudget: 83.33, status: 'suspended' },
        { guardianId: 2, beneficiaryName: 'B', cohort: 'refugee', monthlyBudget: 83.33, status: 'graduated' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 500)
      expect(plan.guardianAllocations).toHaveLength(0)
      expect(plan.totalPlanned).toBe(0)
      expect(plan.canFulfill).toBe(true)
    })
  })

  // =========================================================================
  // 6. Monthly Report — Zero-Balance Runway
  // =========================================================================
  describe('monthly report with zero closing balance', () => {
    it('reports finite runway when closing balance is exactly zero', () => {
      const transactions: FundTransaction[] = [
        { id: 'txn_1', type: 'disbursement', amount: 100, currency: 'usd', timestamp: '2026-03-01T00:00:00Z', guardianId: 1, description: 'Test', balanceAfter: 0 },
      ]
      const report = generateMonthlyReport('2026-03', transactions, 1, 0, 0, 100)
      expect(report.closingBalance).toBe(0)
      // runway = 0 / 100 = 0
      expect(report.runwayMonths).toBe(0)
    })

    it('reports Infinity runway when no disbursements', () => {
      const transactions: FundTransaction[] = [
        { id: 'txn_1', type: 'collection', amount: 50, currency: 'usd', timestamp: '2026-03-01T00:00:00Z', sourceOrderId: 'o1', description: 'Test', balanceAfter: 1050 },
      ]
      const report = generateMonthlyReport('2026-03', transactions, 1, 0, 0, 1000)
      expect(report.runwayMonths).toBe(Infinity)
    })
  })

  // =========================================================================
  // 7. Transaction Period Filtering at Boundaries
  // =========================================================================
  describe('period filtering at boundaries', () => {
    it('includes Feb 28 transactions for period "2026-02"', () => {
      const transactions: FundTransaction[] = [
        { id: 'txn_1', type: 'collection', amount: 50, currency: 'usd', timestamp: '2026-02-28T23:59:59Z', description: 'Late Feb', balanceAfter: 50 },
        { id: 'txn_2', type: 'collection', amount: 30, currency: 'usd', timestamp: '2026-03-01T00:00:00Z', description: 'Early Mar', balanceAfter: 80 },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 0, 0, 0, 0)
      expect(report.totalCollected).toBe(50) // Only Feb transaction
      expect(report.transactions).toHaveLength(1)
    })

    it('excludes transactions from other periods', () => {
      const transactions: FundTransaction[] = [
        { id: 'txn_1', type: 'collection', amount: 100, currency: 'usd', timestamp: '2026-01-15T00:00:00Z', description: 'Jan', balanceAfter: 100 },
        { id: 'txn_2', type: 'collection', amount: 200, currency: 'usd', timestamp: '2026-02-15T00:00:00Z', description: 'Feb', balanceAfter: 200 },
        { id: 'txn_3', type: 'collection', amount: 300, currency: 'usd', timestamp: '2026-03-15T00:00:00Z', description: 'Mar', balanceAfter: 300 },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 0, 0, 0, 0)
      expect(report.totalCollected).toBe(200)
    })
  })

  // =========================================================================
  // 8. Negative Balance Disbursements (Adversarial)
  // =========================================================================
  describe('negative balance from disbursements', () => {
    it('disbursement from zero balance produces negative balanceAfter', () => {
      const txn = recordDisbursement(0, 100, 1, '2026-03', '2026-03-01T00:00:00Z')
      expect(txn.balanceAfter).toBe(-100)
    })

    it('collection on negative balance restores toward positive', () => {
      const txn = recordCollection(-500, 200, 'order_1', '2026-03-01T00:00:00Z')
      expect(txn.balanceAfter).toBe(-300)
    })

    it('crisis allocation can push balance deeply negative', () => {
      const txn = recordCrisisAllocation(10, 250, 1, 'Emergency', '2026-03-01T00:00:00Z')
      expect(txn.balanceAfter).toBe(-240)
    })
  })
})
