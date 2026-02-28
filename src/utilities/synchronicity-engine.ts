/**
 * Synchronicity Engine — Pattern Detection Across the Mesh
 *
 * Pure TypeScript — zero Payload imports, fully unit-testable.
 * Follows pheromone-engine.ts and workload-engine.ts patterns.
 *
 * Detects meaningful overlaps between users based on:
 *   - Skill overlap (quest completion patterns)
 *   - Temporal proximity (active at the same times)
 *   - Spatial proximity (shared nodes/spaces)
 *   - Pheromone trail intersection (past successful collaboration)
 *   - Complementary skills (you have X, they have Y, together = Z)
 *
 * Synchronicities aren't magic — they're pheromone trail intersections
 * made visible. The submarine currents that guide the fleet.
 *
 * @see src/utilities/pheromone-engine.ts — trail data structures
 * @see src/utilities/workload-engine.ts — pure engine pattern
 * @see src/utilities/federationEngine.ts — trust levels
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** A user's activity profile — built from quest completions, work units, spaces */
export interface UserActivityProfile {
  userId: string
  displayName?: string

  /** Quest completions grouped by quest type/category */
  questCompletions: Record<string, number> // e.g. { 'analysis': 5, 'generation': 3 }

  /** Work units processed grouped by work type */
  workUnitsProcessed: Record<string, number> // e.g. { 'computation': 12, 'analysis': 8 }

  /** Node/endeavor IDs this user belongs to */
  nodeIds: string[]

  /** Space IDs this user is active in */
  spaceIds: string[]

  /** Hours of day when user is typically active (0-23) */
  activeHours: number[]

  /** Skills derived from quest completions + work history */
  skills: string[]

  /** Trust level in the federation */
  trustLevel: string

  /** Total XP or reputation score */
  reputationScore: number

  /** Pheromone trail strengths for paths this user has traversed */
  trailStrengths: Record<string, number> // contextHash → strength
}

/** A detected synchronicity between two users */
export interface SynchronicityMatch {
  userA: string
  userB: string
  displayNameA?: string
  displayNameB?: string

  /** Overall synchronicity score (0-100) */
  score: number

  /** Individual dimension scores */
  dimensions: {
    skillOverlap: number       // 0-100: shared quest types
    temporalProximity: number  // 0-100: active at same times
    spatialProximity: number   // 0-100: shared nodes/spaces
    trailIntersection: number  // 0-100: pheromone path overlap
    complementarity: number    // 0-100: non-overlapping skills that combine well
  }

  /** What kind of synchronicity this is */
  type: SynchronicityType

  /** Human-readable reason */
  reason: string
}

export type SynchronicityType =
  | 'skill_twins'        // high skill overlap — natural collaborators
  | 'complementary'      // low overlap but strong complementarity — mentorship potential
  | 'co_temporal'        // active at same times — natural pair
  | 'trail_crossers'     // pheromone trails intersect — past indirect collaboration
  | 'node_neighbors'     // same node/space — spatial proximity
  | 'multi_dimensional'  // strong across multiple dimensions

/** A nudge message generated from a synchronicity match */
export interface SynchronicityNudge {
  /** Target user(s) to receive the nudge */
  targetUsers: string[]

  /** The synchronicity that triggered this nudge */
  match: SynchronicityMatch

  /** Human-readable nudge message */
  message: string

  /** Suggested action */
  suggestedAction: SuggestedAction

  /** Priority — higher score = more important to surface */
  priority: number
}

export type SuggestedAction =
  | 'collaborate'   // work together on a quest
  | 'mentor'        // one can teach the other
  | 'bridge'        // connect two nodes
  | 'team_up'       // join the same quest
  | 'introduce'     // just meet each other

/** Options for the synchronicity search */
export interface SynchronicityOptions {
  /** Minimum score threshold to include (default: 40) */
  minScore?: number

  /** Maximum matches to return (default: 10) */
  maxResults?: number

  /** Weights for each dimension (must sum to 1.0) */
  weights?: SynchronicityWeights

  /** Exclude matches between users who share a node (they already know each other) */
  excludeSameNode?: boolean

  /** Only find matches for a specific user (default: all pairs) */
  forUserId?: string
}

export interface SynchronicityWeights {
  skillOverlap: number
  temporalProximity: number
  spatialProximity: number
  trailIntersection: number
  complementarity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Default weights for synchronicity dimensions */
export const SYNCHRONICITY_WEIGHTS: SynchronicityWeights = {
  skillOverlap: 0.30,        // 30% — shared skills are the strongest signal
  temporalProximity: 0.15,   // 15% — same active hours
  spatialProximity: 0.20,    // 20% — shared nodes/spaces
  trailIntersection: 0.15,   // 15% — pheromone path overlap
  complementarity: 0.20,     // 20% — complementary skills
}

/** Minimum score to consider a match meaningful */
export const MIN_SYNCHRONICITY_SCORE = 40

/** Maximum results to return from a search */
export const MAX_SYNCHRONICITY_RESULTS = 10

/** Minimum skills/completions needed to generate meaningful matches */
export const MIN_ACTIVITY_THRESHOLD = 2

/** Score above which a match is considered "strong" */
export const STRONG_MATCH_THRESHOLD = 70

/** Score above which a match is considered "extraordinary" */
export const EXTRAORDINARY_MATCH_THRESHOLD = 90

// ═══════════════════════════════════════════════════════════════════════════
// Dimension Scoring Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate skill overlap between two users using Jaccard similarity.
 * Measures how many quest types / work types they share.
 *
 * @returns 0-100 score
 */
export function calculateSkillOverlap(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
): number {
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

  if (union.size === 0) return 0

  // Jaccard similarity → 0-100
  const jaccard = intersection.size / union.size

  // Bonus for depth — if both have high counts in shared categories
  let depthBonus = 0
  for (const skill of intersection) {
    const countA =
      (profileA.questCompletions[skill] || 0) + (profileA.workUnitsProcessed[skill] || 0)
    const countB =
      (profileB.questCompletions[skill] || 0) + (profileB.workUnitsProcessed[skill] || 0)
    if (countA >= 3 && countB >= 3) {
      depthBonus += 5
    }
  }

  return Math.min(100, Math.round(jaccard * 100 + depthBonus))
}

/**
 * Calculate temporal proximity — how much their active hours overlap.
 *
 * @returns 0-100 score
 */
export function calculateTemporalProximity(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
): number {
  const hoursA = new Set(profileA.activeHours)
  const hoursB = new Set(profileB.activeHours)

  if (hoursA.size === 0 || hoursB.size === 0) return 0

  const intersection = new Set([...hoursA].filter((h) => hoursB.has(h)))
  const union = new Set([...hoursA, ...hoursB])

  if (union.size === 0) return 0

  return Math.round((intersection.size / union.size) * 100)
}

/**
 * Calculate spatial proximity — shared nodes and spaces.
 *
 * @returns 0-100 score
 */
export function calculateSpatialProximity(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
): number {
  const nodesA = new Set(profileA.nodeIds)
  const nodesB = new Set(profileB.nodeIds)
  const spacesA = new Set(profileA.spaceIds)
  const spacesB = new Set(profileB.spaceIds)

  // Shared nodes (weighted higher — same organization)
  const sharedNodes = [...nodesA].filter((n) => nodesB.has(n)).length
  const totalNodes = new Set([...nodesA, ...nodesB]).size

  // Shared spaces (weighted lower — same chat channel)
  const sharedSpaces = [...spacesA].filter((s) => spacesB.has(s)).length
  const totalSpaces = new Set([...spacesA, ...spacesB]).size

  const nodeScore = totalNodes > 0 ? (sharedNodes / totalNodes) * 100 : 0
  const spaceScore = totalSpaces > 0 ? (sharedSpaces / totalSpaces) * 100 : 0

  // Nodes weighted 60%, spaces 40%
  return Math.round(nodeScore * 0.6 + spaceScore * 0.4)
}

/**
 * Calculate pheromone trail intersection — shared paths through the system.
 *
 * @returns 0-100 score
 */
export function calculateTrailIntersection(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
): number {
  const trailsA = profileA.trailStrengths
  const trailsB = profileB.trailStrengths

  const hashesA = new Set(Object.keys(trailsA))
  const hashesB = new Set(Object.keys(trailsB))

  if (hashesA.size === 0 || hashesB.size === 0) return 0

  const sharedHashes = [...hashesA].filter((h) => hashesB.has(h))

  if (sharedHashes.length === 0) return 0

  // Intersection ratio
  const union = new Set([...hashesA, ...hashesB])
  const overlapRatio = sharedHashes.length / union.size

  // Strength correlation — do they have similar strength on shared trails?
  let strengthCorrelation = 0
  for (const hash of sharedHashes) {
    const sA = trailsA[hash] || 0
    const sB = trailsB[hash] || 0
    // Both strong on same trail = high correlation
    const combined = Math.min(sA, sB) / Math.max(sA, sB, 1)
    strengthCorrelation += combined
  }
  strengthCorrelation = sharedHashes.length > 0 ? strengthCorrelation / sharedHashes.length : 0

  // 60% overlap ratio + 40% strength correlation
  return Math.min(100, Math.round(overlapRatio * 60 + strengthCorrelation * 40))
}

/**
 * Calculate complementarity — non-overlapping skills that combine meaningfully.
 * High complementarity = mentorship potential or powerful team combinations.
 *
 * @returns 0-100 score
 */
export function calculateComplementarity(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
): number {
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

  if (skillsA.size === 0 || skillsB.size === 0) return 0

  // Skills unique to A that B doesn't have
  const uniqueToA = [...skillsA].filter((s) => !skillsB.has(s))
  // Skills unique to B that A doesn't have
  const uniqueToB = [...skillsB].filter((s) => !skillsA.has(s))

  // Both need unique skills for complementarity
  if (uniqueToA.length === 0 || uniqueToB.length === 0) return 0

  // Complementarity is highest when both have substantial unique skills
  // but also some shared foundation (not completely alien to each other)
  const intersection = [...skillsA].filter((s) => skillsB.has(s))
  const hasSharedFoundation = intersection.length > 0

  // Base: geometric mean of unique skill ratios
  const ratioA = uniqueToA.length / skillsA.size
  const ratioB = uniqueToB.length / skillsB.size
  const complementBase = Math.sqrt(ratioA * ratioB) * 100

  // Bonus for shared foundation (complementary is better with some overlap)
  const foundationBonus = hasSharedFoundation ? 15 : 0

  // Depth bonus — if unique skills have high completion counts (expertise)
  let expertiseBonus = 0
  for (const skill of uniqueToA) {
    const count =
      (profileA.questCompletions[skill] || 0) + (profileA.workUnitsProcessed[skill] || 0)
    if (count >= 5) expertiseBonus += 3
  }
  for (const skill of uniqueToB) {
    const count =
      (profileB.questCompletions[skill] || 0) + (profileB.workUnitsProcessed[skill] || 0)
    if (count >= 5) expertiseBonus += 3
  }

  return Math.min(100, Math.round(complementBase + foundationBonus + expertiseBonus))
}

// ═══════════════════════════════════════════════════════════════════════════
// Composite Scoring
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the overall synchronicity score between two users.
 * Returns a SynchronicityMatch with dimension breakdown.
 */
export function calculateSynchronicityScore(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
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
  const reason = generateReason(profileA, profileB, dimensions, type)

  return {
    userA: profileA.userId,
    userB: profileB.userId,
    displayNameA: profileA.displayName,
    displayNameB: profileB.displayName,
    score: Math.min(100, score),
    dimensions,
    type,
    reason,
  }
}

/**
 * Classify what type of synchronicity this match represents.
 */
export function classifySynchronicity(
  dimensions: SynchronicityMatch['dimensions'],
): SynchronicityType {
  const { skillOverlap, temporalProximity, spatialProximity, trailIntersection, complementarity } =
    dimensions

  // Check for multi-dimensional (3+ dimensions above 50)
  const strongDimensions = [
    skillOverlap,
    temporalProximity,
    spatialProximity,
    trailIntersection,
    complementarity,
  ].filter((d) => d >= 50).length

  if (strongDimensions >= 3) return 'multi_dimensional'

  // Find dominant dimension
  const max = Math.max(
    skillOverlap,
    temporalProximity,
    spatialProximity,
    trailIntersection,
    complementarity,
  )

  if (max === complementarity && complementarity >= 40) return 'complementary'
  if (max === skillOverlap && skillOverlap >= 40) return 'skill_twins'
  if (max === temporalProximity && temporalProximity >= 40) return 'co_temporal'
  if (max === trailIntersection && trailIntersection >= 40) return 'trail_crossers'
  if (max === spatialProximity && spatialProximity >= 40) return 'node_neighbors'

  // Default to the highest
  if (complementarity === max) return 'complementary'
  if (skillOverlap === max) return 'skill_twins'
  if (temporalProximity === max) return 'co_temporal'
  if (trailIntersection === max) return 'trail_crossers'
  return 'node_neighbors'
}

/**
 * Generate a human-readable reason for the synchronicity.
 */
export function generateReason(
  profileA: UserActivityProfile,
  profileB: UserActivityProfile,
  dimensions: SynchronicityMatch['dimensions'],
  type: SynchronicityType,
): string {
  const nameA = profileA.displayName || `User ${profileA.userId}`
  const nameB = profileB.displayName || `User ${profileB.userId}`

  switch (type) {
    case 'skill_twins': {
      const sharedSkills = profileA.skills.filter((s) => profileB.skills.includes(s))
      const skillList = sharedSkills.slice(0, 3).join(', ') || 'multiple areas'
      return `${nameA} and ${nameB} share expertise in ${skillList} — natural collaborators`
    }
    case 'complementary': {
      const uniqueA = profileA.skills.filter((s) => !profileB.skills.includes(s)).slice(0, 2)
      const uniqueB = profileB.skills.filter((s) => !profileA.skills.includes(s)).slice(0, 2)
      return `${nameA} brings ${uniqueA.join(', ') || 'unique skills'} while ${nameB} brings ${uniqueB.join(', ') || 'different expertise'} — stronger together`
    }
    case 'co_temporal':
      return `${nameA} and ${nameB} are active at the same times — natural rhythm alignment`
    case 'trail_crossers':
      return `${nameA} and ${nameB} have walked similar paths through the federation — invisible connections made visible`
    case 'node_neighbors': {
      const sharedNodes = profileA.nodeIds.filter((n) => profileB.nodeIds.includes(n))
      return `${nameA} and ${nameB} share ${sharedNodes.length} node${sharedNodes.length === 1 ? '' : 's'} — proximity creates possibility`
    }
    case 'multi_dimensional':
      return `${nameA} and ${nameB} are connected across ${Object.values(dimensions).filter((d) => d >= 50).length} dimensions — a profound synchronicity`
    default:
      return `${nameA} and ${nameB} share an unexpected connection`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Search & Discovery
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find synchronicities across a set of user activity profiles.
 * Returns the top matches sorted by score.
 *
 * This is the core discovery function — O(n²) pairwise comparison,
 * but n is bounded by federation size (typically < 1000 active users).
 */
export function findSynchronicities(
  profiles: UserActivityProfile[],
  options: SynchronicityOptions = {},
): SynchronicityMatch[] {
  const {
    minScore = MIN_SYNCHRONICITY_SCORE,
    maxResults = MAX_SYNCHRONICITY_RESULTS,
    weights = SYNCHRONICITY_WEIGHTS,
    excludeSameNode = false,
    forUserId,
  } = options

  // Filter profiles with minimum activity
  const activeProfiles = profiles.filter(
    (p) =>
      Object.keys(p.questCompletions).length +
        Object.keys(p.workUnitsProcessed).length +
        p.skills.length >=
      MIN_ACTIVITY_THRESHOLD,
  )

  const matches: SynchronicityMatch[] = []

  for (let i = 0; i < activeProfiles.length; i++) {
    for (let j = i + 1; j < activeProfiles.length; j++) {
      const profileA = activeProfiles[i]
      const profileB = activeProfiles[j]

      // If searching for a specific user, skip pairs that don't include them
      if (forUserId && profileA.userId !== forUserId && profileB.userId !== forUserId) {
        continue
      }

      // Optionally exclude same-node users
      if (excludeSameNode) {
        const sharedNodes = profileA.nodeIds.filter((n) => profileB.nodeIds.includes(n))
        if (sharedNodes.length > 0) continue
      }

      const match = calculateSynchronicityScore(profileA, profileB, weights)

      if (match.score >= minScore) {
        matches.push(match)
      }
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score)

  return matches.slice(0, maxResults)
}

/**
 * Find synchronicities for a single user against all others.
 * Convenience wrapper around findSynchronicities.
 */
export function findUserSynchronicities(
  targetProfile: UserActivityProfile,
  allProfiles: UserActivityProfile[],
  options: Omit<SynchronicityOptions, 'forUserId'> = {},
): SynchronicityMatch[] {
  return findSynchronicities(allProfiles, {
    ...options,
    forUserId: targetProfile.userId,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Nudge Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a nudge message from a synchronicity match.
 * These are the messages LEO delivers to users.
 */
export function generateNudge(match: SynchronicityMatch): SynchronicityNudge {
  const action = determineSuggestedAction(match)
  const message = buildNudgeMessage(match, action)

  return {
    targetUsers: [match.userA, match.userB],
    match,
    message,
    suggestedAction: action,
    priority: match.score,
  }
}

/**
 * Generate nudges for all matches above a threshold.
 * Limits to top N to avoid notification fatigue.
 */
export function generateNudges(
  matches: SynchronicityMatch[],
  maxNudges: number = 5,
): SynchronicityNudge[] {
  return matches
    .filter((m) => m.score >= MIN_SYNCHRONICITY_SCORE)
    .slice(0, maxNudges)
    .map(generateNudge)
}

/**
 * Determine what action to suggest based on the synchronicity type.
 */
export function determineSuggestedAction(match: SynchronicityMatch): SuggestedAction {
  switch (match.type) {
    case 'skill_twins':
      return 'team_up'
    case 'complementary':
      return 'mentor'
    case 'co_temporal':
      return 'collaborate'
    case 'trail_crossers':
      return 'introduce'
    case 'node_neighbors':
      return 'collaborate'
    case 'multi_dimensional':
      return match.score >= EXTRAORDINARY_MATCH_THRESHOLD ? 'team_up' : 'collaborate'
    default:
      return 'introduce'
  }
}

/**
 * Build the human-readable nudge message.
 */
export function buildNudgeMessage(match: SynchronicityMatch, action: SuggestedAction): string {
  const nameA = match.displayNameA || `User ${match.userA}`
  const nameB = match.displayNameB || `User ${match.userB}`
  const score = match.score

  const intro =
    score >= EXTRAORDINARY_MATCH_THRESHOLD
      ? `🌟 **Extraordinary synchronicity detected!**`
      : score >= STRONG_MATCH_THRESHOLD
        ? `✨ **Strong connection found!**`
        : `🔮 **Synchronicity detected!**`

  const actionText: Record<SuggestedAction, string> = {
    collaborate: `Consider collaborating on a quest together.`,
    mentor: `One of you could mentor the other — complementary skills detected.`,
    bridge: `You could bridge two parts of the federation together.`,
    team_up: `You'd make a powerful team — consider joining a quest together.`,
    introduce: `You might want to connect — you've been walking parallel paths.`,
  }

  return [
    intro,
    '',
    match.reason,
    '',
    `**Synchronicity score: ${score}/100**`,
    '',
    `💡 ${actionText[action]}`,
  ].join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile Building Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a UserActivityProfile from raw data.
 * This is the bridge between Payload collections and pure engine logic.
 * Meant to be called from a handler, NOT from the engine itself.
 */
export function buildActivityProfile(data: {
  userId: string
  displayName?: string
  questCompletions?: Array<{ type: string; count: number }>
  workUnits?: Array<{ type: string; count: number }>
  nodeIds?: string[]
  spaceIds?: string[]
  activeHours?: number[]
  skills?: string[]
  trustLevel?: string
  reputationScore?: number
  trails?: Array<{ contextHash: string; strength: number }>
}): UserActivityProfile {
  const questCompletions: Record<string, number> = {}
  for (const qc of data.questCompletions || []) {
    questCompletions[qc.type] = (questCompletions[qc.type] || 0) + qc.count
  }

  const workUnitsProcessed: Record<string, number> = {}
  for (const wu of data.workUnits || []) {
    workUnitsProcessed[wu.type] = (workUnitsProcessed[wu.type] || 0) + wu.count
  }

  const trailStrengths: Record<string, number> = {}
  for (const trail of data.trails || []) {
    trailStrengths[trail.contextHash] = trail.strength
  }

  return {
    userId: data.userId,
    displayName: data.displayName,
    questCompletions,
    workUnitsProcessed,
    nodeIds: data.nodeIds || [],
    spaceIds: data.spaceIds || [],
    activeHours: data.activeHours || [],
    skills: data.skills || [],
    trustLevel: data.trustLevel || 'none',
    reputationScore: data.reputationScore || 0,
    trailStrengths,
  }
}

/**
 * Validate that synchronicity weights sum to 1.0.
 */
export function validateWeights(weights: SynchronicityWeights): boolean {
  const sum =
    weights.skillOverlap +
    weights.temporalProximity +
    weights.spatialProximity +
    weights.trailIntersection +
    weights.complementarity

  return Math.abs(sum - 1.0) < 0.001
}

/**
 * Check if a user has enough activity data to generate meaningful matches.
 */
export function hasMinimumActivity(profile: UserActivityProfile): boolean {
  const totalActivity =
    Object.keys(profile.questCompletions).length +
    Object.keys(profile.workUnitsProcessed).length +
    profile.skills.length

  return totalActivity >= MIN_ACTIVITY_THRESHOLD
}
