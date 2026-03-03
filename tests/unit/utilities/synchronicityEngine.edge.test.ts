/**
 * Synchronicity Engine — Edge-Case Tests (Sprint 36 D2)
 *
 * Adversarial and boundary tests for dimension scorers, classification
 * tie-breaking, weight validation, empty/minimal profiles, and nudge generation.
 *
 * Uses the project pattern of re-implementing pure logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/synchronicityEngine.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SynchronicityWeights {
  skillOverlap: number
  temporalProximity: number
  spatialProximity: number
  trailIntersection: number
  complementarity: number
}

type SynchronicityType =
  | 'skill_kinship'
  | 'temporal_rhythm'
  | 'spatial_convergence'
  | 'trail_resonance'
  | 'complementary_gifts'
  | 'multi_dimensional'

interface SynchronicityMatch {
  userA: string
  userB: string
  displayNameA?: string
  displayNameB?: string
  score: number
  dimensions: {
    skillOverlap: number
    temporalProximity: number
    spatialProximity: number
    trailIntersection: number
    complementarity: number
  }
  type: SynchronicityType
  reason: string
}

interface SuggestedAction {
  type: string
  label: string
  priority: number
}

interface SynchronicityNudge {
  matchId: string
  userA: string
  userB: string
  message: string
  suggestedAction: SuggestedAction
  score: number
  type: SynchronicityType
}

interface UserActivityProfile {
  userId: string
  displayName?: string
  questCompletions: Record<string, number>
  workUnitsProcessed: Record<string, number>
  nodeIds: string[]
  spaceIds: string[]
  activeHours: number[]
  skills: string[]
  trustLevel: string
  reputationScore: number
  trailStrengths: Record<string, number>
}

interface SynchronicityOptions {
  minScore?: number
  maxResults?: number
  forUserId?: string
  excludeSameNode?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_ACTIVITY_THRESHOLD = 2
const MIN_SYNCHRONICITY_SCORE = 40
const STRONG_MATCH_THRESHOLD = 70
const EXTRAORDINARY_MATCH_THRESHOLD = 90

const SYNCHRONICITY_WEIGHTS: SynchronicityWeights = {
  skillOverlap: 0.30,
  temporalProximity: 0.15,
  spatialProximity: 0.20,
  trailIntersection: 0.15,
  complementarity: 0.20,
}

// ---------------------------------------------------------------------------
// Pure function re-implementations
// ---------------------------------------------------------------------------

function calculateSkillOverlap(profileA: UserActivityProfile, profileB: UserActivityProfile): number {
  const skillsA = new Set([
    ...Object.keys(profileA.questCompletions),
    ...Object.keys(profileA.workUnitsProcessed),
    ...profileA.skills,
  ])
  const skillsB = new Set([
    ...Object.keys(profileB.questCompletions),
    ...Object.keys(profileB.workUnitsProcessed),
    ...profileB.skills,
  ])
  if (skillsA.size === 0 && skillsB.size === 0) return 0
  const intersection = new Set([...skillsA].filter((s) => skillsB.has(s)))
  const union = new Set([...skillsA, ...skillsB])
  let jaccard = (intersection.size / union.size) * 100

  // Depth bonus
  for (const skill of intersection) {
    const countA = (profileA.questCompletions[skill] || 0) + (profileA.workUnitsProcessed[skill] || 0)
    const countB = (profileB.questCompletions[skill] || 0) + (profileB.workUnitsProcessed[skill] || 0)
    if (countA >= 3 && countB >= 3) jaccard += 5
  }

  return Math.min(jaccard, 100)
}

function calculateTemporalProximity(profileA: UserActivityProfile, profileB: UserActivityProfile): number {
  if (profileA.activeHours.length === 0 || profileB.activeHours.length === 0) return 0
  const hoursA = new Set(profileA.activeHours)
  const hoursB = new Set(profileB.activeHours)
  const intersection = new Set([...hoursA].filter((h) => hoursB.has(h)))
  const union = new Set([...hoursA, ...hoursB])
  return Math.round((intersection.size / union.size) * 100)
}

function calculateSpatialProximity(profileA: UserActivityProfile, profileB: UserActivityProfile): number {
  const nodesA = new Set(profileA.nodeIds)
  const nodesB = new Set(profileB.nodeIds)
  const spacesA = new Set(profileA.spaceIds)
  const spacesB = new Set(profileB.spaceIds)

  const nodeIntersection = [...nodesA].filter((n) => nodesB.has(n)).length
  const nodeUnion = new Set([...nodesA, ...nodesB]).size
  const nodeScore = nodeUnion > 0 ? (nodeIntersection / nodeUnion) * 100 : 0

  const spaceIntersection = [...spacesA].filter((s) => spacesB.has(s)).length
  const spaceUnion = new Set([...spacesA, ...spacesB]).size
  const spaceScore = spaceUnion > 0 ? (spaceIntersection / spaceUnion) * 100 : 0

  return Math.round(nodeScore * 0.6 + spaceScore * 0.4)
}

function calculateTrailIntersection(profileA: UserActivityProfile, profileB: UserActivityProfile): number {
  const trailsA = Object.keys(profileA.trailStrengths)
  const trailsB = Object.keys(profileB.trailStrengths)
  const allTrails = new Set([...trailsA, ...trailsB])
  if (allTrails.size === 0) return 0

  const shared = trailsA.filter((t) => trailsB.includes(t))
  const overlapRatio = shared.length / allTrails.size

  let strengthCorrelation = 0
  if (shared.length > 0) {
    let corrSum = 0
    for (const trail of shared) {
      const sA = profileA.trailStrengths[trail] || 0
      const sB = profileB.trailStrengths[trail] || 0
      corrSum += Math.min(sA, sB) / Math.max(sA, sB, 1)
    }
    strengthCorrelation = corrSum / shared.length
  }

  return Math.round((overlapRatio * 0.6 + strengthCorrelation * 0.4) * 100)
}

function calculateComplementarity(profileA: UserActivityProfile, profileB: UserActivityProfile): number {
  const skillsA = new Set(profileA.skills)
  const skillsB = new Set(profileB.skills)
  const uniqueA = [...skillsA].filter((s) => !skillsB.has(s))
  const uniqueB = [...skillsB].filter((s) => !skillsA.has(s))

  if (uniqueA.length === 0 || uniqueB.length === 0) return 0

  const ratioA = uniqueA.length / skillsA.size
  const ratioB = uniqueB.length / skillsB.size
  let score = Math.sqrt(ratioA * ratioB) * 100

  // Foundation bonus
  const sharedSkills = [...skillsA].filter((s) => skillsB.has(s))
  if (sharedSkills.length > 0) score += 15

  // Expertise bonus
  for (const skill of uniqueA) {
    const count = (profileA.questCompletions[skill] || 0) + (profileA.workUnitsProcessed[skill] || 0)
    if (count >= 5) score += 3
  }
  for (const skill of uniqueB) {
    const count = (profileB.questCompletions[skill] || 0) + (profileB.workUnitsProcessed[skill] || 0)
    if (count >= 5) score += 3
  }

  return Math.min(Math.round(score), 100)
}

function classifySynchronicity(
  dimensions: SynchronicityMatch['dimensions'],
): SynchronicityType {
  const above50 = Object.values(dimensions).filter((v) => v >= 50).length
  if (above50 >= 3) return 'multi_dimensional'

  const entries = Object.entries(dimensions) as [string, number][]
  const dominant = entries.reduce((a, b) => (b[1] > a[1] ? b : a))

  if (dominant[1] < 40) return 'multi_dimensional'

  const nameMap: Record<string, SynchronicityType> = {
    skillOverlap: 'skill_kinship',
    temporalProximity: 'temporal_rhythm',
    spatialProximity: 'spatial_convergence',
    trailIntersection: 'trail_resonance',
    complementarity: 'complementary_gifts',
  }
  return nameMap[dominant[0]] || 'multi_dimensional'
}

function calculateSynchronicityScore(
  profileA: UserActivityProfile, profileB: UserActivityProfile,
  weights: SynchronicityWeights = SYNCHRONICITY_WEIGHTS,
): SynchronicityMatch {
  const dimensions = {
    skillOverlap: calculateSkillOverlap(profileA, profileB),
    temporalProximity: calculateTemporalProximity(profileA, profileB),
    spatialProximity: calculateSpatialProximity(profileA, profileB),
    trailIntersection: calculateTrailIntersection(profileA, profileB),
    complementarity: calculateComplementarity(profileA, profileB),
  }
  const score = Math.round(
    dimensions.skillOverlap * weights.skillOverlap +
    dimensions.temporalProximity * weights.temporalProximity +
    dimensions.spatialProximity * weights.spatialProximity +
    dimensions.trailIntersection * weights.trailIntersection +
    dimensions.complementarity * weights.complementarity,
  )
  const type = classifySynchronicity(dimensions)
  return {
    userA: profileA.userId, userB: profileB.userId,
    displayNameA: profileA.displayName, displayNameB: profileB.displayName,
    score: Math.min(Math.max(score, 0), 100), dimensions, type, reason: '',
  }
}

function validateWeights(weights: SynchronicityWeights): boolean {
  const sum = weights.skillOverlap + weights.temporalProximity + weights.spatialProximity +
    weights.trailIntersection + weights.complementarity
  return Math.abs(sum - 1.0) < 0.001
}

function hasMinimumActivity(profile: UserActivityProfile): boolean {
  const questCount = Object.keys(profile.questCompletions).length
  const workCount = Object.keys(profile.workUnitsProcessed).length
  const skillCount = profile.skills.length
  return (questCount + workCount + skillCount) >= MIN_ACTIVITY_THRESHOLD
}

function findSynchronicities(
  profiles: UserActivityProfile[], options: SynchronicityOptions = {},
): SynchronicityMatch[] {
  const minScore = options.minScore ?? MIN_SYNCHRONICITY_SCORE
  const maxResults = options.maxResults ?? 50
  const eligible = profiles.filter(hasMinimumActivity)
  const matches: SynchronicityMatch[] = []

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      if (options.forUserId && eligible[i].userId !== options.forUserId && eligible[j].userId !== options.forUserId) continue
      const match = calculateSynchronicityScore(eligible[i], eligible[j])
      if (match.score >= minScore) matches.push(match)
    }
  }

  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, maxResults)
}

function determineSuggestedAction(match: SynchronicityMatch): SuggestedAction {
  if (match.score >= EXTRAORDINARY_MATCH_THRESHOLD) {
    return { type: 'collaborate', label: 'Start a joint project', priority: 1 }
  }
  if (match.score >= STRONG_MATCH_THRESHOLD) {
    return { type: 'connect', label: 'Introduce yourselves', priority: 2 }
  }
  const typeActions: Record<SynchronicityType, SuggestedAction> = {
    skill_kinship: { type: 'learn', label: 'Share skills', priority: 3 },
    temporal_rhythm: { type: 'schedule', label: 'Schedule a session', priority: 3 },
    spatial_convergence: { type: 'meet', label: 'Meet in shared space', priority: 3 },
    trail_resonance: { type: 'explore', label: 'Explore shared trails', priority: 3 },
    complementary_gifts: { type: 'exchange', label: 'Exchange expertise', priority: 3 },
    multi_dimensional: { type: 'connect', label: 'Connect and explore', priority: 4 },
  }
  return typeActions[match.type] || { type: 'connect', label: 'Connect', priority: 5 }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<UserActivityProfile> = {}): UserActivityProfile {
  return {
    userId: 'user-1', displayName: 'Alice',
    questCompletions: { analysis: 5, generation: 3 },
    workUnitsProcessed: { computation: 10, analysis: 8 },
    nodeIds: ['node-alpha'], spaceIds: ['space-general'],
    activeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    skills: ['analysis', 'computation', 'generation'],
    trustLevel: 'vouched', reputationScore: 75,
    trailStrengths: { 'ph_abc': 80, 'ph_def': 50 },
    ...overrides,
  }
}

function makeProfileB(overrides: Partial<UserActivityProfile> = {}): UserActivityProfile {
  return makeProfile({
    userId: 'user-2', displayName: 'Bob',
    questCompletions: { analysis: 4, transformation: 6 },
    workUnitsProcessed: { analysis: 5, aggregation: 7 },
    nodeIds: ['node-beta'], spaceIds: ['space-general', 'space-dev'],
    activeHours: [10, 11, 12, 13, 14, 15, 16, 17, 18],
    skills: ['analysis', 'transformation', 'aggregation'],
    trustLevel: 'full', reputationScore: 90,
    trailStrengths: { 'ph_abc': 60, 'ph_ghi': 40 },
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Edge-Case Tests
// ---------------------------------------------------------------------------

describe('Synchronicity Engine — Edge Cases', () => {
  // =========================================================================
  // 1. Trail Intersection with Zero-Strength Shared Trails
  // =========================================================================
  describe('trail intersection with zero-strength', () => {
    it('handles shared trail where both users have strength 0', () => {
      const a = makeProfile({ trailStrengths: { 'ph_zero': 0 } })
      const b = makeProfileB({ trailStrengths: { 'ph_zero': 0 } })
      const score = calculateTrailIntersection(a, b)
      // min(0,0)/max(0,0,1) = 0/1 = 0 strength correlation
      // overlap: 1/1 = 1.0, strength: 0/1 → round((1.0*0.6 + 0*0.4) * 100) = 60
      expect(typeof score).toBe('number')
      expect(Number.isNaN(score)).toBe(false)
    })

    it('returns 0 when neither user has any trails', () => {
      const a = makeProfile({ trailStrengths: {} })
      const b = makeProfileB({ trailStrengths: {} })
      const score = calculateTrailIntersection(a, b)
      expect(score).toBe(0)
    })
  })

  // =========================================================================
  // 2. Complementarity with Minimal Unique Skills
  // =========================================================================
  describe('complementarity with minimal skills', () => {
    it('returns 0 when one user has no unique skills', () => {
      const a = makeProfile({ skills: ['analysis'] })
      const b = makeProfileB({ skills: ['analysis'] })
      // Both share 'analysis', no unique skills → 0
      const score = calculateComplementarity(a, b)
      expect(score).toBe(0)
    })

    it('caps at 100 even with many bonuses', () => {
      const a = makeProfile({
        skills: ['a', 'b', 'c', 'd', 'e', 'shared'],
        questCompletions: { a: 10, b: 10, c: 10, d: 10, e: 10 },
        workUnitsProcessed: {},
      })
      const b = makeProfileB({
        skills: ['x', 'y', 'z', 'w', 'v', 'shared'],
        questCompletions: { x: 10, y: 10, z: 10, w: 10, v: 10 },
        workUnitsProcessed: {},
      })
      const score = calculateComplementarity(a, b)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  // =========================================================================
  // 3. Weights Validation — Floating-Point Edge
  // =========================================================================
  describe('weight validation floating-point', () => {
    it('accepts weights summing to 1.0 within tolerance', () => {
      const weights: SynchronicityWeights = {
        skillOverlap: 0.2, temporalProximity: 0.2, spatialProximity: 0.2,
        trailIntersection: 0.2, complementarity: 0.2,
      }
      expect(validateWeights(weights)).toBe(true)
    })

    it('accepts weights with floating-point imprecision (0.1+0.2=0.30000...04)', () => {
      const weights: SynchronicityWeights = {
        skillOverlap: 0.1 + 0.2, // 0.30000000000000004
        temporalProximity: 0.15,
        spatialProximity: 0.2,
        trailIntersection: 0.15,
        complementarity: 0.2,
      }
      expect(validateWeights(weights)).toBe(true)
    })

    it('rejects weights clearly above 1.0', () => {
      const weights: SynchronicityWeights = {
        skillOverlap: 0.3, temporalProximity: 0.3, spatialProximity: 0.3,
        trailIntersection: 0.2, complementarity: 0.2,
      }
      expect(validateWeights(weights)).toBe(false)
    })
  })

  // =========================================================================
  // 4. Profile with Only Trail Data (No Skills/Quests/Hours)
  // =========================================================================
  describe('profile with only trail data', () => {
    it('has minimum activity check fail with trails-only profile', () => {
      const profile = makeProfile({
        questCompletions: {}, workUnitsProcessed: {}, skills: [],
        trailStrengths: { 'ph_abc': 50 },
      })
      // questCount(0) + workCount(0) + skillCount(0) = 0 < 2
      expect(hasMinimumActivity(profile)).toBe(false)
    })

    it('findSynchronicities excludes sub-threshold profiles', () => {
      const a = makeProfile({
        questCompletions: {}, workUnitsProcessed: {}, skills: [],
        trailStrengths: { 'ph_abc': 80 },
      })
      const b = makeProfileB({
        questCompletions: {}, workUnitsProcessed: {}, skills: [],
        trailStrengths: { 'ph_abc': 80 },
      })
      const matches = findSynchronicities([a, b])
      expect(matches).toHaveLength(0)
    })
  })

  // =========================================================================
  // 5. forUserId Filter with Non-Existent User
  // =========================================================================
  describe('forUserId with ghost user', () => {
    it('returns empty array when forUserId matches no profile', () => {
      const a = makeProfile()
      const b = makeProfileB()
      const matches = findSynchronicities([a, b], { forUserId: 'ghost-user' })
      expect(matches).toHaveLength(0)
    })
  })

  // =========================================================================
  // 6. Classification with All Dimensions Equal
  // =========================================================================
  describe('classification tie-breaking', () => {
    it('returns multi_dimensional when all dimensions are 50', () => {
      const dimensions = {
        skillOverlap: 50, temporalProximity: 50, spatialProximity: 50,
        trailIntersection: 50, complementarity: 50,
      }
      // 5 dimensions >= 50 → multi_dimensional
      expect(classifySynchronicity(dimensions)).toBe('multi_dimensional')
    })

    it('returns multi_dimensional when all dimensions are 0', () => {
      const dimensions = {
        skillOverlap: 0, temporalProximity: 0, spatialProximity: 0,
        trailIntersection: 0, complementarity: 0,
      }
      // dominant is 0 < 40 → multi_dimensional fallback
      expect(classifySynchronicity(dimensions)).toBe('multi_dimensional')
    })

    it('selects dominant dimension when only one is high', () => {
      const dimensions = {
        skillOverlap: 80, temporalProximity: 10, spatialProximity: 10,
        trailIntersection: 10, complementarity: 10,
      }
      // Only 1 >= 50, dominant is skillOverlap at 80
      expect(classifySynchronicity(dimensions)).toBe('skill_kinship')
    })
  })

  // =========================================================================
  // 7. Temporal Proximity with Empty Hours
  // =========================================================================
  describe('temporal proximity empty hours', () => {
    it('returns 0 when first user has no active hours', () => {
      const a = makeProfile({ activeHours: [] })
      const b = makeProfileB()
      expect(calculateTemporalProximity(a, b)).toBe(0)
    })

    it('returns 100 when both users have identical hours', () => {
      const hours = [9, 10, 11, 12]
      const a = makeProfile({ activeHours: hours })
      const b = makeProfileB({ activeHours: hours })
      expect(calculateTemporalProximity(a, b)).toBe(100)
    })

    it('returns 0 when hours have no overlap', () => {
      const a = makeProfile({ activeHours: [0, 1, 2] })
      const b = makeProfileB({ activeHours: [12, 13, 14] })
      expect(calculateTemporalProximity(a, b)).toBe(0)
    })
  })

  // =========================================================================
  // 8. Suggested Action Thresholds
  // =========================================================================
  describe('suggested action at score thresholds', () => {
    it('returns "collaborate" at score 90 (extraordinary)', () => {
      const match: SynchronicityMatch = {
        userA: 'a', userB: 'b', score: 90, type: 'multi_dimensional', reason: '',
        dimensions: { skillOverlap: 90, temporalProximity: 90, spatialProximity: 90, trailIntersection: 90, complementarity: 90 },
      }
      const action = determineSuggestedAction(match)
      expect(action.type).toBe('collaborate')
      expect(action.priority).toBe(1)
    })

    it('returns "connect" at score 70 (strong)', () => {
      const match: SynchronicityMatch = {
        userA: 'a', userB: 'b', score: 70, type: 'skill_kinship', reason: '',
        dimensions: { skillOverlap: 70, temporalProximity: 50, spatialProximity: 50, trailIntersection: 50, complementarity: 50 },
      }
      const action = determineSuggestedAction(match)
      expect(action.type).toBe('connect')
      expect(action.priority).toBe(2)
    })

    it('returns type-specific action below strong threshold', () => {
      const match: SynchronicityMatch = {
        userA: 'a', userB: 'b', score: 55, type: 'trail_resonance', reason: '',
        dimensions: { skillOverlap: 30, temporalProximity: 30, spatialProximity: 30, trailIntersection: 80, complementarity: 30 },
      }
      const action = determineSuggestedAction(match)
      expect(action.type).toBe('explore')
    })
  })
})
