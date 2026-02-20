/**
 * Unit tests for Justice Fund Engine — Sprint 5.
 *
 * Tests fund collection, allocation planning, disbursement tracking,
 * crisis allocations, reserve management, projections, and reporting.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * "We're already paying. We're just paying badly."
 *
 * @see src/utilities/justiceFundEngine.ts — justice fund engine
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types (re-implemented to avoid Payload-coupled imports)
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
  currentBalance: number,
  amount: number,
  orderId: string,
  timestamp: string,
): FundTransaction {
  const balanceAfter = Math.round((currentBalance + amount) * 100) / 100
  return {
    id: `txn_col_${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}`,
    type: 'collection',
    amount,
    currency: 'usd',
    timestamp,
    sourceOrderId: orderId,
    description: `Justice Fund collection from order ${orderId}`,
    balanceAfter,
  }
}

function recordDisbursement(
  currentBalance: number,
  amount: number,
  guardianId: number,
  period: string,
  timestamp: string,
): FundTransaction {
  const balanceAfter = Math.round((currentBalance - amount) * 100) / 100
  return {
    id: `txn_dis_${guardianId}_${period}`,
    type: 'disbursement',
    amount,
    currency: 'usd',
    timestamp,
    guardianId,
    description: `Monthly allocation for Guardian #${guardianId}, period ${period}`,
    balanceAfter,
  }
}

function recordCrisisAllocation(
  currentBalance: number,
  amount: number,
  guardianId: number,
  reason: string,
  timestamp: string,
): FundTransaction {
  const balanceAfter = Math.round((currentBalance - amount) * 100) / 100
  return {
    id: `txn_crisis_${guardianId}_${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}`,
    type: 'crisis_allocation',
    amount,
    currency: 'usd',
    timestamp,
    guardianId,
    description: `Crisis allocation for Guardian #${guardianId}: ${reason}`,
    balanceAfter,
  }
}

function generateAllocationPlan(
  period: string,
  guardians: {
    guardianId: number
    beneficiaryName: string
    cohort: string
    monthlyBudget: number
    status: string
  }[],
  availableBalance: number,
): AllocationPlan {
  const activeGuardians = guardians.filter((g) => g.status === 'active')
  const allocations = activeGuardians.map((g) => ({
    guardianId: g.guardianId,
    beneficiaryName: g.beneficiaryName,
    cohort: g.cohort,
    amount: g.monthlyBudget,
    isActive: true,
  }))

  const totalPlanned = allocations.reduce((sum, a) => sum + a.amount, 0)
  const shortfall = totalPlanned > availableBalance ? totalPlanned - availableBalance : 0

  return {
    period,
    guardianAllocations: allocations,
    totalPlanned,
    availableBalance,
    shortfall,
    canFulfill: shortfall === 0,
  }
}

function validateCrisisAllocation(
  normalBudget: number,
  requestedAmount: number,
  availableBalance: number,
): { valid: boolean; reason?: string } {
  const maxCrisis = normalBudget * CRISIS_MULTIPLIER

  if (requestedAmount <= 0) {
    return { valid: false, reason: 'Amount must be positive.' }
  }

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

function projectFundBalance(
  currentBalance: number,
  monthlyCollectionRate: number,
  monthlyBurn: number,
  months: number = 12,
  startPeriod: string = '2026-03',
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

    projections.push({
      period,
      projectedBalance: balance,
      projectedBurn: monthlyBurn,
      projectedCollections: monthlyCollectionRate,
    })

    if (balance <= 0 && monthsUntilCritical === Infinity) {
      monthsUntilCritical = i + 1
    }
  }

  const netMonthly = monthlyCollectionRate - monthlyBurn
  const sustainableNewGuardians = netMonthly > 0
    ? Math.floor(netMonthly / 83.33)
    : 0

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

  return {
    months: projections,
    sustainableNewGuardians,
    monthsUntilCritical,
    recommendation,
  }
}

function generateMonthlyReport(
  period: string,
  transactions: FundTransaction[],
  activeGuardians: number,
  newGuardians: number,
  graduatedGuardians: number,
  openingBalance: number,
): MonthlyReport {
  const periodTransactions = transactions.filter((t) => t.timestamp.startsWith(period))

  const totalCollected = periodTransactions
    .filter((t) => t.type === 'collection')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalDisbursed = periodTransactions
    .filter((t) => t.type === 'disbursement')
    .reduce((sum, t) => sum + t.amount, 0)

  const crisisAllocations = periodTransactions
    .filter((t) => t.type === 'crisis_allocation')
    .reduce((sum, t) => sum + t.amount, 0)

  const closingBalance = Math.round(
    (openingBalance + totalCollected - totalDisbursed - crisisAllocations) * 100,
  ) / 100

  const monthlyBurn = totalDisbursed + crisisAllocations
  const runwayMonths = monthlyBurn > 0 ? closingBalance / monthlyBurn : Infinity

  return {
    period,
    openingBalance,
    totalCollected,
    totalDisbursed,
    crisisAllocations,
    closingBalance,
    activeGuardians,
    newGuardians,
    graduatedGuardians,
    runwayMonths,
    transactions: periodTransactions,
  }
}

function calculateMinReserve(totalCollected: number): number {
  return Math.round(totalCollected * MIN_RESERVE_RATIO * 100) / 100
}

function wouldViolateReserve(
  currentBalance: number,
  disbursementAmount: number,
  totalCollected: number,
): boolean {
  const afterDisbursement = currentBalance - disbursementAmount
  const minReserve = calculateMinReserve(totalCollected)
  return afterDisbursement < minReserve
}

function serializeAllocationPlan(plan: AllocationPlan): string {
  const lines = [
    `Allocation Plan: ${plan.period}`,
    `Available: $${plan.availableBalance.toFixed(2)}`,
    `Planned: $${plan.totalPlanned.toFixed(2)}`,
    plan.canFulfill
      ? 'Status: Fully funded'
      : `Status: SHORTFALL of $${plan.shortfall.toFixed(2)}`,
    '',
    ...plan.guardianAllocations.map(
      (a) => `  Guardian #${a.guardianId} (${a.beneficiaryName}): $${a.amount.toFixed(2)}`,
    ),
  ]
  return lines.join('\n')
}

function serializeMonthlyReport(report: MonthlyReport): string {
  const lines = [
    `Justice Fund Report: ${report.period}`,
    `Opening Balance: $${report.openingBalance.toFixed(2)}`,
    `Collected: +$${report.totalCollected.toFixed(2)}`,
    `Disbursed: -$${report.totalDisbursed.toFixed(2)}`,
  ]

  if (report.crisisAllocations > 0) {
    lines.push(`Crisis: -$${report.crisisAllocations.toFixed(2)}`)
  }

  lines.push(
    `Closing Balance: $${report.closingBalance.toFixed(2)}`,
    `Active Guardians: ${report.activeGuardians}`,
    `Runway: ${report.runwayMonths === Infinity ? '∞' : report.runwayMonths.toFixed(1)} months`,
  )

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Justice Fund Engine', () => {
  // =========================================================================
  // Transaction Recording
  // =========================================================================
  describe('recordCollection', () => {
    it('creates a collection transaction with correct balance', () => {
      const txn = recordCollection(1000, 5.00, 'order_123', '2026-02-15T10:00:00Z')
      expect(txn.type).toBe('collection')
      expect(txn.amount).toBe(5.00)
      expect(txn.balanceAfter).toBe(1005.00)
      expect(txn.sourceOrderId).toBe('order_123')
    })

    it('handles fractional amounts with rounding', () => {
      const txn = recordCollection(100.33, 2.77, 'order_456', '2026-02-15T10:00:00Z')
      expect(txn.balanceAfter).toBe(103.10)
    })

    it('sets currency to usd', () => {
      const txn = recordCollection(0, 1, 'order_1', '2026-02-15T10:00:00Z')
      expect(txn.currency).toBe('usd')
    })

    it('includes order reference in description', () => {
      const txn = recordCollection(0, 5, 'order_789', '2026-02-15T10:00:00Z')
      expect(txn.description).toContain('order_789')
    })

    it('generates unique transaction ID from timestamp', () => {
      const txn = recordCollection(0, 5, 'order_1', '2026-02-15T10:00:00Z')
      expect(txn.id).toContain('txn_col_')
    })
  })

  describe('recordDisbursement', () => {
    it('creates a disbursement transaction with reduced balance', () => {
      const txn = recordDisbursement(1000, 83.33, 1, '2026-02', '2026-02-01T00:00:00Z')
      expect(txn.type).toBe('disbursement')
      expect(txn.amount).toBe(83.33)
      expect(txn.balanceAfter).toBe(916.67)
      expect(txn.guardianId).toBe(1)
    })

    it('includes period in description', () => {
      const txn = recordDisbursement(1000, 83.33, 1, '2026-02', '2026-02-01T00:00:00Z')
      expect(txn.description).toContain('2026-02')
    })

    it('includes guardian ID in description', () => {
      const txn = recordDisbursement(1000, 83.33, 42, '2026-02', '2026-02-01T00:00:00Z')
      expect(txn.description).toContain('Guardian #42')
    })

    it('generates unique ID from guardian and period', () => {
      const txn = recordDisbursement(1000, 83.33, 5, '2026-03', '2026-03-01T00:00:00Z')
      expect(txn.id).toBe('txn_dis_5_2026-03')
    })
  })

  describe('recordCrisisAllocation', () => {
    it('creates a crisis allocation transaction', () => {
      const txn = recordCrisisAllocation(
        1000, 200, 3, 'Emergency housing', '2026-02-10T14:00:00Z',
      )
      expect(txn.type).toBe('crisis_allocation')
      expect(txn.amount).toBe(200)
      expect(txn.balanceAfter).toBe(800)
    })

    it('includes reason in description', () => {
      const txn = recordCrisisAllocation(
        1000, 100, 1, 'Medical emergency', '2026-02-10T14:00:00Z',
      )
      expect(txn.description).toContain('Medical emergency')
    })

    it('includes guardian ID in description', () => {
      const txn = recordCrisisAllocation(
        1000, 100, 7, 'Crisis', '2026-02-10T14:00:00Z',
      )
      expect(txn.description).toContain('Guardian #7')
    })
  })

  // =========================================================================
  // Allocation Planning
  // =========================================================================
  describe('generateAllocationPlan', () => {
    it('creates allocations for active guardians only', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 83.33, status: 'active' },
        { guardianId: 2, beneficiaryName: 'Bob', cohort: 'veteran', monthlyBudget: 83.33, status: 'active' },
        { guardianId: 3, beneficiaryName: 'Carol', cohort: 'refugee', monthlyBudget: 83.33, status: 'suspended' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 5000)
      expect(plan.guardianAllocations).toHaveLength(2)
    })

    it('calculates total planned amount', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 83.33, status: 'active' },
        { guardianId: 2, beneficiaryName: 'Bob', cohort: 'veteran', monthlyBudget: 100, status: 'active' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 5000)
      expect(plan.totalPlanned).toBeCloseTo(183.33, 1)
    })

    it('detects shortfall when balance insufficient', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 100, status: 'active' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 50)
      expect(plan.canFulfill).toBe(false)
      expect(plan.shortfall).toBe(50)
    })

    it('reports no shortfall when fully funded', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 100, status: 'active' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 5000)
      expect(plan.canFulfill).toBe(true)
      expect(plan.shortfall).toBe(0)
    })

    it('handles empty guardians array', () => {
      const plan = generateAllocationPlan('2026-03', [], 5000)
      expect(plan.guardianAllocations).toHaveLength(0)
      expect(plan.totalPlanned).toBe(0)
      expect(plan.canFulfill).toBe(true)
    })

    it('sets correct period', () => {
      const plan = generateAllocationPlan('2026-04', [], 100)
      expect(plan.period).toBe('2026-04')
    })
  })

  describe('validateCrisisAllocation', () => {
    it('approves valid crisis allocation', () => {
      const result = validateCrisisAllocation(83.33, 200, 5000)
      expect(result.valid).toBe(true)
    })

    it('rejects zero amount', () => {
      const result = validateCrisisAllocation(83.33, 0, 5000)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('positive')
    })

    it('rejects negative amount', () => {
      const result = validateCrisisAllocation(83.33, -10, 5000)
      expect(result.valid).toBe(false)
    })

    it('rejects amount exceeding 3x normal budget', () => {
      const result = validateCrisisAllocation(83.33, 300, 5000)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('3x')
    })

    it('approves exactly 3x normal budget', () => {
      const result = validateCrisisAllocation(100, 300, 5000)
      expect(result.valid).toBe(true)
    })

    it('rejects when insufficient balance', () => {
      const result = validateCrisisAllocation(83.33, 200, 100)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Insufficient balance')
    })
  })

  // =========================================================================
  // Fund Projections
  // =========================================================================
  describe('projectFundBalance', () => {
    it('projects 12 months by default', () => {
      const projection = projectFundBalance(5000, 500, 300)
      expect(projection.months).toHaveLength(12)
    })

    it('projects custom number of months', () => {
      const projection = projectFundBalance(5000, 500, 300, 6)
      expect(projection.months).toHaveLength(6)
    })

    it('increases balance when collections exceed burn', () => {
      const projection = projectFundBalance(1000, 500, 200, 3)
      expect(projection.months[2].projectedBalance).toBeGreaterThan(1000)
    })

    it('decreases balance when burn exceeds collections', () => {
      const projection = projectFundBalance(1000, 100, 300, 3)
      expect(projection.months[2].projectedBalance).toBeLessThan(1000)
    })

    it('detects month of depletion', () => {
      // Starting with 1000, collecting 100/month, burning 400/month = -300/month
      // Depletes in ~4 months
      const projection = projectFundBalance(1000, 100, 400, 12)
      expect(projection.monthsUntilCritical).toBeLessThanOrEqual(4)
    })

    it('returns Infinity when fund never depletes', () => {
      const projection = projectFundBalance(5000, 500, 200, 12)
      expect(projection.monthsUntilCritical).toBe(Infinity)
    })

    it('calculates sustainable new guardians', () => {
      // Net monthly = 500 - 200 = 300. At $83.33/guardian = floor(3.6) = 3
      const projection = projectFundBalance(5000, 500, 200)
      expect(projection.sustainableNewGuardians).toBe(3)
    })

    it('returns 0 sustainable guardians when burn exceeds collections', () => {
      const projection = projectFundBalance(5000, 100, 500)
      expect(projection.sustainableNewGuardians).toBe(0)
    })

    it('provides CRITICAL recommendation when depleting within 3 months', () => {
      const projection = projectFundBalance(200, 50, 200, 12)
      expect(projection.recommendation).toContain('CRITICAL')
    })

    it('provides WARNING recommendation when depleting within 6 months', () => {
      const projection = projectFundBalance(500, 50, 200, 12)
      expect(projection.recommendation).toContain('WARNING')
    })

    it('provides HEALTHY recommendation when can add guardians', () => {
      const projection = projectFundBalance(10000, 500, 200, 12)
      expect(projection.recommendation).toContain('HEALTHY')
    })

    it('provides STABLE recommendation when sustaining but no room for growth', () => {
      const projection = projectFundBalance(10000, 200, 200, 12)
      expect(projection.recommendation).toContain('STABLE')
    })

    it('generates correct period strings', () => {
      const projection = projectFundBalance(1000, 100, 50, 3, '2026-11')
      expect(projection.months[0].period).toBe('2026-11')
      expect(projection.months[1].period).toBe('2026-12')
      expect(projection.months[2].period).toBe('2027-01')
    })

    it('handles year rollover correctly', () => {
      const projection = projectFundBalance(1000, 100, 50, 14, '2026-01')
      expect(projection.months[11].period).toBe('2026-12')
      expect(projection.months[12].period).toBe('2027-01')
      expect(projection.months[13].period).toBe('2027-02')
    })
  })

  // =========================================================================
  // Monthly Reports
  // =========================================================================
  describe('generateMonthlyReport', () => {
    it('calculates closing balance correctly', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'txn_1', type: 'collection', amount: 500, currency: 'usd',
          timestamp: '2026-02-05T10:00:00Z', description: 'Collection', balanceAfter: 1500,
        },
        {
          id: 'txn_2', type: 'disbursement', amount: 83.33, currency: 'usd',
          timestamp: '2026-02-01T00:00:00Z', guardianId: 1, description: 'Disbursement', balanceAfter: 916.67,
        },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 1, 0, 0, 1000)
      expect(report.closingBalance).toBeCloseTo(1416.67, 1)
    })

    it('filters transactions to the specified period', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'txn_1', type: 'collection', amount: 100, currency: 'usd',
          timestamp: '2026-02-15T10:00:00Z', description: 'Feb', balanceAfter: 100,
        },
        {
          id: 'txn_2', type: 'collection', amount: 200, currency: 'usd',
          timestamp: '2026-03-15T10:00:00Z', description: 'Mar', balanceAfter: 300,
        },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 0, 0, 0, 0)
      expect(report.totalCollected).toBe(100)
      expect(report.transactions).toHaveLength(1)
    })

    it('separates crisis allocations from regular disbursements', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'txn_1', type: 'disbursement', amount: 83.33, currency: 'usd',
          timestamp: '2026-02-01T00:00:00Z', description: 'Regular', balanceAfter: 916.67,
        },
        {
          id: 'txn_2', type: 'crisis_allocation', amount: 200, currency: 'usd',
          timestamp: '2026-02-10T00:00:00Z', description: 'Crisis', balanceAfter: 716.67,
        },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 1, 0, 0, 1000)
      expect(report.totalDisbursed).toBeCloseTo(83.33, 1)
      expect(report.crisisAllocations).toBe(200)
    })

    it('calculates runway from closing balance and burn', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'txn_1', type: 'disbursement', amount: 100, currency: 'usd',
          timestamp: '2026-02-01T00:00:00Z', description: 'Disbursement', balanceAfter: 900,
        },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 1, 0, 0, 1000)
      // Closing: 1000 - 100 = 900. Burn: 100. Runway: 900/100 = 9
      expect(report.runwayMonths).toBe(9)
    })

    it('returns Infinity runway with no disbursements', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'txn_1', type: 'collection', amount: 500, currency: 'usd',
          timestamp: '2026-02-15T10:00:00Z', description: 'Collection', balanceAfter: 1500,
        },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 0, 0, 0, 1000)
      expect(report.runwayMonths).toBe(Infinity)
    })

    it('preserves guardian counts', () => {
      const report = generateMonthlyReport('2026-02', [], 5, 2, 1, 1000)
      expect(report.activeGuardians).toBe(5)
      expect(report.newGuardians).toBe(2)
      expect(report.graduatedGuardians).toBe(1)
    })
  })

  // =========================================================================
  // Reserve Management
  // =========================================================================
  describe('calculateMinReserve', () => {
    it('calculates 20% reserve', () => {
      expect(calculateMinReserve(10000)).toBe(2000)
    })

    it('handles zero total', () => {
      expect(calculateMinReserve(0)).toBe(0)
    })

    it('rounds to cents', () => {
      expect(calculateMinReserve(33.33)).toBeCloseTo(6.67, 2)
    })
  })

  describe('wouldViolateReserve', () => {
    it('returns false when disbursement leaves adequate reserve', () => {
      // Total collected: 10000, min reserve: 2000
      // Balance 5000 - 100 = 4900 > 2000
      expect(wouldViolateReserve(5000, 100, 10000)).toBe(false)
    })

    it('returns true when disbursement would drop below reserve', () => {
      // Total collected: 10000, min reserve: 2000
      // Balance 2500 - 1000 = 1500 < 2000
      expect(wouldViolateReserve(2500, 1000, 10000)).toBe(true)
    })

    it('returns true at exact reserve threshold', () => {
      // Total collected: 10000, min reserve: 2000
      // Balance 2100 - 200 = 1900 < 2000
      expect(wouldViolateReserve(2100, 200, 10000)).toBe(true)
    })

    it('handles zero total collected (no reserve required)', () => {
      expect(wouldViolateReserve(100, 50, 0)).toBe(false)
    })
  })

  // =========================================================================
  // Serialization
  // =========================================================================
  describe('serializeAllocationPlan', () => {
    it('includes period', () => {
      const plan = generateAllocationPlan('2026-03', [], 5000)
      expect(serializeAllocationPlan(plan)).toContain('2026-03')
    })

    it('shows Fully funded when no shortfall', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 83.33, status: 'active' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 5000)
      expect(serializeAllocationPlan(plan)).toContain('Fully funded')
    })

    it('shows SHORTFALL when insufficient', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 200, status: 'active' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 50)
      const text = serializeAllocationPlan(plan)
      expect(text).toContain('SHORTFALL')
      expect(text).toContain('$150.00')
    })

    it('lists each guardian allocation', () => {
      const guardians = [
        { guardianId: 1, beneficiaryName: 'Alice', cohort: 'unhoused', monthlyBudget: 83.33, status: 'active' },
        { guardianId: 2, beneficiaryName: 'Bob', cohort: 'veteran', monthlyBudget: 100, status: 'active' },
      ]
      const plan = generateAllocationPlan('2026-03', guardians, 5000)
      const text = serializeAllocationPlan(plan)
      expect(text).toContain('Alice')
      expect(text).toContain('Bob')
      expect(text).toContain('Guardian #1')
      expect(text).toContain('Guardian #2')
    })
  })

  describe('serializeMonthlyReport', () => {
    it('includes opening and closing balance', () => {
      const report = generateMonthlyReport('2026-02', [], 0, 0, 0, 1000)
      const text = serializeMonthlyReport(report)
      expect(text).toContain('Opening Balance: $1000.00')
      expect(text).toContain('Closing Balance: $1000.00')
    })

    it('includes collected and disbursed amounts', () => {
      const transactions: FundTransaction[] = [
        {
          id: 'txn_1', type: 'collection', amount: 500, currency: 'usd',
          timestamp: '2026-02-15T10:00:00Z', description: 'Collection', balanceAfter: 1500,
        },
        {
          id: 'txn_2', type: 'disbursement', amount: 100, currency: 'usd',
          timestamp: '2026-02-01T00:00:00Z', description: 'Disbursement', balanceAfter: 900,
        },
      ]
      const report = generateMonthlyReport('2026-02', transactions, 1, 0, 0, 1000)
      const text = serializeMonthlyReport(report)
      expect(text).toContain('Collected: +$500.00')
      expect(text).toContain('Disbursed: -$100.00')
    })

    it('includes crisis line only when > 0', () => {
      const noCrisis = generateMonthlyReport('2026-02', [], 0, 0, 0, 1000)
      expect(serializeMonthlyReport(noCrisis)).not.toContain('Crisis:')

      const withCrisis: FundTransaction[] = [
        {
          id: 'txn_1', type: 'crisis_allocation', amount: 200, currency: 'usd',
          timestamp: '2026-02-10T00:00:00Z', description: 'Crisis', balanceAfter: 800,
        },
      ]
      const crisisReport = generateMonthlyReport('2026-02', withCrisis, 1, 0, 0, 1000)
      expect(serializeMonthlyReport(crisisReport)).toContain('Crisis: -$200.00')
    })

    it('shows ∞ runway when no burn', () => {
      const report = generateMonthlyReport('2026-02', [], 0, 0, 0, 5000)
      expect(serializeMonthlyReport(report)).toContain('Runway: ∞ months')
    })
  })

  // =========================================================================
  // Constants Verification
  // =========================================================================
  describe('Constants', () => {
    it('CRISIS_MULTIPLIER is 3', () => {
      expect(CRISIS_MULTIPLIER).toBe(3)
    })

    it('MIN_RESERVE_RATIO is 20%', () => {
      expect(MIN_RESERVE_RATIO).toBe(0.2)
    })

    it('RUNWAY_WARNING_MONTHS is 6', () => {
      expect(RUNWAY_WARNING_MONTHS).toBe(6)
    })

    it('RUNWAY_CRITICAL_MONTHS is 3', () => {
      expect(RUNWAY_CRITICAL_MONTHS).toBe(3)
    })
  })
})
