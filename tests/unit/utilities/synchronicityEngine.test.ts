/**
 * Synchronicity Engine — Unit Tests
 *
 * Tests the pure logic pattern detection engine that finds
 * meaningful connections between federation members.
 *
 * ~70 tests covering:
 * - Dimension scoring (skill, temporal, spatial, trail, complementarity)
 * - Composite scoring & classification
 * - Search & discovery (findSynchronicities, findUserSynchronicities)
 * - Nudge generation
 * - Profile building & validation
 * - Edge cases & boundary conditions
 * - Constants validation
 */

import { describe, it, expect } from 'vitest'
import {
  // Types
  type UserActivityProfile,
  type SynchronicityMatch,
  type SynchronicityWeights,
  type SynchronicityOptions,
  // Constants
  SYNCHRONICITY_WEIGHTS,
  MIN_SYNCHRONICITY_SCORE,
  MAX_SYNCHRONICITY_RESULTS,
  MIN_ACTIVITY_THRESHOLD,
  STRONG_MATCH_THRESHOLD,
  EXTRAORDINARY_MATCH_THRESHOLD,
  // Dimension scorers
  calculateSkillOverlap,
  calculateTemporalProximity,
  calculateSpatialProximity,
  calculateTrailIntersection,
  calculateComplementarity,
  // Composite
  calculateSynchronicityScore,
  classifySynchronicity,
  generateReason,
  // Search
  findSynchronicities,
  findUserSynchronicities,
  // Nudges
  generateNudge,
  generateNudges,
  determineSuggestedAction,
  buildNudgeMessage,
  // Helpers
  buildActivityProfile,
  validateWeights,
  hasMinimumActivity,
} from '@/utilities/synchronicity-engine'

// ── Test Fixtures ─────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserActivityProfile> = {}): UserActivityProfile {
  return {
    userId: 'user-1',
    displayName: 'Alice',
    questCompletions: { analysis: 5, generation: 3 },
    workUnitsProcessed: { computation: 10, analysis: 8 },
    nodeIds: ['node-alpha'],
    spaceIds: ['space-general'],
    activeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    skills: ['analysis', 'computation', 'generation'],
    trustLevel: 'vouched',
    reputationScore: 75,
    trailStrengths: { 'ph_abc': 80, 'ph_def': 50 },
    ...overrides,
  }
}

function makeProfileB(overrides: Partial<UserActivityProfile> = {}): UserActivityProfile {
  return makeProfile({
    userId: 'user-2',
    displayName: 'Bob',
    questCompletions: { analysis: 4, transformation: 6 },
    workUnitsProcessed: { analysis: 5, aggregation: 7 },
    nodeIds: ['node-beta'],
    spaceIds: ['space-general', 'space-dev'],
    activeHours: [10, 11, 12, 13, 14, 15, 16, 17, 18],
    skills: ['analysis', 'transformation', 'aggregation'],
    trustLevel: 'full',
    reputationScore: 90,
    trailStrengths: { 'ph_abc': 60, 'ph_ghi': 40 },
    ...overrides,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

describe('Synchronicity Engine — Constants', () => {
  it('weights sum to 1.0', () => {
    const sum =
      SYNCHRONICITY_WEIGHTS.skillOverlap +
      SYNCHRONICITY_WEIGHTS.temporalProximity +
      SYNCHRONICITY_WEIGHTS.spatialProximity +
      SYNCHRONICITY_WEIGHTS.trailIntersection +
      SYNCHRONICITY_WEIGHTS.complementarity
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
  })

  it('has reasonable threshold values', () => {
    expect(MIN_SYNCHRONICITY_SCORE).toBeGreaterThan(0)
    expect(MIN_SYNCHRONICITY_SCORE).toBeLessThan(100)
    expect(STRONG_MATCH_THRESHOLD).toBeGreaterThan(MIN_SYNCHRONICITY_SCORE)
    expect(EXTRAORDINARY_MATCH_THRESHOLD).toBeGreaterThan(STRONG_MATCH_THRESHOLD)
    expect(MAX_SYNCHRONICITY_RESULTS).toBeGreaterThan(0)
    expect(MIN_ACTIVITY_THRESHOLD).toBeGreaterThan(0)
  })

  it('validateWeights returns true for valid weights', () => {
    expect(validateWeights(SYNCHRONICITY_WEIGHTS)).toBe(true)
  })

  it('validateWeights returns false for invalid weights', () => {
    expect(
      validateWeights({
        skillOverlap: 0.5,
        temporalProximity: 0.5,
        spatialProximity: 0.5,
        trailIntersection: 0.5,
        complementarity: 0.5,
      }),
    ).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Skill Overlap
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateSkillOverlap', () => {
  it('returns 0 for profiles with no skills', () => {
    const a = makeProfile({ questCompletions: {}, workUnitsProcessed: {}, skills: [] })
    const b = makeProfileB({ questCompletions: {}, workUnitsProcessed: {}, skills: [] })
    expect(calculateSkillOverlap(a, b)).toBe(0)
  })

  it('returns 0 for completely disjoint skill sets', () => {
    const a = makeProfile({ questCompletions: { x: 1 }, workUnitsProcessed: {}, skills: ['x'] })
    const b = makeProfileB({ questCompletions: { y: 1 }, workUnitsProcessed: {}, skills: ['y'] })
    expect(calculateSkillOverlap(a, b)).toBe(0)
  })

  it('returns 100 for identical skill sets', () => {
    const skills = { analysis: 5, computation: 3 }
    const a = makeProfile({
      questCompletions: skills,
      workUnitsProcessed: {},
      skills: ['analysis', 'computation'],
    })
    const b = makeProfileB({
      questCompletions: skills,
      workUnitsProcessed: {},
      skills: ['analysis', 'computation'],
    })
    // Jaccard = 1.0, plus depth bonus for shared high counts
    const score = calculateSkillOverlap(a, b)
    expect(score).toBeGreaterThanOrEqual(100)
  })

  it('returns partial score for partial overlap', () => {
    const a = makeProfile()
    const b = makeProfileB()
    const score = calculateSkillOverlap(a, b)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('gives depth bonus for high shared counts', () => {
    const a = makeProfile({
      questCompletions: { analysis: 10 },
      workUnitsProcessed: {},
      skills: ['analysis'],
    })
    const b = makeProfileB({
      questCompletions: { analysis: 10 },
      workUnitsProcessed: {},
      skills: ['analysis'],
    })
    const score = calculateSkillOverlap(a, b)
    // Jaccard=1.0 (100) + depth bonus (5 for analysis)
    expect(score).toBeGreaterThanOrEqual(100)
  })

  it('is symmetric', () => {
    const a = makeProfile()
    const b = makeProfileB()
    expect(calculateSkillOverlap(a, b)).toBe(calculateSkillOverlap(b, a))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Temporal Proximity
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateTemporalProximity', () => {
  it('returns 0 when no active hours', () => {
    const a = makeProfile({ activeHours: [] })
    const b = makeProfileB({ activeHours: [9, 10, 11] })
    expect(calculateTemporalProximity(a, b)).toBe(0)
  })

  it('returns 100 for identical active hours', () => {
    const hours = [9, 10, 11, 12, 13]
    const a = makeProfile({ activeHours: hours })
    const b = makeProfileB({ activeHours: hours })
    expect(calculateTemporalProximity(a, b)).toBe(100)
  })

  it('returns 0 for completely different hours', () => {
    const a = makeProfile({ activeHours: [1, 2, 3] })
    const b = makeProfileB({ activeHours: [13, 14, 15] })
    expect(calculateTemporalProximity(a, b)).toBe(0)
  })

  it('returns partial score for partial overlap', () => {
    const a = makeProfile({ activeHours: [9, 10, 11, 12] })
    const b = makeProfileB({ activeHours: [11, 12, 13, 14] })
    const score = calculateTemporalProximity(a, b)
    // 2 shared out of 6 unique = 33%
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('is symmetric', () => {
    const a = makeProfile()
    const b = makeProfileB()
    expect(calculateTemporalProximity(a, b)).toBe(calculateTemporalProximity(b, a))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Spatial Proximity
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateSpatialProximity', () => {
  it('returns 0 when no shared nodes or spaces', () => {
    const a = makeProfile({ nodeIds: ['a'], spaceIds: ['x'] })
    const b = makeProfileB({ nodeIds: ['b'], spaceIds: ['y'] })
    expect(calculateSpatialProximity(a, b)).toBe(0)
  })

  it('returns high score for shared nodes', () => {
    const a = makeProfile({ nodeIds: ['shared'], spaceIds: [] })
    const b = makeProfileB({ nodeIds: ['shared'], spaceIds: [] })
    const score = calculateSpatialProximity(a, b)
    expect(score).toBeGreaterThan(50)
  })

  it('returns lower score for shared spaces only', () => {
    const a = makeProfile({ nodeIds: ['a'], spaceIds: ['shared'] })
    const b = makeProfileB({ nodeIds: ['b'], spaceIds: ['shared'] })
    const score = calculateSpatialProximity(a, b)
    expect(score).toBeGreaterThan(0)
    // Spaces weighted 40% → lower than nodes
  })

  it('weights nodes higher than spaces', () => {
    const nodeMatch = calculateSpatialProximity(
      makeProfile({ nodeIds: ['shared'], spaceIds: [] }),
      makeProfileB({ nodeIds: ['shared'], spaceIds: [] }),
    )
    const spaceMatch = calculateSpatialProximity(
      makeProfile({ nodeIds: ['a'], spaceIds: ['shared'] }),
      makeProfileB({ nodeIds: ['b'], spaceIds: ['shared'] }),
    )
    expect(nodeMatch).toBeGreaterThan(spaceMatch)
  })

  it('is symmetric', () => {
    const a = makeProfile()
    const b = makeProfileB()
    expect(calculateSpatialProximity(a, b)).toBe(calculateSpatialProximity(b, a))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Trail Intersection
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateTrailIntersection', () => {
  it('returns 0 when no trails', () => {
    const a = makeProfile({ trailStrengths: {} })
    const b = makeProfileB({ trailStrengths: { ph_x: 50 } })
    expect(calculateTrailIntersection(a, b)).toBe(0)
  })

  it('returns 0 for completely disjoint trails', () => {
    const a = makeProfile({ trailStrengths: { ph_a: 80 } })
    const b = makeProfileB({ trailStrengths: { ph_b: 80 } })
    expect(calculateTrailIntersection(a, b)).toBe(0)
  })

  it('returns high score for shared strong trails', () => {
    const a = makeProfile({ trailStrengths: { ph_shared: 80 } })
    const b = makeProfileB({ trailStrengths: { ph_shared: 75 } })
    const score = calculateTrailIntersection(a, b)
    expect(score).toBeGreaterThan(50)
  })

  it('considers strength correlation', () => {
    // Both strong on same trail
    const strongMatch = calculateTrailIntersection(
      makeProfile({ trailStrengths: { ph_x: 90 } }),
      makeProfileB({ trailStrengths: { ph_x: 85 } }),
    )
    // One strong, one weak on same trail
    const weakMatch = calculateTrailIntersection(
      makeProfile({ trailStrengths: { ph_x: 90 } }),
      makeProfileB({ trailStrengths: { ph_x: 10 } }),
    )
    expect(strongMatch).toBeGreaterThanOrEqual(weakMatch)
  })

  it('is symmetric', () => {
    const a = makeProfile()
    const b = makeProfileB()
    expect(calculateTrailIntersection(a, b)).toBe(calculateTrailIntersection(b, a))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Complementarity
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateComplementarity', () => {
  it('returns 0 when no skills', () => {
    const a = makeProfile({ questCompletions: {}, workUnitsProcessed: {}, skills: [] })
    const b = makeProfileB({ questCompletions: {}, workUnitsProcessed: {}, skills: [] })
    expect(calculateComplementarity(a, b)).toBe(0)
  })

  it('returns 0 for identical skill sets', () => {
    const a = makeProfile({
      questCompletions: { a: 1 },
      workUnitsProcessed: {},
      skills: ['a'],
    })
    const b = makeProfileB({
      questCompletions: { a: 1 },
      workUnitsProcessed: {},
      skills: ['a'],
    })
    // No unique skills → no complementarity
    expect(calculateComplementarity(a, b)).toBe(0)
  })

  it('returns high score for completely different skills with some overlap', () => {
    const a = makeProfile({
      questCompletions: { analysis: 5, shared: 2 },
      workUnitsProcessed: {},
      skills: ['analysis', 'computation', 'shared'],
    })
    const b = makeProfileB({
      questCompletions: { generation: 5, shared: 2 },
      workUnitsProcessed: {},
      skills: ['generation', 'transformation', 'shared'],
    })
    const score = calculateComplementarity(a, b)
    expect(score).toBeGreaterThan(30) // Strong complementarity with shared foundation
  })

  it('gives foundation bonus when some shared skills exist', () => {
    // 2 unique skills each + 1 shared, counts below expertise threshold (< 5)
    const score = calculateComplementarity(
      makeProfile({
        questCompletions: { a1: 2, a2: 2, shared: 2 },
        workUnitsProcessed: {},
        skills: ['a1', 'a2', 'shared'],
      }),
      makeProfileB({
        questCompletions: { b1: 2, b2: 2, shared: 2 },
        workUnitsProcessed: {},
        skills: ['b1', 'b2', 'shared'],
      }),
    )
    // complementBase = sqrt((2/3)²) × 100 ≈ 66.7
    // foundationBonus = 15 (shared skill exists)
    // expertiseBonus = 0 (all counts < 5)
    // total = round(66.7 + 15) = 82
    // Without foundation bonus score would be ~67 — the +15 is clearly visible
    expect(score).toBe(82)
  })

  it('is symmetric', () => {
    const a = makeProfile()
    const b = makeProfileB()
    expect(calculateComplementarity(a, b)).toBe(calculateComplementarity(b, a))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Composite Scoring
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateSynchronicityScore', () => {
  it('returns a score between 0 and 100', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    expect(match.score).toBeGreaterThanOrEqual(0)
    expect(match.score).toBeLessThanOrEqual(100)
  })

  it('includes all dimension scores', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    expect(match.dimensions.skillOverlap).toBeDefined()
    expect(match.dimensions.temporalProximity).toBeDefined()
    expect(match.dimensions.spatialProximity).toBeDefined()
    expect(match.dimensions.trailIntersection).toBeDefined()
    expect(match.dimensions.complementarity).toBeDefined()
  })

  it('assigns correct user IDs', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    expect(match.userA).toBe('user-1')
    expect(match.userB).toBe('user-2')
  })

  it('includes display names', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    expect(match.displayNameA).toBe('Alice')
    expect(match.displayNameB).toBe('Bob')
  })

  it('assigns a type', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    const validTypes = [
      'skill_twins',
      'complementary',
      'co_temporal',
      'trail_crossers',
      'node_neighbors',
      'multi_dimensional',
    ]
    expect(validTypes).toContain(match.type)
  })

  it('generates a reason string', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    expect(match.reason).toBeTruthy()
    expect(typeof match.reason).toBe('string')
  })

  it('respects custom weights', () => {
    const skillOnlyWeights: SynchronicityWeights = {
      skillOverlap: 1.0,
      temporalProximity: 0,
      spatialProximity: 0,
      trailIntersection: 0,
      complementarity: 0,
    }
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB(), skillOnlyWeights)
    // Score should equal skill overlap dimension
    expect(match.score).toBe(match.dimensions.skillOverlap)
  })

  it('score of identical profiles is high', () => {
    const p = makeProfile()
    const match = calculateSynchronicityScore(p, { ...p, userId: 'user-clone' })
    expect(match.score).toBeGreaterThan(60)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Classification
// ═══════════════════════════════════════════════════════════════════════════

describe('classifySynchronicity', () => {
  it('returns multi_dimensional when 3+ dimensions above 50', () => {
    expect(
      classifySynchronicity({
        skillOverlap: 60,
        temporalProximity: 55,
        spatialProximity: 70,
        trailIntersection: 10,
        complementarity: 5,
      }),
    ).toBe('multi_dimensional')
  })

  it('returns skill_twins when skill overlap dominates', () => {
    expect(
      classifySynchronicity({
        skillOverlap: 80,
        temporalProximity: 20,
        spatialProximity: 10,
        trailIntersection: 15,
        complementarity: 5,
      }),
    ).toBe('skill_twins')
  })

  it('returns complementary when complementarity dominates', () => {
    expect(
      classifySynchronicity({
        skillOverlap: 10,
        temporalProximity: 20,
        spatialProximity: 10,
        trailIntersection: 15,
        complementarity: 60,
      }),
    ).toBe('complementary')
  })

  it('returns co_temporal when temporal dominates', () => {
    expect(
      classifySynchronicity({
        skillOverlap: 10,
        temporalProximity: 70,
        spatialProximity: 20,
        trailIntersection: 15,
        complementarity: 5,
      }),
    ).toBe('co_temporal')
  })

  it('returns trail_crossers when trail intersection dominates', () => {
    expect(
      classifySynchronicity({
        skillOverlap: 10,
        temporalProximity: 20,
        spatialProximity: 10,
        trailIntersection: 65,
        complementarity: 5,
      }),
    ).toBe('trail_crossers')
  })

  it('returns node_neighbors when spatial dominates', () => {
    expect(
      classifySynchronicity({
        skillOverlap: 10,
        temporalProximity: 20,
        spatialProximity: 70,
        trailIntersection: 15,
        complementarity: 5,
      }),
    ).toBe('node_neighbors')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Search & Discovery
// ═══════════════════════════════════════════════════════════════════════════

describe('findSynchronicities', () => {
  it('returns empty array for single profile', () => {
    expect(findSynchronicities([makeProfile()])).toEqual([])
  })

  it('returns empty for profiles below activity threshold', () => {
    const lowActivity = makeProfile({
      questCompletions: {},
      workUnitsProcessed: {},
      skills: [],
    })
    const lowActivity2 = makeProfileB({
      questCompletions: {},
      workUnitsProcessed: {},
      skills: [],
    })
    expect(findSynchronicities([lowActivity, lowActivity2])).toEqual([])
  })

  it('finds matches between active profiles', () => {
    const matches = findSynchronicities([makeProfile(), makeProfileB()], { minScore: 1 })
    expect(matches.length).toBeGreaterThan(0)
  })

  it('respects minScore filter', () => {
    const matches = findSynchronicities([makeProfile(), makeProfileB()], { minScore: 99 })
    for (const m of matches) {
      expect(m.score).toBeGreaterThanOrEqual(99)
    }
  })

  it('respects maxResults limit', () => {
    const profiles = Array.from({ length: 10 }, (_, i) =>
      makeProfile({
        userId: `user-${i}`,
        skills: ['analysis', `skill-${i}`],
        questCompletions: { analysis: i + 1 },
      }),
    )
    const matches = findSynchronicities(profiles, { maxResults: 3, minScore: 1 })
    expect(matches.length).toBeLessThanOrEqual(3)
  })

  it('sorts by score descending', () => {
    const profiles = Array.from({ length: 5 }, (_, i) =>
      makeProfile({
        userId: `user-${i}`,
        skills: ['analysis', `unique-${i}`],
        questCompletions: { analysis: i + 1 },
      }),
    )
    const matches = findSynchronicities(profiles, { minScore: 1 })
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score)
    }
  })

  it('supports forUserId filter', () => {
    const profiles = [
      makeProfile({ userId: 'alice' }),
      makeProfileB({ userId: 'bob' }),
      makeProfile({ userId: 'carol', skills: ['x', 'y', 'z'] }),
    ]
    const matches = findSynchronicities(profiles, { forUserId: 'alice', minScore: 1 })
    for (const m of matches) {
      expect(m.userA === 'alice' || m.userB === 'alice').toBe(true)
    }
  })

  it('supports excludeSameNode option', () => {
    const a = makeProfile({ nodeIds: ['shared-node'] })
    const b = makeProfileB({ nodeIds: ['shared-node'] })
    const withExclude = findSynchronicities([a, b], { excludeSameNode: true, minScore: 1 })
    expect(withExclude.length).toBe(0)

    const withoutExclude = findSynchronicities([a, b], { excludeSameNode: false, minScore: 1 })
    expect(withoutExclude.length).toBeGreaterThan(0)
  })
})

describe('findUserSynchronicities', () => {
  it('returns matches for specific user', () => {
    const target = makeProfile()
    const others = [target, makeProfileB()]
    const matches = findUserSynchronicities(target, others, { minScore: 1 })
    for (const m of matches) {
      expect(m.userA === target.userId || m.userB === target.userId).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Nudge Generation
// ═══════════════════════════════════════════════════════════════════════════

describe('generateNudge', () => {
  it('creates a nudge with both target users', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    const nudge = generateNudge(match)
    expect(nudge.targetUsers).toContain('user-1')
    expect(nudge.targetUsers).toContain('user-2')
  })

  it('includes the original match', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    const nudge = generateNudge(match)
    expect(nudge.match).toBe(match)
  })

  it('generates a non-empty message', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    const nudge = generateNudge(match)
    expect(nudge.message).toBeTruthy()
    expect(nudge.message.length).toBeGreaterThan(20)
  })

  it('sets priority to match score', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    const nudge = generateNudge(match)
    expect(nudge.priority).toBe(match.score)
  })
})

describe('generateNudges', () => {
  it('respects maxNudges limit', () => {
    const matches = Array.from({ length: 10 }, () =>
      calculateSynchronicityScore(makeProfile(), makeProfileB()),
    )
    const nudges = generateNudges(matches, 3)
    expect(nudges.length).toBeLessThanOrEqual(3)
  })

  it('filters out matches below min score', () => {
    const lowMatch: SynchronicityMatch = {
      userA: 'a',
      userB: 'b',
      score: 5, // well below MIN_SYNCHRONICITY_SCORE
      dimensions: {
        skillOverlap: 5,
        temporalProximity: 5,
        spatialProximity: 5,
        trailIntersection: 5,
        complementarity: 5,
      },
      type: 'node_neighbors',
      reason: 'test',
    }
    expect(generateNudges([lowMatch])).toEqual([])
  })
})

describe('determineSuggestedAction', () => {
  it('returns team_up for skill_twins', () => {
    const match = { type: 'skill_twins' as const } as SynchronicityMatch
    expect(determineSuggestedAction(match)).toBe('team_up')
  })

  it('returns mentor for complementary', () => {
    const match = { type: 'complementary' as const } as SynchronicityMatch
    expect(determineSuggestedAction(match)).toBe('mentor')
  })

  it('returns collaborate for co_temporal', () => {
    const match = { type: 'co_temporal' as const } as SynchronicityMatch
    expect(determineSuggestedAction(match)).toBe('collaborate')
  })

  it('returns introduce for trail_crossers', () => {
    const match = { type: 'trail_crossers' as const } as SynchronicityMatch
    expect(determineSuggestedAction(match)).toBe('introduce')
  })

  it('returns team_up for extraordinary multi_dimensional', () => {
    const match = {
      type: 'multi_dimensional' as const,
      score: EXTRAORDINARY_MATCH_THRESHOLD,
    } as SynchronicityMatch
    expect(determineSuggestedAction(match)).toBe('team_up')
  })

  it('returns collaborate for strong multi_dimensional', () => {
    const match = {
      type: 'multi_dimensional' as const,
      score: STRONG_MATCH_THRESHOLD,
    } as SynchronicityMatch
    expect(determineSuggestedAction(match)).toBe('collaborate')
  })
})

describe('buildNudgeMessage', () => {
  it('includes extraordinary header for high scores', () => {
    const match: SynchronicityMatch = {
      userA: 'a',
      userB: 'b',
      displayNameA: 'Alice',
      displayNameB: 'Bob',
      score: 95,
      dimensions: {
        skillOverlap: 90,
        temporalProximity: 90,
        spatialProximity: 90,
        trailIntersection: 90,
        complementarity: 90,
      },
      type: 'multi_dimensional',
      reason: 'test reason',
    }
    const msg = buildNudgeMessage(match, 'collaborate')
    expect(msg).toContain('Extraordinary')
  })

  it('includes strong header for strong scores', () => {
    const match: SynchronicityMatch = {
      userA: 'a',
      userB: 'b',
      score: 75,
      dimensions: {
        skillOverlap: 70,
        temporalProximity: 70,
        spatialProximity: 70,
        trailIntersection: 70,
        complementarity: 70,
      },
      type: 'skill_twins',
      reason: 'test reason',
    }
    const msg = buildNudgeMessage(match, 'team_up')
    expect(msg).toContain('Strong')
  })

  it('includes score in message', () => {
    const match = calculateSynchronicityScore(makeProfile(), makeProfileB())
    const msg = buildNudgeMessage(match, 'collaborate')
    expect(msg).toContain(String(match.score))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Profile Building
// ═══════════════════════════════════════════════════════════════════════════

describe('buildActivityProfile', () => {
  it('builds a valid profile from raw data', () => {
    const profile = buildActivityProfile({
      userId: 'test-user',
      displayName: 'Test',
      questCompletions: [
        { type: 'analysis', count: 5 },
        { type: 'generation', count: 3 },
      ],
      workUnits: [{ type: 'computation', count: 10 }],
      nodeIds: ['node-1'],
      spaceIds: ['space-1'],
      activeHours: [9, 10, 11],
      skills: ['analysis'],
      trustLevel: 'vouched',
      reputationScore: 50,
      trails: [{ contextHash: 'ph_abc', strength: 80 }],
    })

    expect(profile.userId).toBe('test-user')
    expect(profile.questCompletions.analysis).toBe(5)
    expect(profile.questCompletions.generation).toBe(3)
    expect(profile.workUnitsProcessed.computation).toBe(10)
    expect(profile.nodeIds).toEqual(['node-1'])
    expect(profile.trailStrengths.ph_abc).toBe(80)
  })

  it('handles empty input gracefully', () => {
    const profile = buildActivityProfile({ userId: 'empty' })
    expect(profile.userId).toBe('empty')
    expect(profile.questCompletions).toEqual({})
    expect(profile.workUnitsProcessed).toEqual({})
    expect(profile.nodeIds).toEqual([])
    expect(profile.skills).toEqual([])
    expect(profile.trailStrengths).toEqual({})
  })

  it('aggregates duplicate types', () => {
    const profile = buildActivityProfile({
      userId: 'agg',
      questCompletions: [
        { type: 'analysis', count: 3 },
        { type: 'analysis', count: 7 },
      ],
    })
    expect(profile.questCompletions.analysis).toBe(10)
  })
})

describe('hasMinimumActivity', () => {
  it('returns false for empty profile', () => {
    const profile = buildActivityProfile({ userId: 'empty' })
    expect(hasMinimumActivity(profile)).toBe(false)
  })

  it('returns true for profile meeting threshold', () => {
    const profile = makeProfile()
    expect(hasMinimumActivity(profile)).toBe(true)
  })

  it('returns true at exact threshold', () => {
    const profile = buildActivityProfile({
      userId: 'threshold',
      skills: Array.from({ length: MIN_ACTIVITY_THRESHOLD }, (_, i) => `skill-${i}`),
    })
    expect(hasMinimumActivity(profile)).toBe(true)
  })

  it('returns false just below threshold', () => {
    const profile = buildActivityProfile({
      userId: 'below',
      skills: Array.from({ length: MIN_ACTIVITY_THRESHOLD - 1 }, (_, i) => `skill-${i}`),
    })
    expect(hasMinimumActivity(profile)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Reason Generation
// ═══════════════════════════════════════════════════════════════════════════

describe('generateReason', () => {
  it('includes user names', () => {
    const a = makeProfile()
    const b = makeProfileB()
    const match = calculateSynchronicityScore(a, b)
    expect(match.reason).toContain('Alice')
    expect(match.reason).toContain('Bob')
  })

  it('falls back to User ID when no display name', () => {
    const a = makeProfile({ displayName: undefined })
    const b = makeProfileB({ displayName: undefined })
    const dims = { skillOverlap: 80, temporalProximity: 20, spatialProximity: 10, trailIntersection: 10, complementarity: 5 }
    const reason = generateReason(a, b, dims, 'skill_twins')
    expect(reason).toContain('User user-1')
    expect(reason).toContain('User user-2')
  })

  it('mentions shared skills for skill_twins', () => {
    const a = makeProfile({ skills: ['analysis', 'computation'] })
    const b = makeProfileB({ skills: ['analysis', 'computation'] })
    const dims = { skillOverlap: 80, temporalProximity: 20, spatialProximity: 10, trailIntersection: 10, complementarity: 5 }
    const reason = generateReason(a, b, dims, 'skill_twins')
    expect(reason).toContain('analysis')
  })

  it('generates multi_dimensional reason with dimension count', () => {
    const a = makeProfile()
    const b = makeProfileB()
    const dims = { skillOverlap: 60, temporalProximity: 55, spatialProximity: 70, trailIntersection: 60, complementarity: 55 }
    const reason = generateReason(a, b, dims, 'multi_dimensional')
    expect(reason).toContain('dimensions')
  })
})
