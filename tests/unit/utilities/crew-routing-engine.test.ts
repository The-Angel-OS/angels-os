/**
 * crew-routing-engine — Unit Tests
 *
 * Pure functions: scoreSkillMatch, scoreDepartmentFit, scoreDutyStatus,
 * scoreLoadCapacity, scorePheromone, routeToCrewMember, getPrimaryDepartment,
 * buildCrewSummary, hasMinimumCrew
 *
 * Constants: CREW_WEIGHTS, WORK_TYPE_DEPARTMENT_MAP
 *
 * Sprint 40: Endeavor Crews — Intra-Ship Work Dispatch
 */
import { describe, it, expect } from 'vitest'

import {
  scoreSkillMatch,
  scoreDepartmentFit,
  scoreDutyStatus,
  scoreLoadCapacity,
  scorePheromone,
  routeToCrewMember,
  getPrimaryDepartment,
  buildCrewSummary,
  hasMinimumCrew,
  CREW_WEIGHTS,
  WORK_TYPE_DEPARTMENT_MAP,
  type CrewMember,
  type CrewPheromoneHint,
  type CrewWorkRequirements,
  type CrewRoutingDecision,
} from '@/utilities/crew-routing-engine'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCrew(overrides: Partial<CrewMember> = {}): CrewMember {
  return {
    id: 'crew_1',
    membershipId: 'mem_1',
    department: 'engineering',
    station: 'Chief Engineer',
    rank: 'commander',
    dutyStatus: 'active_duty',
    capabilities: [
      { skill: 'computation', proficiency: 'expert' },
      { skill: 'analysis', proficiency: 'proficient' },
    ],
    activeWorkUnits: 0,
    completedCount: 50,
    failedCount: 2,
    ...overrides,
  }
}

function makeRequirements(overrides: Partial<CrewWorkRequirements> = {}): CrewWorkRequirements {
  return {
    workType: 'computation',
    requiredSkills: ['computation'],
    ...overrides,
  }
}

// ── CREW_WEIGHTS constant ──────────────────────────────────────────────────

describe('CREW_WEIGHTS', () => {
  it('weights sum to 1.0', () => {
    const sum =
      CREW_WEIGHTS.skill +
      CREW_WEIGHTS.department +
      CREW_WEIGHTS.duty +
      CREW_WEIGHTS.load +
      CREW_WEIGHTS.pheromone
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('skill has highest weight (0.35)', () => {
    expect(CREW_WEIGHTS.skill).toBe(0.35)
  })

  it('pheromone has lowest weight (0.05)', () => {
    expect(CREW_WEIGHTS.pheromone).toBe(0.05)
  })
})

// ── WORK_TYPE_DEPARTMENT_MAP ───────────────────────────────────────────────

describe('WORK_TYPE_DEPARTMENT_MAP', () => {
  it('covers all 5 work types', () => {
    const types = Object.keys(WORK_TYPE_DEPARTMENT_MAP)
    expect(types).toContain('computation')
    expect(types).toContain('analysis')
    expect(types).toContain('generation')
    expect(types).toContain('transformation')
    expect(types).toContain('aggregation')
    expect(types).toHaveLength(5)
  })

  it('each work type maps to at least one department', () => {
    for (const [type, depts] of Object.entries(WORK_TYPE_DEPARTMENT_MAP)) {
      expect(depts.length).toBeGreaterThan(0)
    }
  })

  it('computation maps to engineering first', () => {
    expect(WORK_TYPE_DEPARTMENT_MAP.computation[0]).toBe('engineering')
  })
})

// ── scoreSkillMatch ────────────────────────────────────────────────────────

describe('scoreSkillMatch', () => {
  it('returns 0.5 when no skills are required', () => {
    const crew = makeCrew()
    const reqs = makeRequirements({ requiredSkills: [] })
    expect(scoreSkillMatch(crew, reqs)).toBe(0.5)
  })

  it('returns 1.0 for expert match on single skill', () => {
    const crew = makeCrew({
      capabilities: [{ skill: 'computation', proficiency: 'expert' }],
    })
    const reqs = makeRequirements({ requiredSkills: ['computation'] })
    expect(scoreSkillMatch(crew, reqs)).toBe(1.0)
  })

  it('returns 0.7 for proficient match', () => {
    const crew = makeCrew({
      capabilities: [{ skill: 'analysis', proficiency: 'proficient' }],
    })
    const reqs = makeRequirements({ requiredSkills: ['analysis'] })
    expect(scoreSkillMatch(crew, reqs)).toBeCloseTo(0.7)
  })

  it('returns 0.3 for learning match', () => {
    const crew = makeCrew({
      capabilities: [{ skill: 'generation', proficiency: 'learning' }],
    })
    const reqs = makeRequirements({ requiredSkills: ['generation'] })
    expect(scoreSkillMatch(crew, reqs)).toBeCloseTo(0.3)
  })

  it('returns 0 when crew has no matching skills', () => {
    const crew = makeCrew({
      capabilities: [{ skill: 'cooking', proficiency: 'expert' }],
    })
    const reqs = makeRequirements({ requiredSkills: ['computation'] })
    expect(scoreSkillMatch(crew, reqs)).toBe(0)
  })

  it('averages multiple required skills', () => {
    const crew = makeCrew({
      capabilities: [
        { skill: 'computation', proficiency: 'expert' },
        { skill: 'analysis', proficiency: 'proficient' },
      ],
    })
    const reqs = makeRequirements({ requiredSkills: ['computation', 'analysis'] })
    // (1.0 + 0.7) / 2 = 0.85
    expect(scoreSkillMatch(crew, reqs)).toBeCloseTo(0.85)
  })

  it('is case-insensitive', () => {
    const crew = makeCrew({
      capabilities: [{ skill: 'COMPUTATION', proficiency: 'expert' }],
    })
    const reqs = makeRequirements({ requiredSkills: ['computation'] })
    expect(scoreSkillMatch(crew, reqs)).toBe(1.0)
  })

  it('handles partial matches (1 of 2 skills)', () => {
    const crew = makeCrew({
      capabilities: [{ skill: 'computation', proficiency: 'expert' }],
    })
    const reqs = makeRequirements({ requiredSkills: ['computation', 'unknown_skill'] })
    // (1.0 + 0) / 2 = 0.5
    expect(scoreSkillMatch(crew, reqs)).toBeCloseTo(0.5)
  })

  it('caps at 1.0 even with over-qualified crew', () => {
    const crew = makeCrew({
      capabilities: [
        { skill: 'computation', proficiency: 'expert' },
        { skill: 'analysis', proficiency: 'expert' },
        { skill: 'generation', proficiency: 'expert' },
      ],
    })
    const reqs = makeRequirements({ requiredSkills: ['computation'] })
    expect(scoreSkillMatch(crew, reqs)).toBeLessThanOrEqual(1.0)
  })
})

// ── scoreDepartmentFit ─────────────────────────────────────────────────────

describe('scoreDepartmentFit', () => {
  it('returns 1.0 when crew matches preferred department', () => {
    const crew = makeCrew({ department: 'engineering' })
    const reqs = makeRequirements({ preferredDepartment: 'engineering' })
    expect(scoreDepartmentFit(crew, reqs)).toBe(1.0)
  })

  it('returns 0.2 when crew does NOT match preferred department', () => {
    const crew = makeCrew({ department: 'medical' })
    const reqs = makeRequirements({ preferredDepartment: 'engineering' })
    expect(scoreDepartmentFit(crew, reqs)).toBe(0.2)
  })

  it('uses work type map when no preferred department', () => {
    // computation → [engineering, science]
    const crew = makeCrew({ department: 'engineering' })
    const reqs = makeRequirements({ workType: 'computation' })
    // engineering is index 0 → 1.0 - 0*0.2 = 1.0
    expect(scoreDepartmentFit(crew, reqs)).toBe(1.0)
  })

  it('gives lower score for secondary department in map', () => {
    // computation → [engineering, science]
    const crew = makeCrew({ department: 'science' })
    const reqs = makeRequirements({ workType: 'computation' })
    // science is index 1 → 1.0 - 1*0.2 = 0.8
    expect(scoreDepartmentFit(crew, reqs)).toBeCloseTo(0.8)
  })

  it('returns 0.1 for department not in map', () => {
    const crew = makeCrew({ department: 'medical' })
    const reqs = makeRequirements({ workType: 'computation' })
    expect(scoreDepartmentFit(crew, reqs)).toBe(0.1)
  })

  it('preferred department overrides work type map', () => {
    const crew = makeCrew({ department: 'medical' })
    const reqs = makeRequirements({
      workType: 'computation',
      preferredDepartment: 'medical',
    })
    expect(scoreDepartmentFit(crew, reqs)).toBe(1.0)
  })
})

// ── scoreDutyStatus ────────────────────────────────────────────────────────

describe('scoreDutyStatus', () => {
  it('active_duty = 1.0', () => {
    expect(scoreDutyStatus(makeCrew({ dutyStatus: 'active_duty' }))).toBe(1.0)
  })

  it('reserve = 0.5', () => {
    expect(scoreDutyStatus(makeCrew({ dutyStatus: 'reserve' }))).toBe(0.5)
  })

  it('shore_leave = 0.15', () => {
    expect(scoreDutyStatus(makeCrew({ dutyStatus: 'shore_leave' }))).toBe(0.15)
  })

  it('detached = 0.0', () => {
    expect(scoreDutyStatus(makeCrew({ dutyStatus: 'detached' }))).toBe(0.0)
  })
})

// ── scoreLoadCapacity ──────────────────────────────────────────────────────

describe('scoreLoadCapacity', () => {
  it('returns 1.0 when crew has no active work', () => {
    expect(scoreLoadCapacity(makeCrew({ activeWorkUnits: 0 }))).toBe(1.0)
  })

  it('returns 0 when crew is at capacity', () => {
    expect(scoreLoadCapacity(makeCrew({ activeWorkUnits: 5 }))).toBe(0)
  })

  it('returns 0.6 with 2 of 5 slots used', () => {
    expect(scoreLoadCapacity(makeCrew({ activeWorkUnits: 2 }))).toBeCloseTo(0.6)
  })

  it('respects custom maxConcurrent', () => {
    expect(scoreLoadCapacity(makeCrew({ activeWorkUnits: 5 }), 10)).toBeCloseTo(0.5)
  })

  it('returns 0 when over capacity', () => {
    expect(scoreLoadCapacity(makeCrew({ activeWorkUnits: 6 }), 5)).toBe(0)
  })
})

// ── scorePheromone ─────────────────────────────────────────────────────────

describe('scorePheromone', () => {
  it('returns 0 when no hint exists', () => {
    const crew = makeCrew()
    expect(scorePheromone(crew, [])).toBe(0)
  })

  it('returns strength/100 for matching hint', () => {
    const crew = makeCrew({ id: 'crew_1' })
    const hints: CrewPheromoneHint[] = [
      { crewId: 'crew_1', successfulAssignments: 10, abandonments: 0, strength: 50 },
    ]
    expect(scorePheromone(crew, hints)).toBeCloseTo(0.5)
  })

  it('caps at 1.0', () => {
    const crew = makeCrew({ id: 'crew_1' })
    const hints: CrewPheromoneHint[] = [
      { crewId: 'crew_1', successfulAssignments: 100, abandonments: 0, strength: 150 },
    ]
    expect(scorePheromone(crew, hints)).toBe(1.0)
  })

  it('matches by string conversion (number ID)', () => {
    const crew = makeCrew({ id: 42 })
    const hints: CrewPheromoneHint[] = [
      { crewId: 42, successfulAssignments: 5, abandonments: 0, strength: 80 },
    ]
    expect(scorePheromone(crew, hints)).toBeCloseTo(0.8)
  })
})

// ── routeToCrewMember ──────────────────────────────────────────────────────

describe('routeToCrewMember', () => {
  const reqs = makeRequirements()

  it('returns noEligible when crew list is empty', () => {
    const result = routeToCrewMember(reqs, [])
    expect(result.noEligible).toBe(true)
    expect(result.selectedCrew).toBeNull()
    expect(result.alternates).toHaveLength(0)
  })

  it('returns noEligible when all crew are detached', () => {
    const crew = [
      makeCrew({ id: 'c1', dutyStatus: 'detached' }),
      makeCrew({ id: 'c2', dutyStatus: 'detached' }),
    ]
    const result = routeToCrewMember(reqs, crew)
    expect(result.noEligible).toBe(true)
    expect(result.reason).toContain('detached or at capacity')
  })

  it('returns noEligible when all crew are at capacity', () => {
    const crew = [
      makeCrew({ id: 'c1', activeWorkUnits: 5 }),
      makeCrew({ id: 'c2', activeWorkUnits: 10 }),
    ]
    const result = routeToCrewMember(reqs, crew)
    expect(result.noEligible).toBe(true)
  })

  it('selects the best scoring crew member', () => {
    const crew = [
      makeCrew({
        id: 'engineer',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        activeWorkUnits: 0,
      }),
      makeCrew({
        id: 'medic',
        department: 'medical',
        capabilities: [{ skill: 'healing', proficiency: 'expert' }],
        activeWorkUnits: 0,
      }),
    ]
    const result = routeToCrewMember(reqs, crew)
    expect(result.noEligible).toBe(false)
    expect(result.selectedCrew?.crew.id).toBe('engineer')
  })

  it('returns alternates', () => {
    const crew = [
      makeCrew({ id: 'c1', department: 'engineering' }),
      makeCrew({ id: 'c2', department: 'science' }),
      makeCrew({ id: 'c3', department: 'medical' }),
      makeCrew({ id: 'c4', department: 'operations' }),
      makeCrew({ id: 'c5', department: 'bridge' }),
    ]
    const result = routeToCrewMember(reqs, crew, [], { maxAlternates: 3 })
    expect(result.alternates).toHaveLength(3)
  })

  it('includes routing metadata', () => {
    const crew = [makeCrew()]
    const result = routeToCrewMember(reqs, crew)
    expect(result.routedAt).toBeDefined()
    expect(typeof result.routingTimeMs).toBe('number')
    expect(result.routingTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('prefers active_duty over shore_leave', () => {
    const crew = [
      makeCrew({
        id: 'shore',
        dutyStatus: 'shore_leave',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
      }),
      makeCrew({
        id: 'active',
        dutyStatus: 'active_duty',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
      }),
    ]
    const result = routeToCrewMember(reqs, crew)
    expect(result.selectedCrew?.crew.id).toBe('active')
  })

  it('prefers crew with less load', () => {
    const crew = [
      makeCrew({
        id: 'busy',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        activeWorkUnits: 4,
      }),
      makeCrew({
        id: 'free',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        activeWorkUnits: 0,
      }),
    ]
    const result = routeToCrewMember(reqs, crew)
    expect(result.selectedCrew?.crew.id).toBe('free')
  })

  it('boosts active watch section', () => {
    const crew = [
      makeCrew({
        id: 'off_watch',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        watchSection: 'beta',
        rank: 'commander',
      }),
      makeCrew({
        id: 'on_watch',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        watchSection: 'alpha',
        rank: 'lieutenant',
      }),
    ]
    const result = routeToCrewMember(reqs, crew, [], { activeWatchSection: 'alpha' })
    expect(result.selectedCrew?.crew.id).toBe('on_watch')
  })

  it('respects maxConcurrentPerCrew option', () => {
    const crew = [
      makeCrew({ id: 'c1', activeWorkUnits: 2 }),
    ]
    const result = routeToCrewMember(reqs, crew, [], { maxConcurrentPerCrew: 2 })
    expect(result.noEligible).toBe(true)
  })

  it('uses pheromone hints for scoring', () => {
    const crew = [
      makeCrew({
        id: 'no_trail',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
      }),
      makeCrew({
        id: 'strong_trail',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
      }),
    ]
    const hints: CrewPheromoneHint[] = [
      { crewId: 'strong_trail', successfulAssignments: 50, abandonments: 0, strength: 100 },
    ]
    const result = routeToCrewMember(reqs, crew, hints)
    // strong_trail should score higher due to pheromone bonus
    expect(result.selectedCrew?.crew.id).toBe('strong_trail')
  })

  it('uses rank seniority as tiebreaker', () => {
    // Both identical except rank
    const crew = [
      makeCrew({
        id: 'junior',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        rank: 'ensign',
      }),
      makeCrew({
        id: 'senior',
        department: 'engineering',
        capabilities: [{ skill: 'computation', proficiency: 'expert' }],
        rank: 'commander',
      }),
    ]
    const result = routeToCrewMember(reqs, crew)
    expect(result.selectedCrew?.crew.id).toBe('senior')
  })

  it('all score components are populated', () => {
    const crew = [makeCrew()]
    const result = routeToCrewMember(reqs, crew)
    const match = result.selectedCrew!
    expect(typeof match.skillScore).toBe('number')
    expect(typeof match.departmentScore).toBe('number')
    expect(typeof match.dutyScore).toBe('number')
    expect(typeof match.loadScore).toBe('number')
    expect(typeof match.pheromoneBonus).toBe('number')
    expect(typeof match.totalScore).toBe('number')
    expect(match.totalScore).toBeGreaterThan(0)
  })
})

// ── getPrimaryDepartment ───────────────────────────────────────────────────

describe('getPrimaryDepartment', () => {
  it('returns engineering for computation', () => {
    expect(getPrimaryDepartment('computation')).toBe('engineering')
  })

  it('returns science for analysis', () => {
    expect(getPrimaryDepartment('analysis')).toBe('science')
  })

  it('returns communications for generation', () => {
    expect(getPrimaryDepartment('generation')).toBe('communications')
  })

  it('returns engineering for transformation', () => {
    expect(getPrimaryDepartment('transformation')).toBe('engineering')
  })

  it('returns science for aggregation', () => {
    expect(getPrimaryDepartment('aggregation')).toBe('science')
  })
})

// ── buildCrewSummary ───────────────────────────────────────────────────────

describe('buildCrewSummary', () => {
  it('counts active crew per department', () => {
    const crew = [
      makeCrew({ department: 'engineering', dutyStatus: 'active_duty' }),
      makeCrew({ department: 'engineering', dutyStatus: 'active_duty' }),
      makeCrew({ department: 'bridge', dutyStatus: 'active_duty' }),
    ]
    const summary = buildCrewSummary(crew)
    expect(summary.engineering).toBe(2)
    expect(summary.bridge).toBe(1)
  })

  it('excludes detached crew', () => {
    const crew = [
      makeCrew({ department: 'engineering', dutyStatus: 'active_duty' }),
      makeCrew({ department: 'engineering', dutyStatus: 'detached' }),
    ]
    const summary = buildCrewSummary(crew)
    expect(summary.engineering).toBe(1)
  })

  it('returns empty object for empty crew list', () => {
    const summary = buildCrewSummary([])
    expect(Object.keys(summary)).toHaveLength(0)
  })

  it('includes reserve and shore_leave crew', () => {
    const crew = [
      makeCrew({ department: 'science', dutyStatus: 'reserve' }),
      makeCrew({ department: 'science', dutyStatus: 'shore_leave' }),
    ]
    const summary = buildCrewSummary(crew)
    expect(summary.science).toBe(2)
  })
})

// ── hasMinimumCrew ─────────────────────────────────────────────────────────

describe('hasMinimumCrew', () => {
  it('returns true when bridge has active crew', () => {
    const crew = [makeCrew({ department: 'bridge', dutyStatus: 'active_duty' })]
    expect(hasMinimumCrew(crew)).toBe(true)
  })

  it('returns false when no bridge crew', () => {
    const crew = [makeCrew({ department: 'engineering', dutyStatus: 'active_duty' })]
    expect(hasMinimumCrew(crew)).toBe(false)
  })

  it('returns false when bridge crew is not active', () => {
    const crew = [makeCrew({ department: 'bridge', dutyStatus: 'shore_leave' })]
    expect(hasMinimumCrew(crew)).toBe(false)
  })

  it('returns false for empty crew', () => {
    expect(hasMinimumCrew([])).toBe(false)
  })
})
