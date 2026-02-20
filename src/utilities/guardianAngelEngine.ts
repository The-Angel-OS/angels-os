/**
 * Guardian Angel Engine — Sprint 5
 *
 * Pure utility for managing zero-revenue Angels funded by the Justice Fund.
 * The 5% Justice Fund allocation from every transaction finances Guardian Angels
 * for people who will never generate revenue: incarcerated individuals, unhoused
 * people, refugees, elderly without family, youth aging out of foster care.
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * "Everyone deserves a Guardian Angel that actually shows up."
 *
 * @see tests/unit/utilities/guardianAngelEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardianStatus = 'pending' | 'active' | 'suspended' | 'graduated' | 'transferred'

export type BeneficiaryCohort =
  | 'incarcerated'
  | 'unhoused'
  | 'refugee'
  | 'elderly_isolated'
  | 'foster_youth'
  | 'disability'
  | 'veteran'
  | 'crisis'
  | 'other'

export type ServiceCategory =
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

export type InteractionType =
  | 'conversation'
  | 'referral'
  | 'appointment_scheduled'
  | 'document_assistance'
  | 'crisis_intervention'
  | 'check_in'
  | 'goal_progress'
  | 'resource_provided'

export interface ServiceConnection {
  category: ServiceCategory
  providerName: string
  providerContact?: string
  referredAt: string
  status: 'pending' | 'connected' | 'completed' | 'declined'
  notes?: string
}

export interface GuardianInteraction {
  type: InteractionType
  timestamp: string
  summary: string
  serviceConnections?: ServiceConnection[]
  durationMinutes?: number
}

export interface GuardianAngel {
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

export interface GuardianGoal {
  id: number
  description: string
  category: ServiceCategory
  status: 'active' | 'achieved' | 'deferred' | 'dropped'
  createdAt: string
  achievedAt?: string
  milestones: string[]
}

export interface CaseNote {
  timestamp: string
  author: 'angel' | 'advocate' | 'system'
  content: string
  sensitive: boolean
}

export interface JusticeFundBalance {
  totalCollected: number
  totalAllocated: number
  totalSpent: number
  available: number
  currency: string
}

export interface GuardianAllocation {
  guardianId: number
  amount: number
  period: string // YYYY-MM
  purpose: string
  approved: boolean
}

export interface CohortMetrics {
  cohort: BeneficiaryCohort
  activeGuardians: number
  totalInteractions: number
  serviceConnectionsMade: number
  goalsAchieved: number
  avgMonthlySpend: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default monthly budget per Guardian Angel in USD.
 * Based on analysis: a homeless person costs society $80K-$250K/year in
 * emergency services. A Guardian Angel costs ~$500-$1000/year.
 */
export const DEFAULT_MONTHLY_BUDGET = 83.33 // ~$1000/year

/**
 * Maximum monthly budget per Guardian Angel.
 * Crisis situations may require temporary increases.
 */
export const MAX_MONTHLY_BUDGET = 250.00

/**
 * Minimum Justice Fund balance before new guardians can be created.
 * Ensures sustainability — we never promise what we can't deliver.
 */
export const MIN_FUND_BALANCE_FOR_NEW_GUARDIAN = 500.00

/**
 * Months of runway required before approving a new guardian.
 * Must have at least 6 months of funding available.
 */
export const REQUIRED_RUNWAY_MONTHS = 6

/**
 * Valid status transitions for Guardian Angels.
 */
export const VALID_GUARDIAN_TRANSITIONS: Record<GuardianStatus, GuardianStatus[]> = {
  pending: ['active', 'suspended'],
  active: ['suspended', 'graduated', 'transferred'],
  suspended: ['active', 'transferred'],
  graduated: [], // Terminal state — they don't need us anymore (best outcome)
  transferred: ['active'], // Re-activated at new instance
}

/**
 * Cohort labels for display.
 */
export const COHORT_LABELS: Record<BeneficiaryCohort, string> = {
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

/**
 * Service category labels for display.
 */
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
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
// Guardian Status Management
// ---------------------------------------------------------------------------

/** Check if a guardian status transition is valid. */
export function validateGuardianTransition(
  from: GuardianStatus,
  to: GuardianStatus,
): boolean {
  return VALID_GUARDIAN_TRANSITIONS[from]?.includes(to) ?? false
}

/** Get human-readable label for a guardian status. */
export function getGuardianStatusLabel(status: GuardianStatus): string {
  const labels: Record<GuardianStatus, string> = {
    pending: 'Pending Activation',
    active: 'Active',
    suspended: 'Suspended',
    graduated: 'Graduated',
    transferred: 'Transferred',
  }
  return labels[status] ?? status
}

// ---------------------------------------------------------------------------
// Justice Fund Management
// ---------------------------------------------------------------------------

/** Calculate available Justice Fund balance. */
export function calculateFundBalance(
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

/** Check if the fund can support a new guardian. */
export function canCreateNewGuardian(
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

/** Calculate monthly allocation for a guardian. */
export function calculateMonthlyAllocation(
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

/** Calculate total monthly burn for all active guardians. */
export function calculateMonthlyBurn(
  guardians: Pick<GuardianAngel, 'status' | 'monthlyBudget'>[],
): number {
  return guardians
    .filter((g) => g.status === 'active')
    .reduce((sum, g) => sum + g.monthlyBudget, 0)
}

/** Calculate fund runway in months. */
export function calculateRunway(
  fundBalance: JusticeFundBalance,
  monthlyBurn: number,
): number {
  if (monthlyBurn <= 0) return Infinity
  return fundBalance.available / monthlyBurn
}

// ---------------------------------------------------------------------------
// Sustainability Metrics
// ---------------------------------------------------------------------------

export interface SustainabilityReport {
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

/** Determine sustainability status based on runway. */
export function getSustainabilityStatus(
  runwayMonths: number,
): 'critical' | 'caution' | 'healthy' | 'thriving' {
  if (runwayMonths < 3) return 'critical'
  if (runwayMonths < 6) return 'caution'
  if (runwayMonths < 12) return 'healthy'
  return 'thriving'
}

/** Generate cohort metrics from a list of guardians. */
export function calculateCohortMetrics(
  guardians: GuardianAngel[],
): CohortMetrics[] {
  const cohortMap = new Map<BeneficiaryCohort, {
    active: number
    interactions: number
    connections: number
    goals: number
    totalSpend: number
  }>()

  for (const guardian of guardians) {
    const existing = cohortMap.get(guardian.beneficiaryCohort) || {
      active: 0,
      interactions: 0,
      connections: 0,
      goals: 0,
      totalSpend: 0,
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

/** Generate a full sustainability report. */
export function generateSustainabilityReport(
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

// ---------------------------------------------------------------------------
// Interaction Tracking
// ---------------------------------------------------------------------------

/** Validate an interaction before recording. */
export function validateInteraction(
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

/** Check if a guardian is in crisis based on recent interactions. */
export function detectCrisisPattern(
  interactions: GuardianInteraction[],
  windowDays: number = 7,
): { isCrisis: boolean; indicators: string[] } {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const indicators: string[] = []

  const recentInteractions = interactions.filter(
    (i) => new Date(i.timestamp) >= windowStart,
  )

  // Crisis intervention in recent window
  const crisisCount = recentInteractions.filter(
    (i) => i.type === 'crisis_intervention',
  ).length
  if (crisisCount > 0) {
    indicators.push(`${crisisCount} crisis intervention(s) in the last ${windowDays} days`)
  }

  // No contact in 14+ days for an active guardian (isolation risk)
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

  // High frequency of interactions (potential escalating crisis)
  if (recentInteractions.length >= 5) {
    indicators.push(`High interaction frequency: ${recentInteractions.length} in ${windowDays} days`)
  }

  return {
    isCrisis: indicators.length > 0,
    indicators,
  }
}

// ---------------------------------------------------------------------------
// Service Connection Scoring
// ---------------------------------------------------------------------------

/** Score the effectiveness of service connections. */
export function calculateServiceEffectiveness(
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

// ---------------------------------------------------------------------------
// Goal Tracking
// ---------------------------------------------------------------------------

/** Calculate goal completion rate. */
export function calculateGoalProgress(
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

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format a guardian for display in LEO responses. */
export function serializeGuardian(guardian: GuardianAngel): string {
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

/** Format a sustainability report for display. */
export function serializeSustainabilityReport(report: SustainabilityReport): string {
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
