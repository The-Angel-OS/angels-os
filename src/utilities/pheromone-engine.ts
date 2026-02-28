/**
 * Pheromone Engine — Sprint 29
 *
 * Swarm intelligence for Angel OS. Every successful LEO navigation leaves a
 * digital scent trail. Trails strengthen with use, decay with time, and
 * weaken with abandonments. The UI grows along the lines of desire — the
 * ant colony finding the shortest path to food without a central controller.
 *
 * Inspired by:
 * - Crichton's Prey: simple rules → emergent behavior
 * - Suarez's Daemon: distributed agents reacting to real-world triggers
 * - Conway's Game of Life: survival (neighbors), death (isolation), reproduction
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/collections/Intelligence/Pheromones.ts — persistence layer
 * @see src/endpoints/leo-stream.ts — recording integration
 * @see tests/unit/utilities/pheromoneEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PheromoneData {
  id?: number | string
  contextHash: string
  path: string
  toolName?: string
  strength: number
  successfulTraversals: number
  abandonments: number
  lastTraversedAt: string // ISO date
  decay?: string // ISO date
  createdAt?: string // ISO date (from Payload timestamps)
}

export interface PheromoneContext {
  /** The user's message/intent */
  query: string
  /** Which LEO tool was invoked */
  toolName?: string
  /** Tenant slug for scoping */
  tenantSlug?: string
  /** Extra context (location, urgency, etc.) */
  additionalContext?: string
}

export interface TraversalResult {
  pheromone: PheromoneData
  isNew: boolean
  previousStrength: number
  newStrength: number
}

export interface PathRecommendation {
  path: string
  strength: number
  traversals: number
  lastUsed: string
  toolName?: string
}

// ---------------------------------------------------------------------------
// Constants — The DNA of the Ant Colony
// ---------------------------------------------------------------------------

/** Trails fade over ~3 weeks (half-life). */
export const PHEROMONE_HALF_LIFE_DAYS = 21

/** Exponential decay denominator: exp(-age / DECAY_CONSTANT). */
export const PHEROMONE_DECAY_CONSTANT = 30

/** Maximum pheromone intensity. */
export const PHEROMONE_MAX_STRENGTH = 100

/** Base strength added per successful traversal. */
export const PHEROMONE_TRAVERSAL_WEIGHT = 10

/** Penalty factor for abandonments (0-1). At 100% abandonment, 50% penalty. */
export const PHEROMONE_ABANDONMENT_PENALTY = 0.5

/** Days until a pheromone becomes eligible for cleanup. */
export const PHEROMONE_DEFAULT_TTL_DAYS = 90

/** Below this strength, pheromones are candidates for deletion. */
export const PHEROMONE_DECAY_THRESHOLD = 1

/** Circuit breaker: max autonomous navigations per conversation. */
export const MAX_NAVIGATION_HOPS_PER_CONVERSATION = 5

// ---------------------------------------------------------------------------
// Context Hashing — The Scent Signature
// ---------------------------------------------------------------------------

/**
 * Deterministic hash of user intent for grouping similar queries.
 *
 * NOT cryptographic — just consistent bucketing. Normalizes by:
 * 1. Lowercase
 * 2. Strip common stopwords
 * 3. Sort remaining tokens alphabetically
 * 4. Simple string hash (djb2)
 *
 * "emergency food clearwater" and "clearwater food emergency" → same hash.
 */
export function hashContext(ctx: PheromoneContext): string {
  const parts: string[] = []

  if (ctx.query) {
    parts.push(normalizeQuery(ctx.query))
  }
  if (ctx.toolName) {
    parts.push(`tool:${ctx.toolName}`)
  }
  if (ctx.tenantSlug) {
    parts.push(`tenant:${ctx.tenantSlug}`)
  }
  if (ctx.additionalContext) {
    parts.push(normalizeQuery(ctx.additionalContext))
  }

  const combined = parts.join('|')
  return `ph_${djb2Hash(combined)}`
}

/** Strip stopwords, lowercase, sort tokens. */
function normalizeQuery(text: string): string {
  const stopwords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'shall',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'it',
    'its',
    'i',
    'me',
    'my',
    'we',
    'our',
    'you',
    'your',
    'he',
    'she',
    'they',
    'them',
    'this',
    'that',
    'and',
    'or',
    'but',
    'not',
    'so',
    'if',
    'as',
    'up',
  ])

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopwords.has(w))
    .sort()
    .join(' ')
}

/** DJB2 hash — fast, simple, deterministic. Returns hex string. */
function djb2Hash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// ---------------------------------------------------------------------------
// Strength Calculation — The Pheromone Formula
// ---------------------------------------------------------------------------

/**
 * Calculate pheromone strength based on traversals, age, and abandonments.
 *
 * Formula: min(100, traversals × 10) × exp(-age/30) × (1 - abandonRatio × 0.5)
 *
 * - 10 traversals at age 0 with no abandonments = 100 (maximum)
 * - At 21 days (half-life), strength ≈ 50% of peak
 * - At 100% abandonment ratio, strength halved further
 *
 * @param traversals  Number of successful follows
 * @param ageInDays   Days since pheromone creation
 * @param abandonments Number of bounces/back-navigations
 */
export function calculateStrength(
  traversals: number,
  ageInDays: number,
  abandonments: number,
): number {
  // Guard: NaN, Infinity, and non-positive traversals all produce zero
  if (!Number.isFinite(traversals) || traversals <= 0) return 0
  if (!Number.isFinite(ageInDays)) return 0
  if (!Number.isFinite(abandonments)) abandonments = 0

  // Sanitize: treat negatives as zero
  abandonments = Math.max(0, abandonments)

  // Raw strength from traversal count (capped at max)
  const rawStrength = Math.min(
    PHEROMONE_MAX_STRENGTH,
    traversals * PHEROMONE_TRAVERSAL_WEIGHT,
  )

  // Exponential time decay — trails evaporate
  const effectiveAge = Math.max(0, ageInDays) // no future-decay
  const decayFactor = Math.exp(-effectiveAge / PHEROMONE_DECAY_CONSTANT)

  // Abandonment penalty — bounced trails lose credibility
  const totalAttempts = traversals + abandonments
  const abandonmentRatio = totalAttempts > 0 ? abandonments / totalAttempts : 0
  const abandonmentFactor = 1 - abandonmentRatio * PHEROMONE_ABANDONMENT_PENALTY

  const result = rawStrength * decayFactor * abandonmentFactor
  // Final guard: ensure result is a valid non-negative number
  return Number.isFinite(result) ? Math.max(0, Math.round(result)) : 0
}

// ---------------------------------------------------------------------------
// Temporal Utilities
// ---------------------------------------------------------------------------

/**
 * Calculate TTL date for a pheromone trail.
 * @returns ISO date string `PHEROMONE_DEFAULT_TTL_DAYS` in the future.
 */
export function calculateDecayDate(fromDate: Date = new Date()): string {
  const decay = new Date(fromDate)
  decay.setDate(decay.getDate() + PHEROMONE_DEFAULT_TTL_DAYS)
  return decay.toISOString()
}

/**
 * Calculate age of a pheromone in days.
 */
export function ageInDays(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt)
  return Math.max(0, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Traversal Management — The Ant Follows the Trail
// ---------------------------------------------------------------------------

/**
 * Build a traversal result — create a new pheromone or strengthen an existing one.
 *
 * @param existing  Existing pheromone data (null if first traversal)
 * @param ctx       Context that triggered the traversal
 * @param path      The UI route navigated to
 * @param now       Current timestamp (injectable for testing)
 */
export function buildTraversal(
  existing: PheromoneData | null,
  ctx: PheromoneContext,
  path: string,
  now: Date = new Date(),
): TraversalResult {
  const contextHash = hashContext(ctx)

  if (!existing) {
    // First ant finds the food — lay a new trail
    const newPheromone: PheromoneData = {
      contextHash,
      path,
      toolName: ctx.toolName,
      strength: PHEROMONE_TRAVERSAL_WEIGHT,
      successfulTraversals: 1,
      abandonments: 0,
      lastTraversedAt: now.toISOString(),
      decay: calculateDecayDate(now),
      createdAt: now.toISOString(),
    }
    return {
      pheromone: newPheromone,
      isNew: true,
      previousStrength: 0,
      newStrength: PHEROMONE_TRAVERSAL_WEIGHT,
    }
  }

  // Existing trail — reinforce it
  const previousStrength = existing.strength
  const newTraversals = existing.successfulTraversals + 1
  const age = ageInDays(existing.createdAt || now.toISOString(), now)
  const newStrength = calculateStrength(newTraversals, age, existing.abandonments)

  const updated: PheromoneData = {
    ...existing,
    successfulTraversals: newTraversals,
    strength: newStrength,
    lastTraversedAt: now.toISOString(),
    decay: calculateDecayDate(now),
  }

  return {
    pheromone: updated,
    isNew: false,
    previousStrength,
    newStrength,
  }
}

// ---------------------------------------------------------------------------
// Decay Engine — The Scent Evaporates
// ---------------------------------------------------------------------------

/**
 * Batch decay: recalculate strength for a set of pheromones.
 * Separates into `updated` (still alive) and `expired` (below threshold).
 *
 * The caller handles actual DB writes/deletes.
 */
export function applyDecay(
  pheromones: PheromoneData[],
  now: Date = new Date(),
): { updated: PheromoneData[]; expired: PheromoneData[] } {
  const updated: PheromoneData[] = []
  const expired: PheromoneData[] = []

  for (const p of pheromones) {
    const age = ageInDays(p.createdAt || p.lastTraversedAt, now)
    const newStrength = calculateStrength(p.successfulTraversals, age, p.abandonments)

    const decayed: PheromoneData = { ...p, strength: newStrength }

    if (newStrength >= PHEROMONE_DECAY_THRESHOLD) {
      updated.push(decayed)
    } else {
      expired.push(decayed)
    }
  }

  return { updated, expired }
}

// ---------------------------------------------------------------------------
// Path Ranking — The Colony Chooses the Strongest Trail
// ---------------------------------------------------------------------------

/**
 * Rank paths by pheromone strength. Deduplicates by path (keeps strongest).
 */
export function rankPaths(
  pheromones: PheromoneData[],
  limit: number = 5,
): PathRecommendation[] {
  // Guard: non-positive or invalid limit returns empty
  if (!Number.isFinite(limit) || limit <= 0) return []
  limit = Math.floor(limit) // integer only

  // Sort by strength descending
  const sorted = [...pheromones].sort((a, b) => b.strength - a.strength)

  // Deduplicate by path (keep strongest)
  const seen = new Set<string>()
  const results: PathRecommendation[] = []

  for (const p of sorted) {
    if (seen.has(p.path)) continue
    seen.add(p.path)
    results.push({
      path: p.path,
      strength: p.strength,
      traversals: p.successfulTraversals,
      lastUsed: p.lastTraversedAt,
      toolName: p.toolName,
    })
    if (results.length >= limit) break
  }

  return results
}

// ---------------------------------------------------------------------------
// Abandonment — The Trail Weakens
// ---------------------------------------------------------------------------

/**
 * Record an abandonment (user bounced/back-navigated after following a trail).
 * Increments abandonment counter and recalculates strength downward.
 */
export function recordAbandonment(
  existing: PheromoneData,
  now: Date = new Date(),
): PheromoneData {
  const newAbandonments = existing.abandonments + 1
  const age = ageInDays(existing.createdAt || existing.lastTraversedAt, now)
  const newStrength = calculateStrength(
    existing.successfulTraversals,
    age,
    newAbandonments,
  )

  return {
    ...existing,
    abandonments: newAbandonments,
    strength: newStrength,
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker — The Colony Doesn't Run Forever
// ---------------------------------------------------------------------------

/**
 * Should we pause autonomous navigation?
 * Returns true if hop count exceeds the per-conversation limit.
 *
 * Prevents the Prey scenario: an AI navigating endlessly without human input.
 */
export function shouldCircuitBreak(hopCount: number): boolean {
  // Guard: NaN or non-finite hop count → break (safe default)
  if (!Number.isFinite(hopCount)) return true
  return hopCount >= MAX_NAVIGATION_HOPS_PER_CONVERSATION
}
