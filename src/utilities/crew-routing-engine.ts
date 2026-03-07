/**
 * Crew Routing Engine — Sprint 40
 *
 * Intra-ship work dispatch. Once the Workload Engine routes a WorkUnit to
 * a federation node (Endeavor), this engine routes it to the right crew
 * member within that Endeavor.
 *
 * Naval metaphor: The Workload Engine is fleet command — picks the ship.
 * The Crew Routing Engine is the First Officer — assigns the watch stander.
 *
 * Scoring weights (35/25/20/15/5):
 * - Skill match:       35% (capabilities vs requirements)
 * - Department fit:     25% (work type → department mapping)
 * - Duty status:        20% (active_duty > reserve > shore_leave)
 * - Current load:       15% (prefer crew with fewer active assignments)
 * - Pheromone bonus:     5% (learned reliability from past assignments)
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/collections/CrewAssignments/index.ts — crew roster
 * @see src/utilities/workload-engine.ts — node-level routing
 * @see src/utilities/pheromone-engine.ts — swarm learning
 */

import type { WorkType } from './workload-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Department =
  | 'bridge'
  | 'engineering'
  | 'operations'
  | 'science'
  | 'communications'
  | 'medical'
  | 'security'
  | 'logistics'

export type Rank =
  | 'captain'
  | 'commander'
  | 'lt_commander'
  | 'lieutenant'
  | 'ensign'
  | 'specialist'
  | 'cadet'

export type DutyStatus = 'active_duty' | 'shore_leave' | 'detached' | 'reserve'
export type WatchSection = 'alpha' | 'beta' | 'gamma' | 'delta'

export type SkillProficiency = 'expert' | 'proficient' | 'learning'

export interface CrewCapability {
  skill: string
  proficiency: SkillProficiency
}

/** A crew member's assignment profile — hydrated from CrewAssignments collection. */
export interface CrewMember {
  id: string | number
  membershipId: string | number
  department: Department
  station: string
  rank: Rank
  dutyStatus: DutyStatus
  watchSection?: WatchSection
  capabilities: CrewCapability[]
  activeWorkUnits: number
  completedCount: number
  failedCount: number
}

/** Scored crew candidate. */
export interface CrewMatch {
  crew: CrewMember
  skillScore: number
  departmentScore: number
  dutyScore: number
  loadScore: number
  pheromoneBonus: number
  totalScore: number
}

/** Pheromone hint for crew-level routing (from pheromone grid). */
export interface CrewPheromoneHint {
  crewId: string | number
  successfulAssignments: number
  abandonments: number
  strength: number
}

/** The work requirements relevant to crew routing. */
export interface CrewWorkRequirements {
  workType: WorkType
  requiredSkills: string[]
  preferredDepartment?: Department
}

/** Crew routing decision. */
export interface CrewRoutingDecision {
  selectedCrew: CrewMatch | null
  alternates: CrewMatch[]
  routedAt: string
  routingTimeMs: number
  noEligible: boolean
  reason?: string
}

// ---------------------------------------------------------------------------
// Constants — The DNA of the Crew Colony
// ---------------------------------------------------------------------------

/** Scoring weights for crew ranking (sum = 1.0). */
export const CREW_WEIGHTS = {
  skill: 0.35,
  department: 0.25,
  duty: 0.20,
  load: 0.15,
  pheromone: 0.05,
} as const

/** Maps WorkUnit types to their best-fit departments. */
export const WORK_TYPE_DEPARTMENT_MAP: Record<WorkType, Department[]> = {
  computation: ['engineering', 'science'],
  analysis: ['science', 'engineering', 'bridge'],
  generation: ['communications', 'engineering'],
  transformation: ['engineering', 'operations'],
  aggregation: ['science', 'operations', 'bridge'],
}

/** Duty status eligibility scores (0-1). */
const DUTY_SCORES: Record<DutyStatus, number> = {
  active_duty: 1.0,
  reserve: 0.5,
  shore_leave: 0.15,
  detached: 0.0,
}

/** Proficiency multipliers for skill matching. */
const PROFICIENCY_MULTIPLIERS: Record<SkillProficiency, number> = {
  expert: 1.0,
  proficient: 0.7,
  learning: 0.3,
}

/** Rank seniority for tiebreaking (higher = more senior, used as micro-bonus). */
const RANK_SENIORITY: Record<Rank, number> = {
  captain: 7,
  commander: 6,
  lt_commander: 5,
  lieutenant: 4,
  ensign: 3,
  specialist: 2,
  cadet: 1,
}

// ---------------------------------------------------------------------------
// Scoring Functions
// ---------------------------------------------------------------------------

/**
 * Score skill match (0-1). Measures how well a crew member's capabilities
 * match the work requirements. An expert match = 1.0 per skill.
 */
export function scoreSkillMatch(crew: CrewMember, requirements: CrewWorkRequirements): number {
  if (requirements.requiredSkills.length === 0) return 0.5 // neutral when no skills required

  let totalScore = 0
  for (const required of requirements.requiredSkills) {
    const match = crew.capabilities.find(
      (c) => c.skill.toLowerCase() === required.toLowerCase(),
    )
    if (match) {
      totalScore += PROFICIENCY_MULTIPLIERS[match.proficiency]
    }
  }

  return Math.min(1, totalScore / requirements.requiredSkills.length)
}

/**
 * Score department fit (0-1). Measures whether the crew member's department
 * aligns with the work type.
 */
export function scoreDepartmentFit(crew: CrewMember, requirements: CrewWorkRequirements): number {
  // Explicit department preference takes priority
  if (requirements.preferredDepartment) {
    return crew.department === requirements.preferredDepartment ? 1.0 : 0.2
  }

  // Map work type to suitable departments
  const suitableDepts = WORK_TYPE_DEPARTMENT_MAP[requirements.workType] || []
  const idx = suitableDepts.indexOf(crew.department)
  if (idx === -1) return 0.1 // not a natural fit, but not excluded
  // First department in list is best fit, decreasing with position
  return 1.0 - idx * 0.2
}

/**
 * Score duty status (0-1). Active duty crew are preferred.
 * Detached crew are ineligible (score = 0).
 */
export function scoreDutyStatus(crew: CrewMember): number {
  return DUTY_SCORES[crew.dutyStatus] ?? 0
}

/**
 * Score load capacity (0-1). Crew with fewer active work units score higher.
 * Assumes a soft cap of 5 concurrent tasks per person.
 */
export function scoreLoadCapacity(crew: CrewMember, maxConcurrent: number = 5): number {
  if (crew.activeWorkUnits >= maxConcurrent) return 0
  return 1 - crew.activeWorkUnits / maxConcurrent
}

/**
 * Calculate pheromone bonus (0-1). Based on learned dispatch success trails.
 */
export function scorePheromone(
  crew: CrewMember,
  pheromoneHints: CrewPheromoneHint[],
): number {
  const hint = pheromoneHints.find((h) => String(h.crewId) === String(crew.id))
  if (!hint) return 0
  return Math.min(1, hint.strength / 100)
}

// ---------------------------------------------------------------------------
// Core Routing
// ---------------------------------------------------------------------------

/** Options for crew routing. */
export interface CrewRoutingOptions {
  maxConcurrentPerCrew?: number
  maxAlternates?: number
  activeWatchSection?: WatchSection
}

/**
 * Route a work unit to the best crew member within an Endeavor.
 *
 * Algorithm:
 * 1. Filter eligible crew (duty != detached, under load cap)
 * 2. Optionally prefer crew on active watch section
 * 3. Score each candidate on 5 dimensions
 * 4. Rank by total weighted score
 * 5. Return top match + alternates
 */
export function routeToCrewMember(
  requirements: CrewWorkRequirements,
  crew: CrewMember[],
  pheromoneHints: CrewPheromoneHint[] = [],
  options: CrewRoutingOptions = {},
): CrewRoutingDecision {
  const startMs = Date.now()
  const maxConcurrent = options.maxConcurrentPerCrew ?? 5
  const maxAlternates = options.maxAlternates ?? 3

  // 1. Filter eligible crew
  const eligible = crew.filter((c) => {
    if (c.dutyStatus === 'detached') return false
    if (c.activeWorkUnits >= maxConcurrent) return false
    return true
  })

  if (eligible.length === 0) {
    return {
      selectedCrew: null,
      alternates: [],
      routedAt: new Date().toISOString(),
      routingTimeMs: Date.now() - startMs,
      noEligible: true,
      reason: `No eligible crew (${crew.length} total, all detached or at capacity)`,
    }
  }

  // 2. Score each candidate
  const scored: CrewMatch[] = eligible.map((member) => {
    const skillScore = scoreSkillMatch(member, requirements)
    const departmentScore = scoreDepartmentFit(member, requirements)
    const dutyScore = scoreDutyStatus(member)
    const loadScore = scoreLoadCapacity(member, maxConcurrent)
    const pheromoneBonus = scorePheromone(member, pheromoneHints)

    const totalScore =
      skillScore * CREW_WEIGHTS.skill +
      departmentScore * CREW_WEIGHTS.department +
      dutyScore * CREW_WEIGHTS.duty +
      loadScore * CREW_WEIGHTS.load +
      pheromoneBonus * CREW_WEIGHTS.pheromone

    return {
      crew: member,
      skillScore,
      departmentScore,
      dutyScore,
      loadScore,
      pheromoneBonus,
      totalScore,
    }
  })

  // 3. Sort by total score, then by rank seniority as tiebreaker
  scored.sort((a, b) => {
    if (Math.abs(b.totalScore - a.totalScore) > 0.001) {
      return b.totalScore - a.totalScore
    }
    return (RANK_SENIORITY[b.crew.rank] ?? 0) - (RANK_SENIORITY[a.crew.rank] ?? 0)
  })

  // 4. Prefer active watch section (boost, don't exclude)
  if (options.activeWatchSection) {
    const watchBoosted = scored.map((match) => {
      const isOnWatch = match.crew.watchSection === options.activeWatchSection
      return {
        ...match,
        totalScore: isOnWatch ? match.totalScore * 1.1 : match.totalScore,
      }
    })
    watchBoosted.sort((a, b) => b.totalScore - a.totalScore)
    const selected = watchBoosted[0] ?? null
    return {
      selectedCrew: selected,
      alternates: watchBoosted.slice(1, 1 + maxAlternates),
      routedAt: new Date().toISOString(),
      routingTimeMs: Date.now() - startMs,
      noEligible: false,
    }
  }

  return {
    selectedCrew: scored[0] ?? null,
    alternates: scored.slice(1, 1 + maxAlternates),
    routedAt: new Date().toISOString(),
    routingTimeMs: Date.now() - startMs,
    noEligible: false,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the primary department for a work type.
 * Useful for quick department assignment without full routing.
 */
export function getPrimaryDepartment(workType: WorkType): Department {
  return WORK_TYPE_DEPARTMENT_MAP[workType]?.[0] ?? 'operations'
}

/**
 * Build a crew capability summary for display.
 */
export function buildCrewSummary(crew: CrewMember[]): Record<Department, number> {
  const summary: Record<string, number> = {}
  for (const member of crew) {
    if (member.dutyStatus !== 'detached') {
      summary[member.department] = (summary[member.department] || 0) + 1
    }
  }
  return summary as Record<Department, number>
}

/**
 * Check if an Endeavor has minimum viable crew (at least one active bridge member).
 */
export function hasMinimumCrew(crew: CrewMember[]): boolean {
  return crew.some(
    (c) => c.department === 'bridge' && c.dutyStatus === 'active_duty',
  )
}
