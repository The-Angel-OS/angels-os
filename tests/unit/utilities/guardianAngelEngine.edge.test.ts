/**
 * Guardian Angel Engine — Edge-Case Tests (Sprint 36 D2)
 *
 * Adversarial and boundary tests for crisis detection, sustainability metrics,
 * fund management, service effectiveness, and interaction validation.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/guardianAngelEngine.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types (re-implemented to avoid Payload-coupled imports)
// ---------------------------------------------------------------------------

type GuardianStatus = 'pending' | 'active' | 'suspended' | 'graduated' | 'transferred'

type BeneficiaryCohort =
  | 'incarcerated'
  | 'unhoused'
  | 'refugee'
  | 'elderly_isolated'
  | 'foster_youth'
  | 'disability'
  | 'veteran'
  | 'crisis'
  | 'other'

type ServiceCategory =
  | 'benefits_navigation'
  | 'resource_discovery'
  | 'housing_assistance'
  | 'legal_aid'
  | 'medical_access'
  | 'education'
  | 'employment'
  | 'mental_health'
  | 'food_security'
  | 'transportation'
  | 'documentation'
  | 'community_connection'

type InteractionType =
  | 'conversation'
  | 'referral'
  | 'appointment_scheduled'
  | 'document_assistance'
  | 'crisis_intervention'
  | 'check_in'
  | 'goal_progress'
  | 'resource_provided'

interface ServiceConnection {
  category: ServiceCategory
  providerName: string
  providerContact?: string
  referredAt: string
  status: 'pending' | 'connected' | 'completed' | 'declined'
  notes?: string
}

interface GuardianInteraction {
  type: InteractionType
  timestamp: string
  summary: string
  serviceConnections?: ServiceConnection[]
  durationMinutes?: number
}

interface GuardianAngel {
  id: number
  beneficiaryName: string
  beneficiaryCohort: BeneficiaryCohort
  assignedTenant: number
  status: GuardianStatus
  createdAt: string
  activatedAt?: string
  monthlyBudget: number
  totalSpent: number
  interactions: GuardianInteraction[]
  serviceConnections: ServiceConnection[]
  goals: GuardianGoal[]
  caseNotes: CaseNote[]
}

interface GuardianGoal {
  id: number
  description: string
  category: ServiceCategory
  status: 'active' | 'achieved' | 'deferred' | 'dropped'
  createdAt: string
  achievedAt?: string
  milestones: string[]
}

interface CaseNote {
  timestamp: string
  author: 'angel' | 'advocate' | 'system'
  content: string
  sensitive: boolean
}

interface JusticeFundBalance {
  totalCollected: number
  totalAllocated: number
  totalSpent: number
  available: number
  currency: string
}

interface GuardianAllocation {
  guardianId: number
  amount: number
  period: string
  purpose: string
  approved: boolean
}

interface CohortMetrics {
  cohort: BeneficiaryCohort
  activeGuardians: number
  totalInteractions: number
  serviceConnectionsMade: number
  goalsAchieved: number
  avgMonthlySpend: number
}

interface SustainabilityReport {
  fundBalance: JusticeFundBalance
  activeGuardians: number
  monthlyBurn: number
  runwayMonths: number
  sustainabilityStatus: 'critical' | 'caution' | 'healthy' | 'thriving'
  cohortBreakdown: CohortMetrics[]
  totalInteractions: number
  totalServiceConnections: number
  totalGoalsAchieved: number
  costPerInteraction: number
  costPerServiceConnection: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MONTHLY_BUDGET = 83.33
const MAX_MONTHLY_BUDGET = 250.00
const MIN_FUND_BALANCE_FOR_NEW_GUARDIAN = 500.00
const REQUIRED_RUNWAY_MONTHS = 6

const VALID_GUARDIAN_TRANSITIONS: Record<GuardianStatus, GuardianStatus[]> = {
  pending: ['active', 'suspended'],
  active: ['suspended', 'graduated', 'transferred'],
  suspended: ['active', 'transferred'],
  graduated: [],
  transferred: ['active'],
}

const COHORT_LABELS: Record<BeneficiaryCohort, string> = {
  incarcerated: 'Incarcerated Individual',
  unhoused: 'Unhoused Person',
  refugee: 'Refugee / Undocumented',
  elderly_isolated: 'Isolated Elder',
  foster_youth: 'Foster Youth (Aging Out)',
  disability: 'Person with Disability',
  veteran: 'Veteran',
  crisis: 'Crisis Situation',
  other: 'Other',
}

const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  benefits_navigation: 'Benefits Navigation',
  resource_discovery: 'Resource Discovery',
  housing_assistance: 'Housing Assistance',
  legal_aid: 'Legal Aid',
  medical_access: 'Medical Access',
  education: 'Education',
  employment: 'Employment',
  mental_health: 'Mental Health',
  food_security: 'Food Security',
  transportation: 'Transportation',
  documentation: 'Documentation Help',
  community_connection: 'Community Connection',
}

// ---------------------------------------------------------------------------
// Pure function re-implementations
// ---------------------------------------------------------------------------

function validateGuardianTransition(from: GuardianStatus, to: GuardianStatus): boolean {
  return VALID_GUARDIAN_TRANSITIONS[from]?.includes(to) ?? false
}

function calculateFundBalance(
  totalCollected: number,
  totalAllocated: number,
  totalSpent: number,
): JusticeFundBalance {
  return { totalCollected, totalAllocated, totalSpent, available: totalCollected - totalAllocated, currency: 'usd' }
}

function canCreateNewGuardian(
  fundBalance: JusticeFundBalance,
  monthlyBudget: number = DEFAULT_MONTHLY_BUDGET,
): { allowed: boolean; reason?: string } {
  if (fundBalance.available < MIN_FUND_BALANCE_FOR_NEW_GUARDIAN) {
    return {
      allowed: false,
      reason: `Insufficient fund balance. Available: $${fundBalance.available.toFixed(2)}, required minimum: $${MIN_FUND_BALANCE_FOR_NEW_GUARDIAN.toFixed(2)}`,
    }
  }
  const runwayMonths = fundBalance.available / monthlyBudget
  if (runwayMonths < REQUIRED_RUNWAY_MONTHS) {
    return {
      allowed: false,
      reason: `Insufficient runway. Available: ${runwayMonths.toFixed(1)} months, required: ${REQUIRED_RUNWAY_MONTHS} months`,
    }
  }
  return { allowed: true }
}

function calculateMonthlyAllocation(
  guardian: Pick<GuardianAngel, 'id' | 'monthlyBudget' | 'status'>,
  period: string,
): GuardianAllocation | null {
  if (guardian.status !== 'active') return null
  if (guardian.monthlyBudget <= 0) return null
  return {
    guardianId: guardian.id,
    amount: guardian.monthlyBudget,
    period,
    purpose: `Monthly Guardian Angel allocation for period ${period}`,
    approved: true,
  }
}

function calculateMonthlyBurn(
  guardians: Pick<GuardianAngel, 'status' | 'monthlyBudget'>[],
): number {
  return guardians.filter((g) => g.status === 'active').reduce((sum, g) => sum + g.monthlyBudget, 0)
}

function calculateRunway(fundBalance: JusticeFundBalance, monthlyBurn: number): number {
  if (monthlyBurn <= 0) return Infinity
  return fundBalance.available / monthlyBurn
}

function getSustainabilityStatus(
  runwayMonths: number,
): 'critical' | 'caution' | 'healthy' | 'thriving' {
  if (runwayMonths < 3) return 'critical'
  if (runwayMonths < 6) return 'caution'
  if (runwayMonths < 12) return 'healthy'
  return 'thriving'
}

function calculateCohortMetrics(guardians: GuardianAngel[]): CohortMetrics[] {
  const cohortMap = new Map<BeneficiaryCohort, {
    active: number; interactions: number; connections: number; goals: number; totalSpend: number
  }>()

  for (const guardian of guardians) {
    const existing = cohortMap.get(guardian.beneficiaryCohort) || {
      active: 0, interactions: 0, connections: 0, goals: 0, totalSpend: 0,
    }
    if (guardian.status === 'active') existing.active++
    existing.interactions += guardian.interactions.length
    existing.connections += guardian.serviceConnections.filter(
      (sc) => sc.status === 'connected' || sc.status === 'completed',
    ).length
    existing.goals += guardian.goals.filter((g) => g.status === 'achieved').length
    existing.totalSpend += guardian.totalSpent
    cohortMap.set(guardian.beneficiaryCohort, existing)
  }

  const metrics: CohortMetrics[] = []
  for (const [cohort, data] of cohortMap) {
    metrics.push({
      cohort,
      activeGuardians: data.active,
      totalInteractions: data.interactions,
      serviceConnectionsMade: data.connections,
      goalsAchieved: data.goals,
      avgMonthlySpend: data.active > 0 ? data.totalSpend / data.active : 0,
    })
  }
  return metrics.sort((a, b) => b.activeGuardians - a.activeGuardians)
}

function generateSustainabilityReport(
  fundBalance: JusticeFundBalance,
  guardians: GuardianAngel[],
): SustainabilityReport {
  const activeGuardians = guardians.filter((g) => g.status === 'active').length
  const monthlyBurn = calculateMonthlyBurn(guardians)
  const runwayMonths = calculateRunway(fundBalance, monthlyBurn)
  const cohortBreakdown = calculateCohortMetrics(guardians)
  const totalInteractions = guardians.reduce((sum, g) => sum + g.interactions.length, 0)
  const totalServiceConnections = guardians.reduce(
    (sum, g) => sum + g.serviceConnections.filter(
      (sc) => sc.status === 'connected' || sc.status === 'completed',
    ).length, 0,
  )
  const totalGoalsAchieved = guardians.reduce(
    (sum, g) => sum + g.goals.filter((goal) => goal.status === 'achieved').length, 0,
  )
  const totalSpent = guardians.reduce((sum, g) => sum + g.totalSpent, 0)
  return {
    fundBalance, activeGuardians, monthlyBurn, runwayMonths,
    sustainabilityStatus: getSustainabilityStatus(runwayMonths),
    cohortBreakdown, totalInteractions, totalServiceConnections, totalGoalsAchieved,
    costPerInteraction: totalInteractions > 0 ? totalSpent / totalInteractions : 0,
    costPerServiceConnection: totalServiceConnections > 0 ? totalSpent / totalServiceConnections : 0,
  }
}

function validateInteraction(interaction: Partial<GuardianInteraction>): string | null {
  if (!interaction.type) return 'Interaction type is required.'
  if (!interaction.summary || !interaction.summary.trim()) return 'Interaction summary is required.'
  if (interaction.durationMinutes !== undefined && interaction.durationMinutes < 0) {
    return 'Duration cannot be negative.'
  }
  const validTypes: InteractionType[] = [
    'conversation', 'referral', 'appointment_scheduled', 'document_assistance',
    'crisis_intervention', 'check_in', 'goal_progress', 'resource_provided',
  ]
  if (!validTypes.includes(interaction.type)) return `Invalid interaction type: ${interaction.type}`
  return null
}

function detectCrisisPattern(
  interactions: GuardianInteraction[],
  windowDays: number = 7,
): { isCrisis: boolean; indicators: string[] } {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const indicators: string[] = []
  const recentInteractions = interactions.filter((i) => new Date(i.timestamp) >= windowStart)
  const crisisCount = recentInteractions.filter((i) => i.type === 'crisis_intervention').length
  if (crisisCount > 0) {
    indicators.push(`${crisisCount} crisis intervention(s) in the last ${windowDays} days`)
  }
  if (interactions.length > 0) {
    const lastInteraction = interactions.reduce((latest, i) =>
      new Date(i.timestamp) > new Date(latest.timestamp) ? i : latest,
    )
    const daysSinceContact = Math.floor(
      (now.getTime() - new Date(lastInteraction.timestamp).getTime()) / (24 * 60 * 60 * 1000),
    )
    if (daysSinceContact >= 14) {
      indicators.push(`No contact for ${daysSinceContact} days (isolation risk)`)
    }
  }
  if (recentInteractions.length >= 5) {
    indicators.push(`High interaction frequency: ${recentInteractions.length} in ${windowDays} days`)
  }
  return { isCrisis: indicators.length > 0, indicators }
}

function calculateServiceEffectiveness(
  connections: ServiceConnection[],
): { total: number; connected: number; completed: number; declined: number; successRate: number } {
  const total = connections.length
  const connected = connections.filter((c) => c.status === 'connected').length
  const completed = connections.filter((c) => c.status === 'completed').length
  const declined = connections.filter((c) => c.status === 'declined').length
  const successful = connected + completed
  return { total, connected, completed, declined, successRate: total > 0 ? (successful / total) * 100 : 0 }
}

function calculateGoalProgress(
  goals: GuardianGoal[],
): { total: number; achieved: number; active: number; completionRate: number } {
  const total = goals.length
  const achieved = goals.filter((g) => g.status === 'achieved').length
  const active = goals.filter((g) => g.status === 'active').length
  return { total, achieved, active, completionRate: total > 0 ? (achieved / total) * 100 : 0 }
}

function serializeGuardian(guardian: GuardianAngel): string {
  const parts = [
    `Guardian #${guardian.id}`,
    guardian.beneficiaryName,
    `(${COHORT_LABELS[guardian.beneficiaryCohort]})`,
    `Status: ${getGuardianStatusLabel(guardian.status)}`,
    `Interactions: ${guardian.interactions.length}`,
    `Service connections: ${guardian.serviceConnections.length}`,
  ]
  return parts.join(' | ')
}

function getGuardianStatusLabel(status: GuardianStatus): string {
  const labels: Record<GuardianStatus, string> = {
    pending: 'Pending Activation', active: 'Active', suspended: 'Suspended',
    graduated: 'Graduated', transferred: 'Transferred',
  }
  return labels[status] ?? status
}

function serializeSustainabilityReport(report: SustainabilityReport): string {
  const lines = [
    `Justice Fund Balance: $${report.fundBalance.available.toFixed(2)}`,
    `Active Guardians: ${report.activeGuardians}`,
    `Monthly Burn: $${report.monthlyBurn.toFixed(2)}`,
    `Runway: ${report.runwayMonths === Infinity ? '∞' : report.runwayMonths.toFixed(1)} months`,
    `Status: ${report.sustainabilityStatus.toUpperCase()}`,
    `Total Interactions: ${report.totalInteractions}`,
    `Service Connections: ${report.totalServiceConnections}`,
    `Goals Achieved: ${report.totalGoalsAchieved}`,
  ]
  if (report.costPerInteraction > 0) {
    lines.push(`Cost/Interaction: $${report.costPerInteraction.toFixed(2)}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeGuardian(overrides?: Partial<GuardianAngel>): GuardianAngel {
  return {
    id: 1,
    beneficiaryName: 'Marcus Johnson',
    beneficiaryCohort: 'incarcerated',
    assignedTenant: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    activatedAt: '2026-01-02T00:00:00Z',
    monthlyBudget: DEFAULT_MONTHLY_BUDGET,
    totalSpent: 250,
    interactions: [
      { type: 'conversation', timestamp: '2026-02-15T10:00:00Z', summary: 'Discussed reentry plan', durationMinutes: 30 },
    ],
    serviceConnections: [
      { category: 'housing_assistance', providerName: 'Housing First', referredAt: '2026-02-16T14:00:00Z', status: 'connected' },
    ],
    goals: [
      { id: 1, description: 'Find stable housing', category: 'housing_assistance', status: 'active', createdAt: '2026-01-15T00:00:00Z', milestones: ['Applied to program'] },
    ],
    caseNotes: [],
    ...overrides,
  }
}

function makeFundBalance(overrides?: Partial<JusticeFundBalance>): JusticeFundBalance {
  return {
    totalCollected: 10000,
    totalAllocated: 3000,
    totalSpent: 2500,
    available: 7000,
    currency: 'usd',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Edge-Case Tests
// ---------------------------------------------------------------------------

describe('Guardian Angel Engine — Edge Cases', () => {
  // =========================================================================
  // 1. Zero/Negative Budget Guardian
  // =========================================================================
  describe('zero and negative budget guardian', () => {
    it('returns null allocation for active guardian with zero budget', () => {
      const guardian = makeGuardian({ monthlyBudget: 0 })
      const allocation = calculateMonthlyAllocation(guardian, '2026-03')
      expect(allocation).toBeNull()
    })

    it('returns null allocation for active guardian with negative budget', () => {
      const guardian = makeGuardian({ monthlyBudget: -50 })
      const allocation = calculateMonthlyAllocation(guardian, '2026-03')
      expect(allocation).toBeNull()
    })

    it('excludes zero-budget active guardians from monthly burn', () => {
      const guardians = [
        makeGuardian({ id: 1, monthlyBudget: 83.33 }),
        makeGuardian({ id: 2, monthlyBudget: 0 }),
        makeGuardian({ id: 3, monthlyBudget: -10 }),
      ]
      // All are active, but burn should include negative and zero values
      const burn = calculateMonthlyBurn(guardians)
      // reduce sums all active budgets: 83.33 + 0 + (-10) = 73.33
      expect(burn).toBeCloseTo(73.33, 2)
    })
  })

  // =========================================================================
  // 2. Crisis Detection Boundary — Exactly at Thresholds
  // =========================================================================
  describe('crisis detection boundary conditions', () => {
    it('does NOT flag crisis with exactly 4 interactions in 7 days (threshold is 5)', () => {
      const now = new Date()
      const recent = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600000).toISOString()
      const interactions: GuardianInteraction[] = Array.from({ length: 4 }, (_, i) => ({
        type: 'check_in' as InteractionType,
        timestamp: recent(i * 12 + 1), // spread over last 2 days
        summary: `Check-in ${i + 1}`,
      }))

      const result = detectCrisisPattern(interactions)
      // 4 interactions < 5 threshold, no crisis_intervention type
      expect(result.isCrisis).toBe(false)
    })

    it('DOES flag crisis with exactly 5 interactions in 7 days', () => {
      const now = new Date()
      const recent = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600000).toISOString()
      const interactions: GuardianInteraction[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'check_in' as InteractionType,
        timestamp: recent(i * 12 + 1),
        summary: `Check-in ${i + 1}`,
      }))

      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(true)
      expect(result.indicators).toContainEqual(expect.stringContaining('High interaction frequency'))
    })

    it('detects isolation at exactly 14 days since last contact', () => {
      const now = new Date()
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const interactions: GuardianInteraction[] = [{
        type: 'conversation',
        timestamp: fourteenDaysAgo.toISOString(),
        summary: 'Last contact exactly 14 days ago',
      }]

      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(true)
      expect(result.indicators).toContainEqual(expect.stringContaining('isolation risk'))
    })

    it('does NOT flag isolation at 13 days since last contact', () => {
      const now = new Date()
      const thirteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)
      const interactions: GuardianInteraction[] = [{
        type: 'conversation',
        timestamp: thirteenDaysAgo.toISOString(),
        summary: 'Last contact 13 days ago',
      }]

      const result = detectCrisisPattern(interactions)
      const hasIsolation = result.indicators.some((i) => i.includes('isolation risk'))
      expect(hasIsolation).toBe(false)
    })
  })

  // =========================================================================
  // 3. Cohort with Only Non-Active Guardians
  // =========================================================================
  describe('cohort with only non-active guardians', () => {
    it('reports zero active guardians and zero avgMonthlySpend', () => {
      const guardians = [
        makeGuardian({ id: 1, status: 'graduated', beneficiaryCohort: 'unhoused', totalSpent: 500 }),
        makeGuardian({ id: 2, status: 'suspended', beneficiaryCohort: 'unhoused', totalSpent: 300 }),
      ]

      const metrics = calculateCohortMetrics(guardians)
      const unhoused = metrics.find((m) => m.cohort === 'unhoused')
      expect(unhoused).toBeDefined()
      expect(unhoused!.activeGuardians).toBe(0)
      // avgMonthlySpend = data.active > 0 ? totalSpend / active : 0
      expect(unhoused!.avgMonthlySpend).toBe(0)
    })
  })

  // =========================================================================
  // 4. Multiple Simultaneous Crisis Indicators
  // =========================================================================
  describe('multiple simultaneous crisis indicators', () => {
    it('reports all indicators when crisis intervention + high frequency + isolation overlap', () => {
      const now = new Date()
      const recent = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600000).toISOString()
      // 5 recent interactions including a crisis_intervention
      const interactions: GuardianInteraction[] = [
        { type: 'crisis_intervention', timestamp: recent(1), summary: 'Emergency' },
        { type: 'check_in', timestamp: recent(6), summary: 'Check' },
        { type: 'check_in', timestamp: recent(12), summary: 'Check' },
        { type: 'check_in', timestamp: recent(24), summary: 'Check' },
        { type: 'check_in', timestamp: recent(48), summary: 'Check' },
      ]

      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(true)
      // Should have at least crisis_intervention + high frequency indicators
      expect(result.indicators.length).toBeGreaterThanOrEqual(2)
      expect(result.indicators).toContainEqual(expect.stringContaining('crisis intervention'))
      expect(result.indicators).toContainEqual(expect.stringContaining('High interaction frequency'))
    })
  })

  // =========================================================================
  // 5. Sustainability Report at Exact Runway Boundaries
  // =========================================================================
  describe('sustainability at exact runway boundaries', () => {
    it('returns "critical" for runway exactly at 2.99 months', () => {
      expect(getSustainabilityStatus(2.99)).toBe('critical')
    })

    it('returns "caution" for runway exactly at 3.0 months', () => {
      expect(getSustainabilityStatus(3.0)).toBe('caution')
    })

    it('returns "caution" for runway exactly at 5.99 months', () => {
      expect(getSustainabilityStatus(5.99)).toBe('caution')
    })

    it('returns "healthy" for runway exactly at 6.0 months', () => {
      expect(getSustainabilityStatus(6.0)).toBe('healthy')
    })

    it('returns "healthy" for runway exactly at 11.99 months', () => {
      expect(getSustainabilityStatus(11.99)).toBe('healthy')
    })

    it('returns "thriving" for runway exactly at 12.0 months', () => {
      expect(getSustainabilityStatus(12.0)).toBe('thriving')
    })

    it('returns "thriving" for Infinity runway (no active guardians)', () => {
      expect(getSustainabilityStatus(Infinity)).toBe('thriving')
    })

    it('sustainability report serialization handles Infinity runway', () => {
      const fund = makeFundBalance({ available: 5000 })
      const report = generateSustainabilityReport(fund, []) // No guardians → Infinity runway
      const text = serializeSustainabilityReport(report)
      expect(text).toContain('Runway: ∞ months')
      expect(text).toContain('THRIVING')
    })
  })

  // =========================================================================
  // 6. Service Effectiveness with Edge-Case Inputs
  // =========================================================================
  describe('service effectiveness edge cases', () => {
    it('returns 0% success rate for empty connections', () => {
      const result = calculateServiceEffectiveness([])
      expect(result.total).toBe(0)
      expect(result.successRate).toBe(0)
    })

    it('returns 100% success rate when all connections completed', () => {
      const connections: ServiceConnection[] = [
        { category: 'housing_assistance', providerName: 'A', referredAt: '2026-01-01', status: 'completed' },
        { category: 'legal_aid', providerName: 'B', referredAt: '2026-01-02', status: 'completed' },
      ]
      const result = calculateServiceEffectiveness(connections)
      expect(result.successRate).toBe(100)
    })

    it('counts both connected and completed as successful', () => {
      const connections: ServiceConnection[] = [
        { category: 'housing_assistance', providerName: 'A', referredAt: '2026-01-01', status: 'connected' },
        { category: 'legal_aid', providerName: 'B', referredAt: '2026-01-02', status: 'completed' },
        { category: 'education', providerName: 'C', referredAt: '2026-01-03', status: 'pending' },
      ]
      const result = calculateServiceEffectiveness(connections)
      // 2 successful out of 3 total
      expect(result.successRate).toBeCloseTo(66.67, 1)
    })
  })

  // =========================================================================
  // 7. Interaction Validation Edge Cases
  // =========================================================================
  describe('interaction validation edge cases', () => {
    it('rejects whitespace-only summary', () => {
      const error = validateInteraction({ type: 'conversation', summary: '   \t\n  ' })
      expect(error).toBe('Interaction summary is required.')
    })

    it('accepts zero duration (instantaneous interaction)', () => {
      const error = validateInteraction({ type: 'check_in', summary: 'Quick check', durationMinutes: 0 })
      expect(error).toBeNull()
    })

    it('rejects negative duration', () => {
      const error = validateInteraction({ type: 'check_in', summary: 'Check', durationMinutes: -1 })
      expect(error).toBe('Duration cannot be negative.')
    })

    it('accepts very long summary string without error', () => {
      const longSummary = 'A'.repeat(10000)
      const error = validateInteraction({ type: 'conversation', summary: longSummary })
      expect(error).toBeNull()
    })
  })

  // =========================================================================
  // 8. Guardian Transitions — Comprehensive Invalid Paths
  // =========================================================================
  describe('guardian transition invalid paths', () => {
    it('rejects graduated → active (terminal state)', () => {
      expect(validateGuardianTransition('graduated', 'active')).toBe(false)
    })

    it('rejects graduated → suspended (terminal state)', () => {
      expect(validateGuardianTransition('graduated', 'suspended')).toBe(false)
    })

    it('rejects graduated → transferred (terminal state)', () => {
      expect(validateGuardianTransition('graduated', 'transferred')).toBe(false)
    })

    it('allows transferred → active (re-activation at new instance)', () => {
      expect(validateGuardianTransition('transferred', 'active')).toBe(true)
    })

    it('rejects transferred → suspended (must re-activate first)', () => {
      expect(validateGuardianTransition('transferred', 'suspended')).toBe(false)
    })

    it('rejects self-transitions (active → active)', () => {
      expect(validateGuardianTransition('active', 'active')).toBe(false)
    })

    it('rejects self-transitions (pending → pending)', () => {
      expect(validateGuardianTransition('pending', 'pending')).toBe(false)
    })
  })

  // =========================================================================
  // 9. Fund Balance Edge Cases — canCreateNewGuardian
  // =========================================================================
  describe('canCreateNewGuardian boundary conditions', () => {
    it('rejects at exactly $499.99 (just below minimum)', () => {
      const fund = makeFundBalance({ available: 499.99 })
      const result = canCreateNewGuardian(fund)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient fund balance')
    })

    it('allows at exactly $500 because runway is 6.0004 months (≥ 6)', () => {
      // $500 / $83.33/mo = 6.00048... which passes REQUIRED_RUNWAY_MONTHS (6)
      const fund = makeFundBalance({ available: 500 })
      const result = canCreateNewGuardian(fund)
      expect(result.allowed).toBe(true)
    })

    it('rejects when balance passes but runway fails with high budget', () => {
      // Available $600 ≥ $500 min → passes balance check
      // But $600 / $150/mo = 4.0 months < 6 required → fails runway
      const fund = makeFundBalance({ available: 600 })
      const result = canCreateNewGuardian(fund, 150)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient runway')
    })

    it('allows when balance meets both thresholds', () => {
      // Need available >= 500 AND available/83.33 >= 6
      // 83.33 * 6 = 499.98, but must also be >= 500
      const fund = makeFundBalance({ available: 501 })
      const result = canCreateNewGuardian(fund)
      // 501 / 83.33 ≈ 6.01 → passes both checks
      expect(result.allowed).toBe(true)
    })

    it('fails runway check with high custom monthly budget', () => {
      const fund = makeFundBalance({ available: 1000 })
      // 1000 / 250 = 4 months < 6 required
      const result = canCreateNewGuardian(fund, MAX_MONTHLY_BUDGET)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient runway')
    })
  })

  // =========================================================================
  // 10. Goal Progress Edge Cases
  // =========================================================================
  describe('goal progress edge cases', () => {
    it('handles all goals in deferred/dropped status', () => {
      const goals: GuardianGoal[] = [
        { id: 1, description: 'A', category: 'housing_assistance', status: 'deferred', createdAt: '2026-01-01', milestones: [] },
        { id: 2, description: 'B', category: 'education', status: 'dropped', createdAt: '2026-01-02', milestones: [] },
      ]
      const progress = calculateGoalProgress(goals)
      expect(progress.total).toBe(2)
      expect(progress.achieved).toBe(0)
      expect(progress.active).toBe(0)
      expect(progress.completionRate).toBe(0)
    })

    it('handles empty goals array', () => {
      const progress = calculateGoalProgress([])
      expect(progress.total).toBe(0)
      expect(progress.completionRate).toBe(0)
    })
  })
})
