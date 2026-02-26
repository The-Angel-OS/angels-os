/**
 * Federation Rate Limiter — Blast Radius Containment
 *
 * Per-Enterprise sliding window rate limits on all federation actions.
 * A compromised Enterprise can only spam at its rate limit — cannot flood the network.
 *
 * Implementation: In-memory Map with TTL cleanup (no Redis needed at this scale).
 * Each Enterprise gets independent counters per action type.
 *
 * Constitutional Reference: Article II (Anti-Demonic Safeguards) — structural protection
 * against automated abuse. No agent or Enterprise can overwhelm another.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type RateLimitAction =
  | 'heartbeat'
  | 'catalog_browse'
  | 'skill_invoke'
  | 'vouch'
  | 'payment'
  | 'discovery'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  retryAfterSeconds: number
  windowSeconds: number
}

interface RateLimitEntry {
  timestamps: number[] // Timestamps of requests within the window
}

// ── Configuration ──────────────────────────────────────────────────────────

/** Default rate limits per hour per Enterprise, per action type */
const DEFAULT_LIMITS: Record<RateLimitAction, number> = {
  heartbeat: 15,       // Expected: 12/hour (every 5 min). Buffer: 15
  catalog_browse: 60,  // Generous for active browsing
  skill_invoke: 30,    // Skills cost money — natural throttle + this guard
  vouch: 5,            // Vouching is rare and intentional
  payment: 10,         // Payments are serious — rate limit strictly
  discovery: 30,       // Discovery requests are lightweight but shouldn't flood
}

/** Rate limit window in seconds (1 hour) */
const WINDOW_SECONDS = 3600

/** Cleanup interval: remove expired entries every 10 minutes */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

// ── State ──────────────────────────────────────────────────────────────────

/**
 * In-memory rate limit store.
 * Key: `${federationId}:${action}`
 * Value: Array of request timestamps within the window
 *
 * This resets on server restart — intentional for a stateless deployment.
 * A compromised node that restarts gets a fresh budget, which is acceptable
 * because the rate limit is about burst protection, not long-term tracking.
 */
const store = new Map<string, RateLimitEntry>()

// ── Cleanup ────────────────────────────────────────────────────────────────

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    const windowMs = WINDOW_SECONDS * 1000

    for (const [key, entry] of store.entries()) {
      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
      // Remove empty entries
      if (entry.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)

  // Don't block Node.js from exiting
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

// Start cleanup on module load
startCleanup()

// ── Core ───────────────────────────────────────────────────────────────────

/**
 * Check if a federation request is within rate limits.
 * If allowed, the request is counted against the limit.
 * If denied, returns retry-after information.
 *
 * @param federationId - The requesting Enterprise's federation UUID
 * @param action - The type of federation action being performed
 * @param customLimits - Optional override for default limits
 * @returns RateLimitResult with allowed status and remaining budget
 */
export function checkRateLimit(
  federationId: string,
  action: RateLimitAction,
  customLimits?: Partial<Record<RateLimitAction, number>>,
): RateLimitResult {
  const limit = customLimits?.[action] ?? DEFAULT_LIMITS[action]
  const key = `${federationId}:${action}`
  const now = Date.now()
  const windowMs = WINDOW_SECONDS * 1000

  // Get or create entry
  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  // Check limit
  if (entry.timestamps.length >= limit) {
    // Find the oldest timestamp in the window — that's when a slot opens
    const oldestInWindow = Math.min(...entry.timestamps)
    const retryAfterMs = windowMs - (now - oldestInWindow)
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      windowSeconds: WINDOW_SECONDS,
    }
  }

  // Record this request
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    limit,
    retryAfterSeconds: 0,
    windowSeconds: WINDOW_SECONDS,
  }
}

// ── Query ──────────────────────────────────────────────────────────────────

/**
 * Get current rate limit status for an Enterprise without consuming a slot.
 * Useful for the federation dashboard.
 */
export function getRateLimitStatus(
  federationId: string,
  action: RateLimitAction,
): { used: number; limit: number; remaining: number } {
  const limit = DEFAULT_LIMITS[action]
  const key = `${federationId}:${action}`
  const now = Date.now()
  const windowMs = WINDOW_SECONDS * 1000

  const entry = store.get(key)
  if (!entry) {
    return { used: 0, limit, remaining: limit }
  }

  // Count active timestamps
  const activeTimestamps = entry.timestamps.filter((t) => now - t < windowMs)
  const used = activeTimestamps.length

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}

/**
 * Get all rate limit status for an Enterprise across all actions.
 * Used by the federation dashboard.
 */
export function getAllRateLimits(
  federationId: string,
): Record<RateLimitAction, { used: number; limit: number; remaining: number }> {
  const actions: RateLimitAction[] = [
    'heartbeat',
    'catalog_browse',
    'skill_invoke',
    'vouch',
    'payment',
    'discovery',
  ]

  return Object.fromEntries(
    actions.map((action) => [action, getRateLimitStatus(federationId, action)]),
  ) as Record<RateLimitAction, { used: number; limit: number; remaining: number }>
}

/**
 * Reset rate limits for a specific Enterprise (admin action).
 */
export function resetRateLimits(federationId: string): void {
  for (const [key] of store.entries()) {
    if (key.startsWith(`${federationId}:`)) {
      store.delete(key)
    }
  }
}

/**
 * Get total entries in the rate limiter (for monitoring).
 */
export function getRateLimiterStats(): {
  totalEntries: number
  uniqueEnterprises: number
} {
  const enterprises = new Set<string>()
  for (const key of store.keys()) {
    const federationId = key.split(':')[0]
    enterprises.add(federationId)
  }

  return {
    totalEntries: store.size,
    uniqueEnterprises: enterprises.size,
  }
}
