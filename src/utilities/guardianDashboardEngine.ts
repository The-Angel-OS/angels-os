/**
 * Guardian Dashboard Engine — Sprint 5, Phase 5
 *
 * Pure utility for Guardian Angel dashboard views: service connections,
 * benefits navigation, case management, and impact reporting.
 *
 * Builds on guardianAngelEngine.ts to provide dashboard-specific
 * aggregations and UI-ready data structures.
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/utilities/guardianAngelEngine.ts — core guardian types
 * @see tests/unit/utilities/guardianDashboardEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BeneficiaryCohort =
  | 'incarcerated'
  | 'unhoused'
  | 'refugee'
  | 'elderly_isolated'
  | 'foster_youth'
  | 'disability'
  | 'veteran'
  | 'crisis'

export type ServiceCategory =
  | 'housing'
  | 'food'
  | 'healthcare'
  | 'legal'
  | 'employment'
  | 'education'
  | 'counseling'
  | 'transportation'
  | 'benefits'
  | 'spiritual'

export type ServiceStatus = 'available' | 'enrolled' | 'waitlisted' | 'completed' | 'expired'

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ServiceListing {
  id: string
  name: string
  provider: string
  category: ServiceCategory
  description: string
  eligibilityCriteria: BeneficiaryCohort[]
  availableSlots: number
  waitlistCount: number
  location?: { city?: string; region?: string }
  isRemote: boolean
  url?: string
  phone?: string
  rating: number
  lastVerified: string
}

export interface BenefitConnection {
  serviceId: string
  serviceName: string
  category: ServiceCategory
  status: ServiceStatus
  enrolledAt?: string
  completedAt?: string
  nextAction?: string
  nextActionDate?: string
  notes?: string
}

export interface CaseSnapshot {
  guardianId: string
  guardianName: string
  beneficiaryName: string
  cohort: BeneficiaryCohort
  activeConnections: number
  completedConnections: number
  pendingActions: number
  urgencyLevel: UrgencyLevel
  lastInteraction?: string
  monthlyBudgetUsed: number
  monthlyBudgetTotal: number
}

export interface DashboardSummary {
  totalGuardians: number
  activeGuardians: number
  totalBeneficiaries: number
  totalServiceConnections: number
  activeConnections: number
  completedConnections: number
  criticalCases: number
  highPriorityCases: number
  averageConnectionsPerGuardian: number
  topCategories: { category: ServiceCategory; count: number }[]
  cohortBreakdown: { cohort: BeneficiaryCohort; count: number }[]
}

export interface ActionItem {
  id: string
  guardianId: string
  beneficiaryName: string
  type: 'follow_up' | 'enrollment' | 'renewal' | 'crisis' | 'review'
  description: string
  dueDate: string
  urgency: UrgencyLevel
  serviceCategory?: ServiceCategory
}

export interface ImpactMetric {
  label: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  periodLabel: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Service categories in priority order for benefits navigation. */
export const SERVICE_CATEGORY_PRIORITY: ServiceCategory[] = [
  'housing',
  'food',
  'healthcare',
  'legal',
  'employment',
  'education',
  'counseling',
  'transportation',
  'benefits',
  'spiritual',
]

/** Cohort-specific primary service needs. */
export const COHORT_PRIMARY_NEEDS: Record<BeneficiaryCohort, ServiceCategory[]> = {
  incarcerated: ['legal', 'employment', 'housing', 'counseling'],
  unhoused: ['housing', 'food', 'healthcare', 'benefits'],
  refugee: ['legal', 'housing', 'employment', 'education'],
  elderly_isolated: ['healthcare', 'food', 'transportation', 'spiritual'],
  foster_youth: ['housing', 'education', 'counseling', 'employment'],
  disability: ['healthcare', 'benefits', 'transportation', 'employment'],
  veteran: ['healthcare', 'housing', 'employment', 'counseling'],
  crisis: ['housing', 'food', 'healthcare', 'counseling'],
}

/** Urgency thresholds for case prioritization. */
export const URGENCY_THRESHOLDS = {
  criticalDaysWithoutInteraction: 14,
  highDaysWithoutInteraction: 7,
  mediumDaysWithoutInteraction: 3,
} as const

// ---------------------------------------------------------------------------
// Service Discovery
// ---------------------------------------------------------------------------

/** Find eligible services for a cohort. */
export function findEligibleServices(
  services: ServiceListing[],
  cohort: BeneficiaryCohort,
  filters?: {
    category?: ServiceCategory
    isRemote?: boolean
    region?: string
    minRating?: number
    availableOnly?: boolean
  },
): ServiceListing[] {
  return services.filter((service) => {
    // Must be eligible for cohort
    if (!service.eligibilityCriteria.includes(cohort)) return false

    if (filters?.category && service.category !== filters.category) return false
    if (filters?.isRemote !== undefined && service.isRemote !== filters.isRemote) return false
    if (filters?.region && service.location?.region !== filters.region) return false
    if (filters?.minRating !== undefined && service.rating < filters.minRating) return false
    if (filters?.availableOnly && service.availableSlots <= 0) return false

    return true
  })
}

/** Rank services by relevance to a cohort. */
export function rankServicesForCohort(
  services: ServiceListing[],
  cohort: BeneficiaryCohort,
): ServiceListing[] {
  const primaryNeeds = COHORT_PRIMARY_NEEDS[cohort] || []
  const sorted = [...services]

  sorted.sort((a, b) => {
    // Priority: primary needs first
    const aPriority = primaryNeeds.indexOf(a.category)
    const bPriority = primaryNeeds.indexOf(b.category)
    const aScore = aPriority >= 0 ? aPriority : 100
    const bScore = bPriority >= 0 ? bPriority : 100

    if (aScore !== bScore) return aScore - bScore

    // Then by availability
    if (a.availableSlots > 0 && b.availableSlots <= 0) return -1
    if (b.availableSlots > 0 && a.availableSlots <= 0) return 1

    // Then by rating
    return b.rating - a.rating
  })

  return sorted
}

// ---------------------------------------------------------------------------
// Case Management
// ---------------------------------------------------------------------------

/** Calculate urgency level for a case. */
export function calculateUrgency(
  lastInteraction: string | undefined,
  activeConnections: number,
  hasCrisisFlag: boolean,
  currentDate: Date = new Date(),
): UrgencyLevel {
  if (hasCrisisFlag) return 'critical'

  if (!lastInteraction) return 'high'

  const daysSinceInteraction = Math.floor(
    (currentDate.getTime() - new Date(lastInteraction).getTime()) / (24 * 60 * 60 * 1000),
  )

  if (daysSinceInteraction >= URGENCY_THRESHOLDS.criticalDaysWithoutInteraction) return 'critical'
  if (daysSinceInteraction >= URGENCY_THRESHOLDS.highDaysWithoutInteraction) return 'high'
  if (daysSinceInteraction >= URGENCY_THRESHOLDS.mediumDaysWithoutInteraction) return 'medium'

  // Low connectivity also raises urgency
  if (activeConnections === 0) return 'medium'

  return 'low'
}

/** Sort action items by urgency and due date. */
export function prioritizeActions(actions: ActionItem[]): ActionItem[] {
  const urgencyOrder: Record<UrgencyLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  const sorted = [...actions]
  sorted.sort((a, b) => {
    const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (urgDiff !== 0) return urgDiff
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  return sorted
}

/** Filter actions by type. */
export function filterActionsByType(
  actions: ActionItem[],
  types: ActionItem['type'][],
): ActionItem[] {
  return actions.filter((a) => types.includes(a.type))
}

/** Get overdue actions. */
export function getOverdueActions(
  actions: ActionItem[],
  currentDate: Date = new Date(),
): ActionItem[] {
  return actions.filter((a) => new Date(a.dueDate) < currentDate)
}

// ---------------------------------------------------------------------------
// Dashboard Aggregations
// ---------------------------------------------------------------------------

/** Generate dashboard summary from case snapshots. */
export function generateDashboardSummary(
  snapshots: CaseSnapshot[],
  connections: BenefitConnection[],
): DashboardSummary {
  const activeGuardians = new Set(snapshots.map((s) => s.guardianId)).size
  const totalBeneficiaries = snapshots.length

  const activeConnections = connections.filter(
    (c) => c.status === 'enrolled' || c.status === 'waitlisted',
  ).length
  const completedConnections = connections.filter((c) => c.status === 'completed').length

  const criticalCases = snapshots.filter((s) => s.urgencyLevel === 'critical').length
  const highPriorityCases = snapshots.filter((s) => s.urgencyLevel === 'high').length

  const avgConnections =
    totalBeneficiaries > 0
      ? (activeConnections + completedConnections) / totalBeneficiaries
      : 0

  // Top categories
  const categoryMap = new Map<ServiceCategory, number>()
  for (const conn of connections) {
    categoryMap.set(conn.category, (categoryMap.get(conn.category) || 0) + 1)
  }
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  // Cohort breakdown
  const cohortMap = new Map<BeneficiaryCohort, number>()
  for (const snap of snapshots) {
    cohortMap.set(snap.cohort, (cohortMap.get(snap.cohort) || 0) + 1)
  }
  const cohortBreakdown = Array.from(cohortMap.entries())
    .map(([cohort, count]) => ({ cohort, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalGuardians: activeGuardians,
    activeGuardians,
    totalBeneficiaries,
    totalServiceConnections: connections.length,
    activeConnections,
    completedConnections,
    criticalCases,
    highPriorityCases,
    averageConnectionsPerGuardian: Math.round(avgConnections * 10) / 10,
    topCategories,
    cohortBreakdown,
  }
}

/** Calculate impact metrics for reporting. */
export function calculateImpactMetrics(
  currentSnapshots: CaseSnapshot[],
  previousSnapshots: CaseSnapshot[],
  currentConnections: BenefitConnection[],
  previousConnections: BenefitConnection[],
  periodLabel: string = 'this month',
): ImpactMetric[] {
  const currentActive = currentConnections.filter(
    (c) => c.status === 'enrolled' || c.status === 'waitlisted',
  ).length
  const previousActive = previousConnections.filter(
    (c) => c.status === 'enrolled' || c.status === 'waitlisted',
  ).length

  const currentCompleted = currentConnections.filter((c) => c.status === 'completed').length
  const previousCompleted = previousConnections.filter((c) => c.status === 'completed').length

  const currentBeneficiaries = currentSnapshots.length
  const previousBeneficiaries = previousSnapshots.length

  const currentCritical = currentSnapshots.filter((s) => s.urgencyLevel === 'critical').length
  const previousCritical = previousSnapshots.filter((s) => s.urgencyLevel === 'critical').length

  function getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    if (current > previous) return 'up'
    if (current < previous) return 'down'
    return 'stable'
  }

  return [
    {
      label: 'Active Connections',
      value: currentActive,
      unit: 'services',
      trend: getTrend(currentActive, previousActive),
      periodLabel,
    },
    {
      label: 'Completed Programs',
      value: currentCompleted,
      unit: 'programs',
      trend: getTrend(currentCompleted, previousCompleted),
      periodLabel,
    },
    {
      label: 'People Served',
      value: currentBeneficiaries,
      unit: 'beneficiaries',
      trend: getTrend(currentBeneficiaries, previousBeneficiaries),
      periodLabel,
    },
    {
      label: 'Critical Cases',
      value: currentCritical,
      unit: 'cases',
      // For critical cases, down is good
      trend: getTrend(currentCritical, previousCritical),
      periodLabel,
    },
  ]
}

// ---------------------------------------------------------------------------
// Benefits Navigation
// ---------------------------------------------------------------------------

/** Get recommended services for a beneficiary based on cohort and existing connections. */
export function getRecommendedServices(
  services: ServiceListing[],
  cohort: BeneficiaryCohort,
  existingConnections: BenefitConnection[],
): ServiceListing[] {
  const connectedServiceIds = new Set(existingConnections.map((c) => c.serviceId))
  const eligible = findEligibleServices(services, cohort)
  const unconnected = eligible.filter((s) => !connectedServiceIds.has(s.id))
  return rankServicesForCohort(unconnected, cohort)
}

/** Get coverage gaps — primary needs not yet addressed. */
export function getCoverageGaps(
  cohort: BeneficiaryCohort,
  connections: BenefitConnection[],
): ServiceCategory[] {
  const primaryNeeds = COHORT_PRIMARY_NEEDS[cohort] || []
  const coveredCategories = new Set(
    connections
      .filter((c) => c.status === 'enrolled' || c.status === 'completed')
      .map((c) => c.category),
  )
  return primaryNeeds.filter((need) => !coveredCategories.has(need))
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format a case snapshot for display. */
export function serializeCaseSnapshot(snapshot: CaseSnapshot): string {
  const budgetPct = snapshot.monthlyBudgetTotal > 0
    ? Math.round((snapshot.monthlyBudgetUsed / snapshot.monthlyBudgetTotal) * 100)
    : 0

  return [
    `${snapshot.beneficiaryName} (${snapshot.cohort})`,
    `Guardian: ${snapshot.guardianName}`,
    `Connections: ${snapshot.activeConnections} active, ${snapshot.completedConnections} completed`,
    `Urgency: ${snapshot.urgencyLevel}`,
    `Budget: $${snapshot.monthlyBudgetUsed.toFixed(2)}/$${snapshot.monthlyBudgetTotal.toFixed(2)} (${budgetPct}%)`,
    snapshot.pendingActions > 0 ? `Pending Actions: ${snapshot.pendingActions}` : '',
  ].filter(Boolean).join(' | ')
}

/** Format a dashboard summary for display. */
export function serializeDashboardSummary(summary: DashboardSummary): string {
  const lines = [
    `Guardian Dashboard Summary`,
    `Guardians: ${summary.activeGuardians} active`,
    `Beneficiaries: ${summary.totalBeneficiaries}`,
    `Connections: ${summary.activeConnections} active, ${summary.completedConnections} completed`,
    `Avg per guardian: ${summary.averageConnectionsPerGuardian}`,
  ]

  if (summary.criticalCases > 0 || summary.highPriorityCases > 0) {
    lines.push(
      `Alerts: ${summary.criticalCases} critical, ${summary.highPriorityCases} high priority`,
    )
  }

  if (summary.topCategories.length > 0) {
    const top3 = summary.topCategories.slice(0, 3).map((c) => `${c.category}(${c.count})`).join(', ')
    lines.push(`Top Categories: ${top3}`)
  }

  return lines.join('\n')
}
