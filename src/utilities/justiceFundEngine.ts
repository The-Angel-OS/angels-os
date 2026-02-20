/**
 * Justice Fund Engine — Sprint 5
 *
 * Pure utility for managing the Justice Fund allocation pipeline.
 * Connects the 5% Justice Fund collection (from UltimateFairSplitter)
 * to Guardian Angel monthly allocations and disbursements.
 *
 * The fund operates on a sustainability-first model:
 * - New guardians require 6 months of runway
 * - Disbursements are monthly, never lump-sum
 * - Crisis allocations can temporarily exceed monthly budget
 * - The fund never promises what it can't deliver
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/utilities/guardianAngelEngine.ts — guardian angel types & helpers
 * @see src/utilities/ultimateFairSplit.ts — 5% collection source
 * @see tests/unit/utilities/justiceFundEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FundTransaction {
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

export interface MonthlyReport {
  period: string // YYYY-MM
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

export interface AllocationPlan {
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

export interface DisbursementResult {
  guardianId: number
  amount: number
  success: boolean
  error?: string
  transactionId: string
}

export interface FundProjection {
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

/** Maximum crisis allocation multiplier (3x normal monthly budget). */
export const CRISIS_MULTIPLIER = 3

/** Minimum reserve ratio (keep at least 20% of collections as reserve). */
export const MIN_RESERVE_RATIO = 0.2

/** Warning threshold — alert when runway drops below this. */
export const RUNWAY_WARNING_MONTHS = 6

/** Critical threshold — halt new allocations below this. */
export const RUNWAY_CRITICAL_MONTHS = 3

// ---------------------------------------------------------------------------
// Fund Balance Operations
// ---------------------------------------------------------------------------

/** Record a collection from a transaction's 5% Justice Fund share. */
export function recordCollection(
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

/** Record a monthly disbursement to a Guardian Angel. */
export function recordDisbursement(
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

/** Record a crisis allocation (temporary budget increase). */
export function recordCrisisAllocation(
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

// ---------------------------------------------------------------------------
// Allocation Planning
// ---------------------------------------------------------------------------

/** Generate a monthly allocation plan for all active guardians. */
export function generateAllocationPlan(
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

/** Validate a crisis allocation request. */
export function validateCrisisAllocation(
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

// ---------------------------------------------------------------------------
// Fund Projections
// ---------------------------------------------------------------------------

/** Project fund balance over N months based on current trends. */
export function projectFundBalance(
  currentBalance: number,
  monthlyCollectionRate: number,
  monthlyBurn: number,
  months: number = 12,
  startPeriod: string = '2026-03',
): FundProjection {
  const projections: FundProjection['months'] = []
  let balance = currentBalance
  let monthsUntilCritical = Infinity

  // Parse start period
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

  // Calculate how many new guardians the fund can sustain
  const netMonthly = monthlyCollectionRate - monthlyBurn
  const sustainableNewGuardians = netMonthly > 0
    ? Math.floor(netMonthly / 83.33) // DEFAULT_MONTHLY_BUDGET
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

// ---------------------------------------------------------------------------
// Monthly Report Generation
// ---------------------------------------------------------------------------

/** Generate a monthly report from transactions. */
export function generateMonthlyReport(
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

// ---------------------------------------------------------------------------
// Reserve Management
// ---------------------------------------------------------------------------

/** Calculate the minimum reserve amount. */
export function calculateMinReserve(
  totalCollected: number,
): number {
  return Math.round(totalCollected * MIN_RESERVE_RATIO * 100) / 100
}

/** Check if a disbursement would violate the reserve requirement. */
export function wouldViolateReserve(
  currentBalance: number,
  disbursementAmount: number,
  totalCollected: number,
): boolean {
  const afterDisbursement = currentBalance - disbursementAmount
  const minReserve = calculateMinReserve(totalCollected)
  return afterDisbursement < minReserve
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format an allocation plan for LEO responses. */
export function serializeAllocationPlan(plan: AllocationPlan): string {
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

/** Format a monthly report for LEO responses. */
export function serializeMonthlyReport(report: MonthlyReport): string {
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
