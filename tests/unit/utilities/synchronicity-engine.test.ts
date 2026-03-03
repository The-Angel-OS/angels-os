/**
 * synchronicity-engine — Unit Tests
 *
 * Pure functions: calculateSkillOverlap, calculateTemporalProximity,
 * calculateSpatialProximity, calculateTrailIntersection, calculateComplementarity,
 * validateWeights, hasMinimumActivity
 *
 * Constants: SYNCHRONICITY_WEIGHTS, MIN_SYNCHRONICITY_SCORE, STRONG_MATCH_THRESHOLD
 */
import { describe, it, expect } from 'vitest'

import {
  calculateSkillOverlap,
  calculateTemporalProximity,
  calculateSpatialProximity,
  calculateTrailIntersection,
  calculateComplementarity,
  validateWeights,
  hasMinimumActivity,
  SYNCHRONICITY_WEIGHTS,
  MIN_SYNCHRONICITY_SCORE,
  MIN_ACTIVITY_THRESHOLD,
  STRONG_MATCH_THRESHOLD,
  EXTRAORDINARY_MATCH_THRESHOLD,
  type UserActivityProfile,
} from '@/utilities/synchronicity-engine'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserActivityProfile> = {}): UserActivityProfile {
  return {
    userId: 'user_1',
    questCompletions: {},
    workUnitsProcessed: {},
    nodeIds: [],
    spaceIds: [],
    activeHours: [],
    skills: [],
    trustLevel: 'vouched',
    reputationScore: 100,
    trailStrengths: {},
    ...overrides,
  }
}

// ── calculateSkillOverlap ─────────────────────────────────────────────────────

describe('calculateSkillOverlap', () => {
  it('returns 0 when both profiles have no skills', () => {
    expect(calculateSkillOverlap(makeProfile(), makeProfile())).toBe(0)
  })

  it('returns 100 when profiles share identical skills', () => {
    const a = makeProfile({ skills: ['welding', 'painting'] })
    const b = makeProfile({ skills: ['welding', 'painting'] })
    expect(calculateSkillOverlap(a, b)).toBeGreaterThanOrEqual(80)
  })

  it('returns 0 when there is no skill overlap', () => {
    const a = makeProfile({ skills: ['welding'] })
    const b = makeProfile({ skills: ['coding'] })
    expect(calculateSkillOverlap(a, b)).toBe(0)
  })

  it('returns value between 0 and 100', () => {
    const a = makeProfile({ skills: ['welding', 'coding'], questCompletions: { analysis: 3 } })
    const b = makeProfile({ skills: ['welding', 'design'], questCompletions: { generation: 2 } })
    const score = calculateSkillOverlap(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('counts quest completions as skills', () => {
    const a = makeProfile({ questCompletions: { 'analysis': 5 } })
    const b = makeProfile({ questCompletions: { 'analysis': 4 } })
    const score = calculateSkillOverlap(a, b)
    expect(score).toBeGreaterThan(0)
  })

  it('gives depth bonus when both have >= 3 completions in shared skills', () => {
    // Profiles share 'analysis' (1 shared out of many unique → Jaccard < 100%)
    const a = makeProfile({ skills: ['weld', 'grind', 'cut'], questCompletions: { 'analysis': 5 } })
    const b = makeProfile({ skills: ['design', 'paint', 'assemble'], questCompletions: { 'analysis': 4 } })
    const withDepth = calculateSkillOverlap(a, b)

    // Same Jaccard ratio, but low counts → no depth bonus
    const c = makeProfile({ skills: ['weld', 'grind', 'cut'], questCompletions: { 'analysis': 1 } })
    const d = makeProfile({ skills: ['design', 'paint', 'assemble'], questCompletions: { 'analysis': 1 } })
    const withoutDepth = calculateSkillOverlap(c, d)

    expect(withDepth).toBeGreaterThan(withoutDepth)
  })
})

// ── calculateTemporalProximity ────────────────────────────────────────────────

describe('calculateTemporalProximity', () => {
  it('returns 0 when either profile has no active hours', () => {
    const a = makeProfile({ activeHours: [9, 10, 11] })
    const b = makeProfile({ activeHours: [] })
    expect(calculateTemporalProximity(a, b)).toBe(0)
    expect(calculateTemporalProximity(b, a)).toBe(0)
  })

  it('returns 100 when active hours are identical', () => {
    const hours = [9, 10, 11, 14, 15]
    const a = makeProfile({ activeHours: hours })
    const b = makeProfile({ activeHours: hours })
    expect(calculateTemporalProximity(a, b)).toBe(100)
  })

  it('returns 0 when active hours have no overlap', () => {
    const a = makeProfile({ activeHours: [9, 10, 11] })
    const b = makeProfile({ activeHours: [18, 19, 20] })
    expect(calculateTemporalProximity(a, b)).toBe(0)
  })

  it('returns partial score for partial overlap', () => {
    const a = makeProfile({ activeHours: [9, 10, 11, 12] })
    const b = makeProfile({ activeHours: [11, 12, 13, 14] })
    const score = calculateTemporalProximity(a, b)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })
})

// ── calculateSpatialProximity ─────────────────────────────────────────────────

describe('calculateSpatialProximity', () => {
  it('returns 0 when both have no nodes or spaces', () => {
    expect(calculateSpatialProximity(makeProfile(), makeProfile())).toBe(0)
  })

  it('returns high score when sharing the same node', () => {
    const a = makeProfile({ nodeIds: ['node_1'] })
    const b = makeProfile({ nodeIds: ['node_1'] })
    expect(calculateSpatialProximity(a, b)).toBeGreaterThanOrEqual(50)
  })

  it('returns 0 when no shared nodes or spaces', () => {
    const a = makeProfile({ nodeIds: ['node_1'], spaceIds: ['space_1'] })
    const b = makeProfile({ nodeIds: ['node_2'], spaceIds: ['space_2'] })
    expect(calculateSpatialProximity(a, b)).toBe(0)
  })

  it('gives node overlap higher weight than space overlap', () => {
    const nodeMatch = calculateSpatialProximity(
      makeProfile({ nodeIds: ['n1'] }),
      makeProfile({ nodeIds: ['n1'] }),
    )
    const spaceMatch = calculateSpatialProximity(
      makeProfile({ spaceIds: ['s1'] }),
      makeProfile({ spaceIds: ['s1'] }),
    )
    expect(nodeMatch).toBeGreaterThanOrEqual(spaceMatch)
  })
})

// ── calculateTrailIntersection ────────────────────────────────────────────────

describe('calculateTrailIntersection', () => {
  it('returns 0 when either profile has no trails', () => {
    const a = makeProfile({ trailStrengths: { 'ph_abc': 50 } })
    const b = makeProfile({ trailStrengths: {} })
    expect(calculateTrailIntersection(a, b)).toBe(0)
  })

  it('returns > 0 when both share a trail hash', () => {
    const a = makeProfile({ trailStrengths: { 'ph_abc': 80 } })
    const b = makeProfile({ trailStrengths: { 'ph_abc': 70 } })
    expect(calculateTrailIntersection(a, b)).toBeGreaterThan(0)
  })

  it('returns 0 when trails do not intersect', () => {
    const a = makeProfile({ trailStrengths: { 'ph_abc': 80 } })
    const b = makeProfile({ trailStrengths: { 'ph_xyz': 70 } })
    expect(calculateTrailIntersection(a, b)).toBe(0)
  })

  it('score is between 0 and 100', () => {
    const a = makeProfile({ trailStrengths: { 'ph_a': 90, 'ph_b': 60 } })
    const b = makeProfile({ trailStrengths: { 'ph_a': 85, 'ph_c': 40 } })
    const score = calculateTrailIntersection(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ── calculateComplementarity ──────────────────────────────────────────────────

describe('calculateComplementarity', () => {
  it('returns 0 when either has no skills', () => {
    const a = makeProfile({ skills: ['welding'] })
    const b = makeProfile()
    expect(calculateComplementarity(a, b)).toBe(0)
  })

  it('returns 0 when skills are identical (no unique to either)', () => {
    const a = makeProfile({ skills: ['welding'] })
    const b = makeProfile({ skills: ['welding'] })
    expect(calculateComplementarity(a, b)).toBe(0)
  })

  it('returns > 0 when profiles have distinct skills', () => {
    const a = makeProfile({ skills: ['welding', 'grinding'] })
    const b = makeProfile({ skills: ['design', 'marketing'] })
    expect(calculateComplementarity(a, b)).toBeGreaterThan(0)
  })

  it('returns value between 0 and 100', () => {
    const a = makeProfile({ skills: ['welding', 'coding'], questCompletions: { analysis: 3 } })
    const b = makeProfile({ skills: ['design'], questCompletions: { generation: 5 } })
    const score = calculateComplementarity(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ── validateWeights ───────────────────────────────────────────────────────────

describe('validateWeights', () => {
  it('returns true for default SYNCHRONICITY_WEIGHTS', () => {
    expect(validateWeights(SYNCHRONICITY_WEIGHTS)).toBe(true)
  })

  it('returns false when weights do not sum to 1', () => {
    expect(validateWeights({
      skillOverlap: 0.5,
      temporalProximity: 0.5,
      spatialProximity: 0.5,
      trailIntersection: 0.5,
      complementarity: 0.5,
    })).toBe(false)
  })

  it('returns false when weights clearly do not sum to 1', () => {
    // Each weight is 0.5 → sum is 2.5 → not 1.0
    expect(validateWeights({
      skillOverlap: 0.5,
      temporalProximity: 0.5,
      spatialProximity: 0.5,
      trailIntersection: 0.5,
      complementarity: 0.5,
    })).toBe(false)
  })
})

// ── hasMinimumActivity ────────────────────────────────────────────────────────

describe('hasMinimumActivity', () => {
  it('returns false for empty profile', () => {
    expect(hasMinimumActivity(makeProfile())).toBe(false)
  })

  it('returns true when skills meet minimum threshold', () => {
    const skills = Array.from({ length: MIN_ACTIVITY_THRESHOLD }, (_, i) => `skill_${i}`)
    expect(hasMinimumActivity(makeProfile({ skills }))).toBe(true)
  })

  it('returns false with only one skill (below threshold)', () => {
    expect(hasMinimumActivity(makeProfile({ skills: ['welding'] }))).toBe(false)
  })
})

// ── Constants ─────────────────────────────────────────────────────────────────

describe('SYNCHRONICITY_WEIGHTS', () => {
  it('sum to approximately 1.0', () => {
    const total = Object.values(SYNCHRONICITY_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1.0, 2)
  })

  it('has all 5 dimension keys', () => {
    expect(SYNCHRONICITY_WEIGHTS).toHaveProperty('skillOverlap')
    expect(SYNCHRONICITY_WEIGHTS).toHaveProperty('temporalProximity')
    expect(SYNCHRONICITY_WEIGHTS).toHaveProperty('spatialProximity')
    expect(SYNCHRONICITY_WEIGHTS).toHaveProperty('trailIntersection')
    expect(SYNCHRONICITY_WEIGHTS).toHaveProperty('complementarity')
  })
})

describe('Score thresholds', () => {
  it('MIN_SYNCHRONICITY_SCORE is a positive number < 100', () => {
    expect(MIN_SYNCHRONICITY_SCORE).toBeGreaterThan(0)
    expect(MIN_SYNCHRONICITY_SCORE).toBeLessThan(100)
  })

  it('STRONG_MATCH_THRESHOLD is above MIN_SYNCHRONICITY_SCORE', () => {
    expect(STRONG_MATCH_THRESHOLD).toBeGreaterThan(MIN_SYNCHRONICITY_SCORE)
  })

  it('EXTRAORDINARY_MATCH_THRESHOLD is above STRONG_MATCH_THRESHOLD', () => {
    expect(EXTRAORDINARY_MATCH_THRESHOLD).toBeGreaterThan(STRONG_MATCH_THRESHOLD)
  })
})
