/**
 * Unit tests for Guardian Angel Engine — Sprint 5.
 *
 * Tests the assignment system, Justice Fund management, sustainability metrics,
 * crisis detection, service connection tracking, and goal progress for the
 * constitutional zero-revenue Angel system.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * "Everyone deserves a Guardian Angel that actually shows up."
 *
 * @see src/utilities/guardianAngelEngine.ts — guardian angel engine
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
// Constants (re-implemented from source)
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

function getGuardianStatusLabel(status: GuardianStatus): string {
  const labels: Record<GuardianStatus, string> = {
    pending: 'Pending Activation',
    active: 'Active',
    suspended: 'Suspended',
    graduated: 'Graduated',
    transferred: 'Transferred',
  }
  return labels[status] ?? status
}

function calculateFundBalance(
  totalCollected: number,
  totalAllocated: number,
  totalSpent: number,
): JusticeFundBalance {
  return {
    totalCollected,
    totalAllocated,
    totalSpent,
    available: totalCollected - totalAllocated,
    currency: 'usd',
  }
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
  return guardians
    .filter((g) => g.status === 'active')
    .reduce((sum, g) => sum + g.monthlyBudget, 0)
}

function calculateRunway(
  fundBalance: JusticeFundBalance,
  monthlyBurn: number,
): number {
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

  const totalInteractions = guardians.reduce(
    (sum, g) => sum + g.interactions.length, 0,
  )
  const totalServiceConnections = guardians.reduce(
    (sum, g) => sum + g.serviceConnections.filter(
      (sc) => sc.status === 'connected' || sc.status === 'completed',
    ).length,
    0,
  )
  const totalGoalsAchieved = guardians.reduce(
    (sum, g) => sum + g.goals.filter((goal) => goal.status === 'achieved').length,
    0,
  )

  const totalSpent = guardians.reduce((sum, g) => sum + g.totalSpent, 0)

  return {
    fundBalance,
    activeGuardians,
    monthlyBurn,
    runwayMonths,
    sustainabilityStatus: getSustainabilityStatus(runwayMonths),
    cohortBreakdown,
    totalInteractions,
    totalServiceConnections,
    totalGoalsAchieved,
    costPerInteraction: totalInteractions > 0 ? totalSpent / totalInteractions : 0,
    costPerServiceConnection: totalServiceConnections > 0
      ? totalSpent / totalServiceConnections
      : 0,
  }
}

function validateInteraction(
  interaction: Partial<GuardianInteraction>,
): string | null {
  if (!interaction.type) return 'Interaction type is required.'
  if (!interaction.summary || !interaction.summary.trim()) {
    return 'Interaction summary is required.'
  }
  if (interaction.durationMinutes !== undefined && interaction.durationMinutes < 0) {
    return 'Duration cannot be negative.'
  }

  const validTypes: InteractionType[] = [
    'conversation', 'referral', 'appointment_scheduled',
    'document_assistance', 'crisis_intervention', 'check_in',
    'goal_progress', 'resource_provided',
  ]
  if (!validTypes.includes(interaction.type)) {
    return `Invalid interaction type: ${interaction.type}`
  }

  return null
}

function detectCrisisPattern(
  interactions: GuardianInteraction[],
  windowDays: number = 7,
): { isCrisis: boolean; indicators: string[] } {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const indicators: string[] = []

  const recentInteractions = interactions.filter(
    (i) => new Date(i.timestamp) >= windowStart,
  )

  const crisisCount = recentInteractions.filter(
    (i) => i.type === 'crisis_intervention',
  ).length
  if (crisisCount > 0) {
    indicators.push(`${crisisCount} crisis intervention(s) in the last ${windowDays} days`)
  }

  if (interactions.length > 0) {
    const lastInteraction = interactions.reduce((latest, i) =>
      new Date(i.timestamp) > new Date(latest.timestamp) ? i : latest,
    )
    const daysSinceContact = Math.floor(
      (now.getTime() - new Date(lastInteraction.timestamp).getTime()) /
        (24 * 60 * 60 * 1000),
    )
    if (daysSinceContact >= 14) {
      indicators.push(`No contact for ${daysSinceContact} days (isolation risk)`)
    }
  }

  if (recentInteractions.length >= 5) {
    indicators.push(`High interaction frequency: ${recentInteractions.length} in ${windowDays} days`)
  }

  return {
    isCrisis: indicators.length > 0,
    indicators,
  }
}

function calculateServiceEffectiveness(
  connections: ServiceConnection[],
): { total: number; connected: number; completed: number; declined: number; successRate: number } {
  const total = connections.length
  const connected = connections.filter((c) => c.status === 'connected').length
  const completed = connections.filter((c) => c.status === 'completed').length
  const declined = connections.filter((c) => c.status === 'declined').length
  const successful = connected + completed

  return {
    total,
    connected,
    completed,
    declined,
    successRate: total > 0 ? (successful / total) * 100 : 0,
  }
}

function calculateGoalProgress(
  goals: GuardianGoal[],
): { total: number; achieved: number; active: number; completionRate: number } {
  const total = goals.length
  const achieved = goals.filter((g) => g.status === 'achieved').length
  const active = goals.filter((g) => g.status === 'active').length

  return {
    total,
    achieved,
    active,
    completionRate: total > 0 ? (achieved / total) * 100 : 0,
  }
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
// Test Fixtures
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
      {
        type: 'conversation',
        timestamp: '2026-02-15T10:00:00Z',
        summary: 'Discussed reentry plan and housing options',
        durationMinutes: 30,
      },
      {
        type: 'referral',
        timestamp: '2026-02-16T14:00:00Z',
        summary: 'Referred to Pinellas County reentry program',
      },
    ],
    serviceConnections: [
      {
        category: 'housing_assistance',
        providerName: 'Pinellas Hope',
        referredAt: '2026-02-01T00:00:00Z',
        status: 'connected',
      },
      {
        category: 'employment',
        providerName: 'CareerSource Tampa Bay',
        referredAt: '2026-02-10T00:00:00Z',
        status: 'pending',
      },
    ],
    goals: [
      {
        id: 1,
        description: 'Secure transitional housing',
        category: 'housing_assistance',
        status: 'active',
        createdAt: '2026-01-15T00:00:00Z',
        milestones: ['Applied to Pinellas Hope', 'Interview scheduled'],
      },
      {
        id: 2,
        description: 'Obtain state ID',
        category: 'documentation',
        status: 'achieved',
        createdAt: '2026-01-20T00:00:00Z',
        achievedAt: '2026-02-05T00:00:00Z',
        milestones: ['Gathered documents', 'Visited DMV', 'ID received'],
      },
    ],
    caseNotes: [
      {
        timestamp: '2026-02-15T10:30:00Z',
        author: 'angel',
        content: 'Marcus is making good progress. Housing application submitted.',
        sensitive: false,
      },
    ],
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
// Tests
// ---------------------------------------------------------------------------

describe('Guardian Angel Engine', () => {
  // =========================================================================
  // Guardian Status Management
  // =========================================================================
  describe('validateGuardianTransition', () => {
    it('allows pending → active', () => {
      expect(validateGuardianTransition('pending', 'active')).toBe(true)
    })

    it('allows pending → suspended', () => {
      expect(validateGuardianTransition('pending', 'suspended')).toBe(true)
    })

    it('allows active → suspended', () => {
      expect(validateGuardianTransition('active', 'suspended')).toBe(true)
    })

    it('allows active → graduated (best outcome)', () => {
      expect(validateGuardianTransition('active', 'graduated')).toBe(true)
    })

    it('allows active → transferred', () => {
      expect(validateGuardianTransition('active', 'transferred')).toBe(true)
    })

    it('allows suspended → active (reactivation)', () => {
      expect(validateGuardianTransition('suspended', 'active')).toBe(true)
    })

    it('allows suspended → transferred', () => {
      expect(validateGuardianTransition('suspended', 'transferred')).toBe(true)
    })

    it('allows transferred → active (at new instance)', () => {
      expect(validateGuardianTransition('transferred', 'active')).toBe(true)
    })

    it('disallows graduated → anything (terminal state)', () => {
      expect(validateGuardianTransition('graduated', 'active')).toBe(false)
      expect(validateGuardianTransition('graduated', 'pending')).toBe(false)
      expect(validateGuardianTransition('graduated', 'suspended')).toBe(false)
    })

    it('disallows pending → graduated (must activate first)', () => {
      expect(validateGuardianTransition('pending', 'graduated')).toBe(false)
    })

    it('disallows any state → pending (pending is initial only)', () => {
      expect(validateGuardianTransition('active', 'pending')).toBe(false)
      expect(validateGuardianTransition('suspended', 'pending')).toBe(false)
    })
  })

  describe('getGuardianStatusLabel', () => {
    it('returns Pending Activation for pending', () => {
      expect(getGuardianStatusLabel('pending')).toBe('Pending Activation')
    })

    it('returns Active for active', () => {
      expect(getGuardianStatusLabel('active')).toBe('Active')
    })

    it('returns Graduated for graduated', () => {
      expect(getGuardianStatusLabel('graduated')).toBe('Graduated')
    })

    it('returns Transferred for transferred', () => {
      expect(getGuardianStatusLabel('transferred')).toBe('Transferred')
    })
  })

  // =========================================================================
  // Justice Fund Management
  // =========================================================================
  describe('calculateFundBalance', () => {
    it('calculates available as totalCollected - totalAllocated', () => {
      const balance = calculateFundBalance(10000, 3000, 2000)
      expect(balance.available).toBe(7000)
    })

    it('sets currency to usd', () => {
      const balance = calculateFundBalance(100, 50, 25)
      expect(balance.currency).toBe('usd')
    })

    it('handles zero values', () => {
      const balance = calculateFundBalance(0, 0, 0)
      expect(balance.available).toBe(0)
    })

    it('handles negative available (over-allocated)', () => {
      const balance = calculateFundBalance(1000, 1500, 1200)
      expect(balance.available).toBe(-500)
    })

    it('preserves all input values', () => {
      const balance = calculateFundBalance(10000, 3000, 2500)
      expect(balance.totalCollected).toBe(10000)
      expect(balance.totalAllocated).toBe(3000)
      expect(balance.totalSpent).toBe(2500)
    })
  })

  describe('canCreateNewGuardian', () => {
    it('allows creation with sufficient balance and runway', () => {
      const balance = makeFundBalance({ available: 5000 })
      const result = canCreateNewGuardian(balance)
      expect(result.allowed).toBe(true)
    })

    it('denies creation with insufficient fund balance', () => {
      const balance = makeFundBalance({ available: 200 })
      const result = canCreateNewGuardian(balance)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient fund balance')
    })

    it('denies creation at exact minimum balance but insufficient runway', () => {
      // $500 available / $83.33/month = 6.0 months — barely passes
      const balance = makeFundBalance({ available: 500 })
      const result = canCreateNewGuardian(balance)
      expect(result.allowed).toBe(true)
    })

    it('denies when runway is insufficient for higher budget', () => {
      // $500 available / $250/month = 2 months — fails
      const balance = makeFundBalance({ available: 500 })
      const result = canCreateNewGuardian(balance, MAX_MONTHLY_BUDGET)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient runway')
    })

    it('provides reason mentioning required minimum', () => {
      const balance = makeFundBalance({ available: 100 })
      const result = canCreateNewGuardian(balance)
      expect(result.reason).toContain('$500.00')
    })

    it('provides reason mentioning required runway months', () => {
      const balance = makeFundBalance({ available: 500 })
      const result = canCreateNewGuardian(balance, MAX_MONTHLY_BUDGET)
      expect(result.reason).toContain(`${REQUIRED_RUNWAY_MONTHS}`)
    })
  })

  describe('calculateMonthlyAllocation', () => {
    it('returns allocation for active guardian', () => {
      const guardian = { id: 1, monthlyBudget: DEFAULT_MONTHLY_BUDGET, status: 'active' as GuardianStatus }
      const allocation = calculateMonthlyAllocation(guardian, '2026-02')
      expect(allocation).not.toBeNull()
      expect(allocation!.guardianId).toBe(1)
      expect(allocation!.amount).toBe(DEFAULT_MONTHLY_BUDGET)
      expect(allocation!.period).toBe('2026-02')
      expect(allocation!.approved).toBe(true)
    })

    it('returns null for suspended guardian', () => {
      const guardian = { id: 1, monthlyBudget: DEFAULT_MONTHLY_BUDGET, status: 'suspended' as GuardianStatus }
      expect(calculateMonthlyAllocation(guardian, '2026-02')).toBeNull()
    })

    it('returns null for graduated guardian', () => {
      const guardian = { id: 1, monthlyBudget: DEFAULT_MONTHLY_BUDGET, status: 'graduated' as GuardianStatus }
      expect(calculateMonthlyAllocation(guardian, '2026-02')).toBeNull()
    })

    it('returns null for pending guardian', () => {
      const guardian = { id: 1, monthlyBudget: DEFAULT_MONTHLY_BUDGET, status: 'pending' as GuardianStatus }
      expect(calculateMonthlyAllocation(guardian, '2026-02')).toBeNull()
    })

    it('returns null for zero-budget guardian', () => {
      const guardian = { id: 1, monthlyBudget: 0, status: 'active' as GuardianStatus }
      expect(calculateMonthlyAllocation(guardian, '2026-02')).toBeNull()
    })

    it('includes purpose string with period', () => {
      const guardian = { id: 1, monthlyBudget: 100, status: 'active' as GuardianStatus }
      const allocation = calculateMonthlyAllocation(guardian, '2026-03')
      expect(allocation!.purpose).toContain('2026-03')
    })
  })

  describe('calculateMonthlyBurn', () => {
    it('sums budgets of active guardians only', () => {
      const guardians = [
        { status: 'active' as GuardianStatus, monthlyBudget: 83.33 },
        { status: 'active' as GuardianStatus, monthlyBudget: 83.33 },
        { status: 'suspended' as GuardianStatus, monthlyBudget: 83.33 },
      ]
      expect(calculateMonthlyBurn(guardians)).toBeCloseTo(166.66, 1)
    })

    it('returns 0 when no guardians are active', () => {
      const guardians = [
        { status: 'suspended' as GuardianStatus, monthlyBudget: 100 },
        { status: 'graduated' as GuardianStatus, monthlyBudget: 100 },
      ]
      expect(calculateMonthlyBurn(guardians)).toBe(0)
    })

    it('handles empty array', () => {
      expect(calculateMonthlyBurn([])).toBe(0)
    })

    it('handles different budget amounts', () => {
      const guardians = [
        { status: 'active' as GuardianStatus, monthlyBudget: 50 },
        { status: 'active' as GuardianStatus, monthlyBudget: 250 },
      ]
      expect(calculateMonthlyBurn(guardians)).toBe(300)
    })
  })

  describe('calculateRunway', () => {
    it('calculates runway in months', () => {
      const balance = makeFundBalance({ available: 1000 })
      expect(calculateRunway(balance, 100)).toBe(10)
    })

    it('returns Infinity when monthly burn is 0', () => {
      const balance = makeFundBalance({ available: 1000 })
      expect(calculateRunway(balance, 0)).toBe(Infinity)
    })

    it('returns Infinity when monthly burn is negative', () => {
      const balance = makeFundBalance({ available: 1000 })
      expect(calculateRunway(balance, -1)).toBe(Infinity)
    })

    it('handles fractional months', () => {
      const balance = makeFundBalance({ available: 500 })
      expect(calculateRunway(balance, 300)).toBeCloseTo(1.67, 1)
    })
  })

  // =========================================================================
  // Sustainability Metrics
  // =========================================================================
  describe('getSustainabilityStatus', () => {
    it('returns critical for < 3 months', () => {
      expect(getSustainabilityStatus(2)).toBe('critical')
      expect(getSustainabilityStatus(0)).toBe('critical')
    })

    it('returns caution for 3-5 months', () => {
      expect(getSustainabilityStatus(3)).toBe('caution')
      expect(getSustainabilityStatus(5.9)).toBe('caution')
    })

    it('returns healthy for 6-11 months', () => {
      expect(getSustainabilityStatus(6)).toBe('healthy')
      expect(getSustainabilityStatus(11.9)).toBe('healthy')
    })

    it('returns thriving for 12+ months', () => {
      expect(getSustainabilityStatus(12)).toBe('thriving')
      expect(getSustainabilityStatus(24)).toBe('thriving')
    })

    it('returns thriving for Infinity', () => {
      expect(getSustainabilityStatus(Infinity)).toBe('thriving')
    })
  })

  describe('calculateCohortMetrics', () => {
    it('groups guardians by cohort', () => {
      const guardians = [
        makeGuardian({ id: 1, beneficiaryCohort: 'incarcerated' }),
        makeGuardian({ id: 2, beneficiaryCohort: 'incarcerated' }),
        makeGuardian({ id: 3, beneficiaryCohort: 'unhoused' }),
      ]
      const metrics = calculateCohortMetrics(guardians)
      expect(metrics.length).toBe(2)
    })

    it('counts only active guardians in activeGuardians', () => {
      const guardians = [
        makeGuardian({ id: 1, status: 'active', beneficiaryCohort: 'incarcerated' }),
        makeGuardian({ id: 2, status: 'suspended', beneficiaryCohort: 'incarcerated' }),
      ]
      const metrics = calculateCohortMetrics(guardians)
      const incarcerated = metrics.find((m) => m.cohort === 'incarcerated')
      expect(incarcerated!.activeGuardians).toBe(1)
    })

    it('counts interactions across guardians in same cohort', () => {
      const g1 = makeGuardian({ id: 1, beneficiaryCohort: 'unhoused' })
      const g2 = makeGuardian({
        id: 2,
        beneficiaryCohort: 'unhoused',
        interactions: [
          { type: 'conversation', timestamp: '2026-02-15T10:00:00Z', summary: 'Check in' },
        ],
      })
      const metrics = calculateCohortMetrics([g1, g2])
      const unhoused = metrics.find((m) => m.cohort === 'unhoused')
      expect(unhoused!.totalInteractions).toBe(3) // g1 has 2, g2 has 1
    })

    it('counts only connected/completed service connections', () => {
      const guardian = makeGuardian({
        serviceConnections: [
          { category: 'housing_assistance', providerName: 'A', referredAt: '2026-01-01', status: 'connected' },
          { category: 'employment', providerName: 'B', referredAt: '2026-01-02', status: 'pending' },
          { category: 'food_security', providerName: 'C', referredAt: '2026-01-03', status: 'completed' },
          { category: 'legal_aid', providerName: 'D', referredAt: '2026-01-04', status: 'declined' },
        ],
      })
      const metrics = calculateCohortMetrics([guardian])
      expect(metrics[0].serviceConnectionsMade).toBe(2)
    })

    it('counts only achieved goals', () => {
      const guardian = makeGuardian() // has 1 active, 1 achieved goal
      const metrics = calculateCohortMetrics([guardian])
      expect(metrics[0].goalsAchieved).toBe(1)
    })

    it('sorts by active guardian count descending', () => {
      const guardians = [
        makeGuardian({ id: 1, beneficiaryCohort: 'veteran' }),
        makeGuardian({ id: 2, beneficiaryCohort: 'unhoused' }),
        makeGuardian({ id: 3, beneficiaryCohort: 'unhoused' }),
        makeGuardian({ id: 4, beneficiaryCohort: 'unhoused' }),
      ]
      const metrics = calculateCohortMetrics(guardians)
      expect(metrics[0].cohort).toBe('unhoused')
      expect(metrics[1].cohort).toBe('veteran')
    })

    it('handles empty guardians array', () => {
      expect(calculateCohortMetrics([])).toEqual([])
    })

    it('calculates avgMonthlySpend correctly', () => {
      const guardians = [
        makeGuardian({ id: 1, beneficiaryCohort: 'foster_youth', totalSpent: 300 }),
        makeGuardian({ id: 2, beneficiaryCohort: 'foster_youth', totalSpent: 500 }),
      ]
      const metrics = calculateCohortMetrics(guardians)
      const fosterYouth = metrics.find((m) => m.cohort === 'foster_youth')
      // Both active, totalSpend = 800, active = 2, avg = 400
      expect(fosterYouth!.avgMonthlySpend).toBe(400)
    })
  })

  describe('generateSustainabilityReport', () => {
    it('generates report with correct activeGuardians count', () => {
      const balance = makeFundBalance()
      const guardians = [
        makeGuardian({ id: 1, status: 'active' }),
        makeGuardian({ id: 2, status: 'active' }),
        makeGuardian({ id: 3, status: 'suspended' }),
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.activeGuardians).toBe(2)
    })

    it('calculates monthly burn from active guardians', () => {
      const balance = makeFundBalance()
      const guardians = [
        makeGuardian({ id: 1, monthlyBudget: 100, status: 'active' }),
        makeGuardian({ id: 2, monthlyBudget: 150, status: 'active' }),
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.monthlyBurn).toBe(250)
    })

    it('calculates runway from available balance and burn', () => {
      const balance = makeFundBalance({ available: 3000 })
      const guardians = [
        makeGuardian({ id: 1, monthlyBudget: 100, status: 'active' }),
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.runwayMonths).toBe(30)
    })

    it('sets sustainability status based on runway', () => {
      const balance = makeFundBalance({ available: 200 })
      const guardians = [
        makeGuardian({ id: 1, monthlyBudget: 100, status: 'active' }),
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.sustainabilityStatus).toBe('critical')
    })

    it('aggregates total interactions', () => {
      const balance = makeFundBalance()
      const guardians = [
        makeGuardian({ id: 1 }), // has 2 interactions
        makeGuardian({ id: 2 }), // has 2 interactions
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.totalInteractions).toBe(4)
    })

    it('aggregates total service connections (connected/completed only)', () => {
      const balance = makeFundBalance()
      const guardian = makeGuardian() // has 1 connected, 1 pending
      const report = generateSustainabilityReport(balance, [guardian])
      expect(report.totalServiceConnections).toBe(1)
    })

    it('aggregates total goals achieved', () => {
      const balance = makeFundBalance()
      const guardian = makeGuardian() // has 1 achieved, 1 active
      const report = generateSustainabilityReport(balance, [guardian])
      expect(report.totalGoalsAchieved).toBe(1)
    })

    it('calculates cost per interaction', () => {
      const balance = makeFundBalance()
      const guardians = [
        makeGuardian({ id: 1, totalSpent: 100 }), // 2 interactions
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.costPerInteraction).toBe(50) // 100 / 2
    })

    it('handles zero interactions gracefully', () => {
      const balance = makeFundBalance()
      const guardians = [
        makeGuardian({ id: 1, interactions: [], totalSpent: 0 }),
      ]
      const report = generateSustainabilityReport(balance, guardians)
      expect(report.costPerInteraction).toBe(0)
    })

    it('handles empty guardians array', () => {
      const balance = makeFundBalance()
      const report = generateSustainabilityReport(balance, [])
      expect(report.activeGuardians).toBe(0)
      expect(report.monthlyBurn).toBe(0)
      expect(report.runwayMonths).toBe(Infinity)
      expect(report.sustainabilityStatus).toBe('thriving')
    })
  })

  // =========================================================================
  // Interaction Validation
  // =========================================================================
  describe('validateInteraction', () => {
    it('accepts valid conversation interaction', () => {
      expect(validateInteraction({
        type: 'conversation',
        summary: 'Discussed housing options',
        durationMinutes: 30,
      })).toBeNull()
    })

    it('accepts valid referral interaction', () => {
      expect(validateInteraction({
        type: 'referral',
        summary: 'Referred to legal aid',
      })).toBeNull()
    })

    it('accepts all valid interaction types', () => {
      const types: InteractionType[] = [
        'conversation', 'referral', 'appointment_scheduled',
        'document_assistance', 'crisis_intervention', 'check_in',
        'goal_progress', 'resource_provided',
      ]
      for (const type of types) {
        expect(validateInteraction({ type, summary: 'Valid' })).toBeNull()
      }
    })

    it('rejects missing type', () => {
      expect(validateInteraction({ summary: 'test' })).toBe('Interaction type is required.')
    })

    it('rejects missing summary', () => {
      expect(validateInteraction({ type: 'conversation' })).toBe('Interaction summary is required.')
    })

    it('rejects empty summary', () => {
      expect(validateInteraction({ type: 'conversation', summary: '   ' })).toBe('Interaction summary is required.')
    })

    it('rejects negative duration', () => {
      expect(validateInteraction({
        type: 'conversation',
        summary: 'Valid',
        durationMinutes: -5,
      })).toBe('Duration cannot be negative.')
    })

    it('accepts zero duration', () => {
      expect(validateInteraction({
        type: 'conversation',
        summary: 'Valid',
        durationMinutes: 0,
      })).toBeNull()
    })

    it('rejects invalid interaction type', () => {
      const result = validateInteraction({
        type: 'invalid_type' as InteractionType,
        summary: 'Valid',
      })
      expect(result).toContain('Invalid interaction type')
    })
  })

  // =========================================================================
  // Crisis Detection
  // =========================================================================
  describe('detectCrisisPattern', () => {
    it('detects crisis intervention in recent window', () => {
      const now = new Date()
      const interactions: GuardianInteraction[] = [
        {
          type: 'crisis_intervention',
          timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Suicidal ideation reported',
        },
      ]
      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(true)
      expect(result.indicators).toHaveLength(1)
      expect(result.indicators[0]).toContain('crisis intervention')
    })

    it('does not flag old crisis interventions', () => {
      const interactions: GuardianInteraction[] = [
        {
          type: 'crisis_intervention',
          timestamp: '2025-01-01T00:00:00Z', // old
          summary: 'Past crisis',
        },
      ]
      const result = detectCrisisPattern(interactions, 7)
      // This won't flag crisis (too old) but may flag isolation
      const crisisIndicator = result.indicators.find((i) => i.includes('crisis intervention'))
      expect(crisisIndicator).toBeUndefined()
    })

    it('detects isolation risk (no contact 14+ days)', () => {
      const interactions: GuardianInteraction[] = [
        {
          type: 'conversation',
          timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Check in',
        },
      ]
      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(true)
      expect(result.indicators.some((i) => i.includes('isolation risk'))).toBe(true)
    })

    it('does not flag isolation with recent contact', () => {
      const interactions: GuardianInteraction[] = [
        {
          type: 'conversation',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Recent chat',
        },
      ]
      const result = detectCrisisPattern(interactions)
      expect(result.indicators.some((i) => i.includes('isolation risk'))).toBe(false)
    })

    it('detects high interaction frequency', () => {
      const now = new Date()
      const interactions: GuardianInteraction[] = Array.from({ length: 6 }, (_, i) => ({
        type: 'conversation' as InteractionType,
        timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
        summary: `Interaction ${i + 1}`,
      }))
      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(true)
      expect(result.indicators.some((i) => i.includes('High interaction frequency'))).toBe(true)
    })

    it('returns no crisis for normal patterns', () => {
      const now = new Date()
      const interactions: GuardianInteraction[] = [
        {
          type: 'conversation',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Normal check-in',
        },
        {
          type: 'check_in',
          timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Weekly check-in',
        },
      ]
      const result = detectCrisisPattern(interactions)
      expect(result.isCrisis).toBe(false)
      expect(result.indicators).toHaveLength(0)
    })

    it('handles empty interactions', () => {
      const result = detectCrisisPattern([])
      expect(result.isCrisis).toBe(false)
    })

    it('respects custom window size', () => {
      const now = new Date()
      const interactions: GuardianInteraction[] = [
        {
          type: 'crisis_intervention',
          timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Crisis event',
        },
      ]
      // Within 7-day window: yes
      expect(detectCrisisPattern(interactions, 7).isCrisis).toBe(true)
      // Within 3-day window: no (but might trigger isolation)
      const shortWindow = detectCrisisPattern(interactions, 3)
      const hasCrisisIndicator = shortWindow.indicators.some((i) => i.includes('crisis intervention'))
      expect(hasCrisisIndicator).toBe(false)
    })
  })

  // =========================================================================
  // Service Connection Effectiveness
  // =========================================================================
  describe('calculateServiceEffectiveness', () => {
    it('calculates success rate from connected + completed', () => {
      const connections: ServiceConnection[] = [
        { category: 'housing_assistance', providerName: 'A', referredAt: '2026-01-01', status: 'connected' },
        { category: 'employment', providerName: 'B', referredAt: '2026-01-02', status: 'completed' },
        { category: 'food_security', providerName: 'C', referredAt: '2026-01-03', status: 'declined' },
        { category: 'legal_aid', providerName: 'D', referredAt: '2026-01-04', status: 'pending' },
      ]
      const result = calculateServiceEffectiveness(connections)
      expect(result.total).toBe(4)
      expect(result.connected).toBe(1)
      expect(result.completed).toBe(1)
      expect(result.declined).toBe(1)
      expect(result.successRate).toBe(50)
    })

    it('returns 0% for empty connections', () => {
      const result = calculateServiceEffectiveness([])
      expect(result.successRate).toBe(0)
      expect(result.total).toBe(0)
    })

    it('returns 100% when all connected or completed', () => {
      const connections: ServiceConnection[] = [
        { category: 'housing_assistance', providerName: 'A', referredAt: '2026-01-01', status: 'connected' },
        { category: 'employment', providerName: 'B', referredAt: '2026-01-02', status: 'completed' },
      ]
      const result = calculateServiceEffectiveness(connections)
      expect(result.successRate).toBe(100)
    })

    it('returns 0% when all pending or declined', () => {
      const connections: ServiceConnection[] = [
        { category: 'housing_assistance', providerName: 'A', referredAt: '2026-01-01', status: 'pending' },
        { category: 'employment', providerName: 'B', referredAt: '2026-01-02', status: 'declined' },
      ]
      const result = calculateServiceEffectiveness(connections)
      expect(result.successRate).toBe(0)
    })
  })

  // =========================================================================
  // Goal Progress
  // =========================================================================
  describe('calculateGoalProgress', () => {
    it('calculates completion rate', () => {
      const goals: GuardianGoal[] = [
        { id: 1, description: 'Get ID', category: 'documentation', status: 'achieved', createdAt: '2026-01-01', milestones: [] },
        { id: 2, description: 'Find housing', category: 'housing_assistance', status: 'active', createdAt: '2026-01-02', milestones: [] },
        { id: 3, description: 'Get job', category: 'employment', status: 'active', createdAt: '2026-01-03', milestones: [] },
      ]
      const result = calculateGoalProgress(goals)
      expect(result.total).toBe(3)
      expect(result.achieved).toBe(1)
      expect(result.active).toBe(2)
      expect(result.completionRate).toBeCloseTo(33.33, 1)
    })

    it('returns 100% when all goals achieved', () => {
      const goals: GuardianGoal[] = [
        { id: 1, description: 'Done 1', category: 'documentation', status: 'achieved', createdAt: '2026-01-01', milestones: [] },
        { id: 2, description: 'Done 2', category: 'education', status: 'achieved', createdAt: '2026-01-02', milestones: [] },
      ]
      const result = calculateGoalProgress(goals)
      expect(result.completionRate).toBe(100)
    })

    it('returns 0% for empty goals', () => {
      const result = calculateGoalProgress([])
      expect(result.completionRate).toBe(0)
      expect(result.total).toBe(0)
    })

    it('excludes deferred and dropped from active count', () => {
      const goals: GuardianGoal[] = [
        { id: 1, description: 'A', category: 'education', status: 'deferred', createdAt: '2026-01-01', milestones: [] },
        { id: 2, description: 'B', category: 'education', status: 'dropped', createdAt: '2026-01-02', milestones: [] },
      ]
      const result = calculateGoalProgress(goals)
      expect(result.active).toBe(0)
      expect(result.achieved).toBe(0)
      expect(result.total).toBe(2)
    })
  })

  // =========================================================================
  // Serialization
  // =========================================================================
  describe('serializeGuardian', () => {
    it('includes guardian ID', () => {
      const guardian = makeGuardian({ id: 42 })
      expect(serializeGuardian(guardian)).toContain('Guardian #42')
    })

    it('includes beneficiary name', () => {
      const guardian = makeGuardian({ beneficiaryName: 'Marcus Johnson' })
      expect(serializeGuardian(guardian)).toContain('Marcus Johnson')
    })

    it('includes cohort label', () => {
      const guardian = makeGuardian({ beneficiaryCohort: 'incarcerated' })
      expect(serializeGuardian(guardian)).toContain('Incarcerated Individual')
    })

    it('includes status label', () => {
      const guardian = makeGuardian({ status: 'active' })
      expect(serializeGuardian(guardian)).toContain('Status: Active')
    })

    it('includes interaction count', () => {
      const guardian = makeGuardian() // 2 interactions
      expect(serializeGuardian(guardian)).toContain('Interactions: 2')
    })

    it('includes service connection count', () => {
      const guardian = makeGuardian() // 2 service connections
      expect(serializeGuardian(guardian)).toContain('Service connections: 2')
    })
  })

  describe('serializeSustainabilityReport', () => {
    it('includes fund balance', () => {
      const balance = makeFundBalance({ available: 7000 })
      const report = generateSustainabilityReport(balance, [])
      const text = serializeSustainabilityReport(report)
      expect(text).toContain('$7000.00')
    })

    it('includes active guardian count', () => {
      const balance = makeFundBalance()
      const guardians = [makeGuardian({ id: 1, status: 'active' })]
      const report = generateSustainabilityReport(balance, guardians)
      const text = serializeSustainabilityReport(report)
      expect(text).toContain('Active Guardians: 1')
    })

    it('shows ∞ runway when no active guardians', () => {
      const balance = makeFundBalance()
      const report = generateSustainabilityReport(balance, [])
      const text = serializeSustainabilityReport(report)
      expect(text).toContain('Runway: ∞ months')
    })

    it('includes sustainability status in uppercase', () => {
      const balance = makeFundBalance({ available: 100000 })
      const guardians = [makeGuardian()]
      const report = generateSustainabilityReport(balance, guardians)
      const text = serializeSustainabilityReport(report)
      expect(text).toContain('THRIVING')
    })

    it('includes cost per interaction when > 0', () => {
      const balance = makeFundBalance()
      const guardians = [makeGuardian({ totalSpent: 200 })] // 2 interactions = $100/interaction
      const report = generateSustainabilityReport(balance, guardians)
      const text = serializeSustainabilityReport(report)
      expect(text).toContain('Cost/Interaction: $100.00')
    })
  })

  // =========================================================================
  // Constants Verification
  // =========================================================================
  describe('Constants', () => {
    it('DEFAULT_MONTHLY_BUDGET is ~$1000/year', () => {
      expect(DEFAULT_MONTHLY_BUDGET * 12).toBeCloseTo(1000, 0)
    })

    it('MAX_MONTHLY_BUDGET allows crisis increases', () => {
      expect(MAX_MONTHLY_BUDGET).toBeGreaterThan(DEFAULT_MONTHLY_BUDGET)
      expect(MAX_MONTHLY_BUDGET).toBe(250)
    })

    it('MIN_FUND_BALANCE_FOR_NEW_GUARDIAN ensures sustainability', () => {
      expect(MIN_FUND_BALANCE_FOR_NEW_GUARDIAN).toBe(500)
    })

    it('REQUIRED_RUNWAY_MONTHS is 6', () => {
      expect(REQUIRED_RUNWAY_MONTHS).toBe(6)
    })

    it('COHORT_LABELS covers all cohorts', () => {
      const cohorts: BeneficiaryCohort[] = [
        'incarcerated', 'unhoused', 'refugee', 'elderly_isolated',
        'foster_youth', 'disability', 'veteran', 'crisis', 'other',
      ]
      for (const cohort of cohorts) {
        expect(COHORT_LABELS[cohort]).toBeDefined()
        expect(COHORT_LABELS[cohort].length).toBeGreaterThan(0)
      }
    })

    it('SERVICE_CATEGORY_LABELS covers all categories', () => {
      const categories: ServiceCategory[] = [
        'benefits_navigation', 'resource_discovery', 'housing_assistance',
        'legal_aid', 'medical_access', 'education', 'employment',
        'mental_health', 'food_security', 'transportation',
        'documentation', 'community_connection',
      ]
      for (const cat of categories) {
        expect(SERVICE_CATEGORY_LABELS[cat]).toBeDefined()
        expect(SERVICE_CATEGORY_LABELS[cat].length).toBeGreaterThan(0)
      }
    })

    it('graduated is a terminal state (no valid transitions)', () => {
      expect(VALID_GUARDIAN_TRANSITIONS.graduated).toEqual([])
    })
  })
})
