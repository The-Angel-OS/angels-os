/**
 * Guardian Dashboard Engine — Tests
 *
 * Comprehensive test suite for Guardian dashboard views: service connections,
 * benefits navigation, case management, and impact reporting.
 *
 * Re-implements types and pure functions to avoid Payload imports.
 *
 * @see src/utilities/guardianDashboardEngine.ts
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement types
// ---------------------------------------------------------------------------

type BeneficiaryCohort =
  | 'incarcerated' | 'unhoused' | 'refugee' | 'elderly_isolated'
  | 'foster_youth' | 'disability' | 'veteran' | 'crisis'

type ServiceCategory =
  | 'housing' | 'food' | 'healthcare' | 'legal' | 'employment'
  | 'education' | 'counseling' | 'transportation' | 'benefits' | 'spiritual'

type ServiceStatus = 'available' | 'enrolled' | 'waitlisted' | 'completed' | 'expired'
type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'

interface ServiceListing {
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

interface BenefitConnection {
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

interface CaseSnapshot {
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

interface DashboardSummary {
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

interface ActionItem {
  id: string
  guardianId: string
  beneficiaryName: string
  type: 'follow_up' | 'enrollment' | 'renewal' | 'crisis' | 'review'
  description: string
  dueDate: string
  urgency: UrgencyLevel
  serviceCategory?: ServiceCategory
}

interface ImpactMetric {
  label: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  periodLabel: string
}

// ---------------------------------------------------------------------------
// Re-implement constants
// ---------------------------------------------------------------------------

const SERVICE_CATEGORY_PRIORITY: ServiceCategory[] = [
  'housing', 'food', 'healthcare', 'legal', 'employment',
  'education', 'counseling', 'transportation', 'benefits', 'spiritual',
]

const COHORT_PRIMARY_NEEDS: Record<BeneficiaryCohort, ServiceCategory[]> = {
  incarcerated: ['legal', 'employment', 'housing', 'counseling'],
  unhoused: ['housing', 'food', 'healthcare', 'benefits'],
  refugee: ['legal', 'housing', 'employment', 'education'],
  elderly_isolated: ['healthcare', 'food', 'transportation', 'spiritual'],
  foster_youth: ['housing', 'education', 'counseling', 'employment'],
  disability: ['healthcare', 'benefits', 'transportation', 'employment'],
  veteran: ['healthcare', 'housing', 'employment', 'counseling'],
  crisis: ['housing', 'food', 'healthcare', 'counseling'],
}

const URGENCY_THRESHOLDS = {
  criticalDaysWithoutInteraction: 14,
  highDaysWithoutInteraction: 7,
  mediumDaysWithoutInteraction: 3,
} as const

// ---------------------------------------------------------------------------
// Re-implement pure functions
// ---------------------------------------------------------------------------

function findEligibleServices(
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
    if (!service.eligibilityCriteria.includes(cohort)) return false
    if (filters?.category && service.category !== filters.category) return false
    if (filters?.isRemote !== undefined && service.isRemote !== filters.isRemote) return false
    if (filters?.region && service.location?.region !== filters.region) return false
    if (filters?.minRating !== undefined && service.rating < filters.minRating) return false
    if (filters?.availableOnly && service.availableSlots <= 0) return false
    return true
  })
}

function rankServicesForCohort(
  services: ServiceListing[],
  cohort: BeneficiaryCohort,
): ServiceListing[] {
  const primaryNeeds = COHORT_PRIMARY_NEEDS[cohort] || []
  const sorted = [...services]
  sorted.sort((a, b) => {
    const aPriority = primaryNeeds.indexOf(a.category)
    const bPriority = primaryNeeds.indexOf(b.category)
    const aScore = aPriority >= 0 ? aPriority : 100
    const bScore = bPriority >= 0 ? bPriority : 100
    if (aScore !== bScore) return aScore - bScore
    if (a.availableSlots > 0 && b.availableSlots <= 0) return -1
    if (b.availableSlots > 0 && a.availableSlots <= 0) return 1
    return b.rating - a.rating
  })
  return sorted
}

function calculateUrgency(
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
  if (activeConnections === 0) return 'medium'
  return 'low'
}

function prioritizeActions(actions: ActionItem[]): ActionItem[] {
  const urgencyOrder: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...actions]
  sorted.sort((a, b) => {
    const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (urgDiff !== 0) return urgDiff
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })
  return sorted
}

function filterActionsByType(actions: ActionItem[], types: ActionItem['type'][]): ActionItem[] {
  return actions.filter((a) => types.includes(a.type))
}

function getOverdueActions(actions: ActionItem[], currentDate: Date = new Date()): ActionItem[] {
  return actions.filter((a) => new Date(a.dueDate) < currentDate)
}

function generateDashboardSummary(
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
  const categoryMap = new Map<ServiceCategory, number>()
  for (const conn of connections) {
    categoryMap.set(conn.category, (categoryMap.get(conn.category) || 0) + 1)
  }
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
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

function calculateImpactMetrics(
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
    { label: 'Active Connections', value: currentActive, unit: 'services', trend: getTrend(currentActive, previousActive), periodLabel },
    { label: 'Completed Programs', value: currentCompleted, unit: 'programs', trend: getTrend(currentCompleted, previousCompleted), periodLabel },
    { label: 'People Served', value: currentBeneficiaries, unit: 'beneficiaries', trend: getTrend(currentBeneficiaries, previousBeneficiaries), periodLabel },
    { label: 'Critical Cases', value: currentCritical, unit: 'cases', trend: getTrend(currentCritical, previousCritical), periodLabel },
  ]
}

function getRecommendedServices(
  services: ServiceListing[],
  cohort: BeneficiaryCohort,
  existingConnections: BenefitConnection[],
): ServiceListing[] {
  const connectedServiceIds = new Set(existingConnections.map((c) => c.serviceId))
  const eligible = findEligibleServices(services, cohort)
  const unconnected = eligible.filter((s) => !connectedServiceIds.has(s.id))
  return rankServicesForCohort(unconnected, cohort)
}

function getCoverageGaps(
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

function serializeCaseSnapshot(snapshot: CaseSnapshot): string {
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

function serializeDashboardSummary(summary: DashboardSummary): string {
  const lines = [
    `Guardian Dashboard Summary`,
    `Guardians: ${summary.activeGuardians} active`,
    `Beneficiaries: ${summary.totalBeneficiaries}`,
    `Connections: ${summary.activeConnections} active, ${summary.completedConnections} completed`,
    `Avg per guardian: ${summary.averageConnectionsPerGuardian}`,
  ]
  if (summary.criticalCases > 0 || summary.highPriorityCases > 0) {
    lines.push(`Alerts: ${summary.criticalCases} critical, ${summary.highPriorityCases} high priority`)
  }
  if (summary.topCategories.length > 0) {
    const top3 = summary.topCategories.slice(0, 3).map((c) => `${c.category}(${c.count})`).join(', ')
    lines.push(`Top Categories: ${top3}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeService(overrides: Partial<ServiceListing> = {}): ServiceListing {
  return {
    id: 'svc-001',
    name: 'Downtown Food Bank',
    provider: 'City Mission',
    category: 'food',
    description: 'Weekly food distribution for families.',
    eligibilityCriteria: ['unhoused', 'refugee', 'crisis', 'veteran'],
    availableSlots: 10,
    waitlistCount: 0,
    location: { city: 'Springfield', region: 'Midwest' },
    isRemote: false,
    rating: 4.5,
    lastVerified: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeConnection(overrides: Partial<BenefitConnection> = {}): BenefitConnection {
  return {
    serviceId: 'svc-001',
    serviceName: 'Downtown Food Bank',
    category: 'food',
    status: 'enrolled',
    enrolledAt: '2025-05-15T00:00:00Z',
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<CaseSnapshot> = {}): CaseSnapshot {
  return {
    guardianId: 'guardian-001',
    guardianName: 'Angel Sarah',
    beneficiaryName: 'John D.',
    cohort: 'unhoused',
    activeConnections: 3,
    completedConnections: 1,
    pendingActions: 2,
    urgencyLevel: 'medium',
    lastInteraction: '2025-06-10T00:00:00Z',
    monthlyBudgetUsed: 45.00,
    monthlyBudgetTotal: 83.33,
    ...overrides,
  }
}

function makeAction(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: 'action-001',
    guardianId: 'guardian-001',
    beneficiaryName: 'John D.',
    type: 'follow_up',
    description: 'Check on housing application status.',
    dueDate: '2025-06-15T00:00:00Z',
    urgency: 'medium',
    serviceCategory: 'housing',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Guardian Dashboard Engine', () => {

  // ========================================================================
  // Constants
  // ========================================================================

  describe('Constants', () => {
    it('has 10 service categories in priority order', () => {
      expect(SERVICE_CATEGORY_PRIORITY).toHaveLength(10)
      expect(SERVICE_CATEGORY_PRIORITY[0]).toBe('housing')
    })

    it('defines primary needs for all 8 cohorts', () => {
      const cohorts: BeneficiaryCohort[] = [
        'incarcerated', 'unhoused', 'refugee', 'elderly_isolated',
        'foster_youth', 'disability', 'veteran', 'crisis',
      ]
      for (const cohort of cohorts) {
        expect(COHORT_PRIMARY_NEEDS[cohort]).toBeDefined()
        expect(COHORT_PRIMARY_NEEDS[cohort].length).toBeGreaterThanOrEqual(3)
      }
    })

    it('has urgency thresholds', () => {
      expect(URGENCY_THRESHOLDS.criticalDaysWithoutInteraction).toBe(14)
      expect(URGENCY_THRESHOLDS.highDaysWithoutInteraction).toBe(7)
      expect(URGENCY_THRESHOLDS.mediumDaysWithoutInteraction).toBe(3)
    })
  })

  // ========================================================================
  // Service Discovery
  // ========================================================================

  describe('findEligibleServices', () => {
    const services = [
      makeService({ id: 'svc-1', category: 'food', eligibilityCriteria: ['unhoused', 'crisis'] }),
      makeService({ id: 'svc-2', category: 'housing', eligibilityCriteria: ['unhoused', 'veteran'] }),
      makeService({ id: 'svc-3', category: 'legal', eligibilityCriteria: ['refugee', 'incarcerated'] }),
      makeService({ id: 'svc-4', category: 'healthcare', eligibilityCriteria: ['veteran', 'disability'], isRemote: true, location: { region: 'Northeast' } }),
      makeService({ id: 'svc-5', category: 'food', eligibilityCriteria: ['unhoused'], availableSlots: 0, rating: 3.0 }),
    ]

    it('returns eligible services for cohort', () => {
      const results = findEligibleServices(services, 'unhoused')
      expect(results.length).toBe(3) // svc-1, svc-2, svc-5
    })

    it('returns empty for non-matching cohort', () => {
      const results = findEligibleServices(services, 'foster_youth')
      expect(results.length).toBe(0)
    })

    it('filters by category', () => {
      const results = findEligibleServices(services, 'unhoused', { category: 'food' })
      expect(results.length).toBe(2)
    })

    it('filters by isRemote', () => {
      const results = findEligibleServices(services, 'veteran', { isRemote: true })
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('svc-4')
    })

    it('filters by region', () => {
      const results = findEligibleServices(services, 'veteran', { region: 'Northeast' })
      expect(results.length).toBe(1)
    })

    it('filters by minRating', () => {
      const results = findEligibleServices(services, 'unhoused', { minRating: 4.0 })
      expect(results.length).toBe(2) // svc-1 and svc-2 (both 4.5), not svc-5 (3.0)
    })

    it('filters by availableOnly', () => {
      const results = findEligibleServices(services, 'unhoused', { availableOnly: true })
      expect(results.length).toBe(2) // svc-5 has 0 slots
    })

    it('combines multiple filters', () => {
      const results = findEligibleServices(services, 'unhoused', { category: 'food', availableOnly: true })
      expect(results.length).toBe(1) // svc-1 only
    })
  })

  describe('rankServicesForCohort', () => {
    const services = [
      makeService({ id: 'svc-1', category: 'counseling', rating: 4.0, availableSlots: 5 }),
      makeService({ id: 'svc-2', category: 'housing', rating: 4.5, availableSlots: 2 }),
      makeService({ id: 'svc-3', category: 'food', rating: 3.8, availableSlots: 0 }),
      makeService({ id: 'svc-4', category: 'healthcare', rating: 4.2, availableSlots: 10 }),
    ]

    it('ranks by cohort primary needs first', () => {
      const ranked = rankServicesForCohort(services, 'unhoused')
      // unhoused needs: housing, food, healthcare, benefits
      expect(ranked[0].category).toBe('housing')
      expect(ranked[1].category).toBe('food')
      expect(ranked[2].category).toBe('healthcare')
      // counseling is not primary need, goes last
      expect(ranked[3].category).toBe('counseling')
    })

    it('prioritizes available services within same need level', () => {
      const sameCategory = [
        makeService({ id: 'a', category: 'housing', availableSlots: 0, rating: 5.0 }),
        makeService({ id: 'b', category: 'housing', availableSlots: 5, rating: 3.0 }),
      ]
      const ranked = rankServicesForCohort(sameCategory, 'unhoused')
      expect(ranked[0].id).toBe('b') // Has slots
    })

    it('does not mutate original array', () => {
      const original = [...services]
      rankServicesForCohort(services, 'unhoused')
      expect(services[0].id).toBe(original[0].id)
    })
  })

  // ========================================================================
  // Case Management
  // ========================================================================

  describe('calculateUrgency', () => {
    const now = new Date('2025-06-15T00:00:00Z')

    it('returns critical for crisis flag', () => {
      expect(calculateUrgency('2025-06-14T00:00:00Z', 5, true, now)).toBe('critical')
    })

    it('returns high when no interaction history', () => {
      expect(calculateUrgency(undefined, 3, false, now)).toBe('high')
    })

    it('returns critical after 14+ days without interaction', () => {
      expect(calculateUrgency('2025-06-01T00:00:00Z', 3, false, now)).toBe('critical')
    })

    it('returns high after 7+ days', () => {
      expect(calculateUrgency('2025-06-08T00:00:00Z', 3, false, now)).toBe('high')
    })

    it('returns medium after 3+ days', () => {
      expect(calculateUrgency('2025-06-12T00:00:00Z', 3, false, now)).toBe('medium')
    })

    it('returns low for recent interaction with active connections', () => {
      expect(calculateUrgency('2025-06-14T00:00:00Z', 3, false, now)).toBe('low')
    })

    it('returns medium if no active connections despite recent interaction', () => {
      expect(calculateUrgency('2025-06-14T00:00:00Z', 0, false, now)).toBe('medium')
    })

    it('crisis flag overrides everything', () => {
      // Even with recent interaction and active connections
      expect(calculateUrgency('2025-06-14T00:00:00Z', 10, true, now)).toBe('critical')
    })
  })

  describe('prioritizeActions', () => {
    it('sorts by urgency first', () => {
      const actions = [
        makeAction({ id: '1', urgency: 'low', dueDate: '2025-06-01' }),
        makeAction({ id: '2', urgency: 'critical', dueDate: '2025-06-10' }),
        makeAction({ id: '3', urgency: 'high', dueDate: '2025-06-05' }),
      ]
      const sorted = prioritizeActions(actions)
      expect(sorted[0].id).toBe('2') // critical
      expect(sorted[1].id).toBe('3') // high
      expect(sorted[2].id).toBe('1') // low
    })

    it('sorts by due date within same urgency', () => {
      const actions = [
        makeAction({ id: '1', urgency: 'high', dueDate: '2025-06-10' }),
        makeAction({ id: '2', urgency: 'high', dueDate: '2025-06-05' }),
        makeAction({ id: '3', urgency: 'high', dueDate: '2025-06-08' }),
      ]
      const sorted = prioritizeActions(actions)
      expect(sorted[0].id).toBe('2') // earliest
      expect(sorted[1].id).toBe('3')
      expect(sorted[2].id).toBe('1')
    })

    it('handles empty list', () => {
      expect(prioritizeActions([])).toHaveLength(0)
    })

    it('does not mutate original', () => {
      const actions = [
        makeAction({ id: '1', urgency: 'low' }),
        makeAction({ id: '2', urgency: 'critical' }),
      ]
      const original = actions[0].id
      prioritizeActions(actions)
      expect(actions[0].id).toBe(original)
    })
  })

  describe('filterActionsByType', () => {
    const actions = [
      makeAction({ id: '1', type: 'follow_up' }),
      makeAction({ id: '2', type: 'crisis' }),
      makeAction({ id: '3', type: 'enrollment' }),
      makeAction({ id: '4', type: 'follow_up' }),
      makeAction({ id: '5', type: 'review' }),
    ]

    it('filters by single type', () => {
      expect(filterActionsByType(actions, ['crisis'])).toHaveLength(1)
    })

    it('filters by multiple types', () => {
      const result = filterActionsByType(actions, ['follow_up', 'enrollment'])
      expect(result).toHaveLength(3)
    })

    it('returns empty for non-matching types', () => {
      expect(filterActionsByType(actions, ['renewal'])).toHaveLength(0)
    })
  })

  describe('getOverdueActions', () => {
    const now = new Date('2025-06-15T00:00:00Z')

    it('returns overdue actions', () => {
      const actions = [
        makeAction({ id: '1', dueDate: '2025-06-10T00:00:00Z' }),
        makeAction({ id: '2', dueDate: '2025-06-20T00:00:00Z' }),
        makeAction({ id: '3', dueDate: '2025-06-14T00:00:00Z' }),
      ]
      const overdue = getOverdueActions(actions, now)
      expect(overdue).toHaveLength(2) // id 1 and 3
    })

    it('returns empty when nothing overdue', () => {
      const actions = [makeAction({ dueDate: '2025-07-01T00:00:00Z' })]
      expect(getOverdueActions(actions, now)).toHaveLength(0)
    })
  })

  // ========================================================================
  // Dashboard Aggregations
  // ========================================================================

  describe('generateDashboardSummary', () => {
    it('counts unique guardians', () => {
      const snapshots = [
        makeSnapshot({ guardianId: 'g1' }),
        makeSnapshot({ guardianId: 'g1', beneficiaryName: 'Jane D.' }),
        makeSnapshot({ guardianId: 'g2' }),
      ]
      const summary = generateDashboardSummary(snapshots, [])
      expect(summary.activeGuardians).toBe(2)
    })

    it('counts total beneficiaries', () => {
      const snapshots = [makeSnapshot(), makeSnapshot({ beneficiaryName: 'Jane D.' })]
      const summary = generateDashboardSummary(snapshots, [])
      expect(summary.totalBeneficiaries).toBe(2)
    })

    it('counts active connections (enrolled + waitlisted)', () => {
      const connections = [
        makeConnection({ status: 'enrolled' }),
        makeConnection({ status: 'waitlisted' }),
        makeConnection({ status: 'completed' }),
        makeConnection({ status: 'expired' }),
      ]
      const summary = generateDashboardSummary([makeSnapshot()], connections)
      expect(summary.activeConnections).toBe(2)
      expect(summary.completedConnections).toBe(1)
    })

    it('counts critical and high priority cases', () => {
      const snapshots = [
        makeSnapshot({ urgencyLevel: 'critical' }),
        makeSnapshot({ urgencyLevel: 'critical', beneficiaryName: 'B' }),
        makeSnapshot({ urgencyLevel: 'high', beneficiaryName: 'C' }),
        makeSnapshot({ urgencyLevel: 'low', beneficiaryName: 'D' }),
      ]
      const summary = generateDashboardSummary(snapshots, [])
      expect(summary.criticalCases).toBe(2)
      expect(summary.highPriorityCases).toBe(1)
    })

    it('calculates average connections per guardian', () => {
      const snapshots = [makeSnapshot(), makeSnapshot({ beneficiaryName: 'Jane D.' })]
      const connections = [
        makeConnection({ status: 'enrolled' }),
        makeConnection({ status: 'completed', serviceId: 'svc-2' }),
        makeConnection({ status: 'enrolled', serviceId: 'svc-3' }),
        makeConnection({ status: 'expired', serviceId: 'svc-4' }),
      ]
      const summary = generateDashboardSummary(snapshots, connections)
      // (2 active + 1 completed) / 2 beneficiaries = 1.5
      expect(summary.averageConnectionsPerGuardian).toBe(1.5)
    })

    it('produces top categories sorted by count', () => {
      const connections = [
        makeConnection({ category: 'food' }),
        makeConnection({ category: 'food', serviceId: 'svc-2' }),
        makeConnection({ category: 'housing', serviceId: 'svc-3' }),
        makeConnection({ category: 'food', serviceId: 'svc-4' }),
        makeConnection({ category: 'housing', serviceId: 'svc-5' }),
        makeConnection({ category: 'legal', serviceId: 'svc-6' }),
      ]
      const summary = generateDashboardSummary([makeSnapshot()], connections)
      expect(summary.topCategories[0].category).toBe('food')
      expect(summary.topCategories[0].count).toBe(3)
    })

    it('produces cohort breakdown', () => {
      const snapshots = [
        makeSnapshot({ cohort: 'unhoused' }),
        makeSnapshot({ cohort: 'unhoused', beneficiaryName: 'B' }),
        makeSnapshot({ cohort: 'veteran', beneficiaryName: 'C' }),
      ]
      const summary = generateDashboardSummary(snapshots, [])
      expect(summary.cohortBreakdown[0].cohort).toBe('unhoused')
      expect(summary.cohortBreakdown[0].count).toBe(2)
    })

    it('handles empty inputs', () => {
      const summary = generateDashboardSummary([], [])
      expect(summary.totalBeneficiaries).toBe(0)
      expect(summary.activeGuardians).toBe(0)
      expect(summary.averageConnectionsPerGuardian).toBe(0)
    })
  })

  describe('calculateImpactMetrics', () => {
    it('returns 4 metrics', () => {
      const metrics = calculateImpactMetrics([], [], [], [])
      expect(metrics).toHaveLength(4)
    })

    it('detects upward trends', () => {
      const current = [makeSnapshot(), makeSnapshot({ beneficiaryName: 'B' })]
      const previous = [makeSnapshot()]
      const metrics = calculateImpactMetrics(current, previous, [], [])
      const peopleMetric = metrics.find((m) => m.label === 'People Served')
      expect(peopleMetric?.trend).toBe('up')
    })

    it('detects downward trends', () => {
      const current = [makeSnapshot()]
      const previous = [makeSnapshot(), makeSnapshot({ beneficiaryName: 'B' })]
      const metrics = calculateImpactMetrics(current, previous, [], [])
      const peopleMetric = metrics.find((m) => m.label === 'People Served')
      expect(peopleMetric?.trend).toBe('down')
    })

    it('detects stable trends', () => {
      const snap = [makeSnapshot()]
      const metrics = calculateImpactMetrics(snap, snap, [], [])
      const peopleMetric = metrics.find((m) => m.label === 'People Served')
      expect(peopleMetric?.trend).toBe('stable')
    })

    it('uses custom period label', () => {
      const metrics = calculateImpactMetrics([], [], [], [], 'Q1 2025')
      expect(metrics[0].periodLabel).toBe('Q1 2025')
    })

    it('counts active connections correctly', () => {
      const currentConns = [
        makeConnection({ status: 'enrolled' }),
        makeConnection({ status: 'waitlisted', serviceId: 'svc-2' }),
      ]
      const metrics = calculateImpactMetrics([makeSnapshot()], [], currentConns, [])
      const activeMetric = metrics.find((m) => m.label === 'Active Connections')
      expect(activeMetric?.value).toBe(2)
    })
  })

  // ========================================================================
  // Benefits Navigation
  // ========================================================================

  describe('getRecommendedServices', () => {
    const services = [
      makeService({ id: 'svc-1', category: 'housing', eligibilityCriteria: ['unhoused'] }),
      makeService({ id: 'svc-2', category: 'food', eligibilityCriteria: ['unhoused'] }),
      makeService({ id: 'svc-3', category: 'healthcare', eligibilityCriteria: ['unhoused'] }),
      makeService({ id: 'svc-4', category: 'legal', eligibilityCriteria: ['incarcerated'] }),
    ]

    it('excludes already-connected services', () => {
      const connections = [makeConnection({ serviceId: 'svc-1' })]
      const recommended = getRecommendedServices(services, 'unhoused', connections)
      expect(recommended.find((s) => s.id === 'svc-1')).toBeUndefined()
    })

    it('only returns eligible services', () => {
      const recommended = getRecommendedServices(services, 'unhoused', [])
      expect(recommended.find((s) => s.id === 'svc-4')).toBeUndefined()
    })

    it('returns ranked by cohort needs', () => {
      const recommended = getRecommendedServices(services, 'unhoused', [])
      // unhoused needs: housing, food, healthcare, benefits
      expect(recommended[0].category).toBe('housing')
      expect(recommended[1].category).toBe('food')
    })

    it('returns empty when all services connected', () => {
      const connections = [
        makeConnection({ serviceId: 'svc-1' }),
        makeConnection({ serviceId: 'svc-2' }),
        makeConnection({ serviceId: 'svc-3' }),
      ]
      const recommended = getRecommendedServices(services, 'unhoused', connections)
      expect(recommended).toHaveLength(0)
    })
  })

  describe('getCoverageGaps', () => {
    it('returns all primary needs when no connections', () => {
      const gaps = getCoverageGaps('unhoused', [])
      expect(gaps).toEqual(['housing', 'food', 'healthcare', 'benefits'])
    })

    it('excludes covered categories', () => {
      const connections = [
        makeConnection({ category: 'housing', status: 'enrolled' }),
        makeConnection({ category: 'food', status: 'completed' }),
      ]
      const gaps = getCoverageGaps('unhoused', connections)
      expect(gaps).toEqual(['healthcare', 'benefits'])
    })

    it('ignores expired and waitlisted connections', () => {
      const connections = [
        makeConnection({ category: 'housing', status: 'expired' }),
        makeConnection({ category: 'food', status: 'waitlisted' }),
      ]
      const gaps = getCoverageGaps('unhoused', connections)
      expect(gaps).toContain('housing')
      expect(gaps).toContain('food')
    })

    it('returns empty when all needs covered', () => {
      const connections = [
        makeConnection({ category: 'housing', status: 'enrolled' }),
        makeConnection({ category: 'food', status: 'enrolled' }),
        makeConnection({ category: 'healthcare', status: 'completed' }),
        makeConnection({ category: 'benefits', status: 'enrolled' }),
      ]
      const gaps = getCoverageGaps('unhoused', connections)
      expect(gaps).toHaveLength(0)
    })

    it('works for different cohorts', () => {
      const gaps = getCoverageGaps('incarcerated', [])
      expect(gaps).toEqual(['legal', 'employment', 'housing', 'counseling'])
    })
  })

  // ========================================================================
  // Serialization
  // ========================================================================

  describe('serializeCaseSnapshot', () => {
    it('includes beneficiary name and cohort', () => {
      const result = serializeCaseSnapshot(makeSnapshot())
      expect(result).toContain('John D. (unhoused)')
    })

    it('includes guardian name', () => {
      const result = serializeCaseSnapshot(makeSnapshot())
      expect(result).toContain('Guardian: Angel Sarah')
    })

    it('includes connection counts', () => {
      const result = serializeCaseSnapshot(makeSnapshot({ activeConnections: 5, completedConnections: 2 }))
      expect(result).toContain('5 active, 2 completed')
    })

    it('includes urgency level', () => {
      const result = serializeCaseSnapshot(makeSnapshot({ urgencyLevel: 'critical' }))
      expect(result).toContain('Urgency: critical')
    })

    it('includes budget percentage', () => {
      const result = serializeCaseSnapshot(makeSnapshot({ monthlyBudgetUsed: 41.67, monthlyBudgetTotal: 83.33 }))
      expect(result).toContain('50%')
    })

    it('shows pending actions when present', () => {
      const result = serializeCaseSnapshot(makeSnapshot({ pendingActions: 3 }))
      expect(result).toContain('Pending Actions: 3')
    })

    it('omits pending actions when zero', () => {
      const result = serializeCaseSnapshot(makeSnapshot({ pendingActions: 0 }))
      expect(result).not.toContain('Pending Actions')
    })
  })

  describe('serializeDashboardSummary', () => {
    it('includes header', () => {
      const summary = generateDashboardSummary([], [])
      const result = serializeDashboardSummary(summary)
      expect(result).toContain('Guardian Dashboard Summary')
    })

    it('shows alerts when critical/high cases exist', () => {
      const snapshots = [
        makeSnapshot({ urgencyLevel: 'critical' }),
        makeSnapshot({ urgencyLevel: 'high', beneficiaryName: 'B' }),
      ]
      const summary = generateDashboardSummary(snapshots, [])
      const result = serializeDashboardSummary(summary)
      expect(result).toContain('1 critical, 1 high priority')
    })

    it('omits alerts when no critical/high cases', () => {
      const snapshots = [makeSnapshot({ urgencyLevel: 'low' })]
      const summary = generateDashboardSummary(snapshots, [])
      const result = serializeDashboardSummary(summary)
      expect(result).not.toContain('Alerts')
    })

    it('shows top categories', () => {
      const connections = [
        makeConnection({ category: 'food' }),
        makeConnection({ category: 'housing', serviceId: 'svc-2' }),
      ]
      const summary = generateDashboardSummary([makeSnapshot()], connections)
      const result = serializeDashboardSummary(summary)
      expect(result).toContain('Top Categories:')
    })
  })
})
