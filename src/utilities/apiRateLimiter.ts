/**
 * API Rate Limiter — User-Facing Endpoint Protection
 *
 * Protects expensive endpoints (LEO/LLM, Stripe, space creation) from abuse.
 * Keys by authenticated user ID or IP address for anonymous requests.
 *
 * Uses the same in-memory sliding window pattern as federation/rateLimiter.ts
 * but tuned for per-user, per-minute limits on user-facing APIs.
 *
 * Resets on server restart — acceptable for Vercel serverless (burst protection).
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type ApiEndpoint =
  | 'leo_chat'
  | 'leo_chat_guest'
  | 'leo_stream'
  | 'spaces_create'
  | 'stripe'
  | 'comments'
  | 'chat_send'
  | 'invitations'
  | 'orders'
  | 'bookings'
  | 'registration'
  | 'stripe_disconnect'
  | 'client-error'
  | 'default'

export interface ApiRateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  retryAfterSeconds: number
}

interface RateLimitEntry {
  timestamps: number[]
}

// ── Configuration ──────────────────────────────────────────────────────────

/** Requests per minute per user, per endpoint */
const LIMITS: Record<ApiEndpoint, number> = {
  leo_chat: 10,       // Each call = Anthropic API cost (~$0.01-0.10)
  leo_chat_guest: 5,  // Guest access — stricter limit (IP-based)
  leo_stream: 5,      // SSE streams are expensive (~$0.05-0.50 each)
  spaces_create: 3,  // Prevent spam creation
  stripe: 10,        // Payment abuse prevention
  comments: 10,      // Comment spam
  chat_send: 20,     // Message spam — generous for active chat, still bounded
  invitations: 5,    // Invitation email spam prevention
  orders: 10,        // Order lifecycle abuse prevention
  bookings: 20,      // Availability queries — generous for scheduling UX
  registration: 3,   // Account creation spam — tight limit
  stripe_disconnect: 5, // Stripe disconnect abuse prevention
  'client-error': 30, // Client error reports — generous for real bursts, bounds floods
  default: 60,       // General API protection
}

/** Rate limit window: 60 seconds (1 minute) */
const WINDOW_MS = 60_000

/** Cleanup interval: every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

// ── State ──────────────────────────────────────────────────────────────────

const store = new Map<string, RateLimitEntry>()

// ── Cleanup ────────────────────────────────────────────────────────────────

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)
      if (entry.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)

  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

startCleanup()

// ── Key Extraction ─────────────────────────────────────────────────────────

/**
 * Extract a rate-limit key from a Payload request.
 * Uses authenticated user ID when available, falls back to IP.
 */
export function extractRateLimitKey(req: {
  user?: { id?: number | string } | null
  headers: { get(name: string): string | null }
}): string {
  if (req.user?.id) {
    return `user:${req.user.id}`
  }
  // Prefer CF-Connecting-IP (Cloudflare — cannot be spoofed through proxy),
  // then x-forwarded-for (Vercel), then x-real-ip fallback
  const cfIp = req.headers.get('cf-connecting-ip')
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = cfIp || forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

// ── Core ───────────────────────────────────────────────────────────────────

/**
 * Check if an API request is within rate limits.
 * If allowed, the request is counted against the limit.
 * If denied, returns a 429-ready result with Retry-After.
 */
export function checkApiRateLimit(
  key: string,
  endpoint: ApiEndpoint = 'default',
): ApiRateLimitResult {
  const limit = LIMITS[endpoint] ?? LIMITS.default
  const storeKey = `${key}:${endpoint}`
  const now = Date.now()

  let entry = store.get(storeKey)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(storeKey, entry)
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)

  // Check limit
  if (entry.timestamps.length >= limit) {
    const oldest = Math.min(...entry.timestamps)
    const retryAfterMs = WINDOW_MS - (now - oldest)
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    }
  }

  // Record request
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    limit,
    retryAfterSeconds: 0,
  }
}

// ── Response Helper ────────────────────────────────────────────────────────

/**
 * Returns a 429 Response with standard rate limit headers.
 * Call this when checkApiRateLimit returns { allowed: false }.
 */
export function rateLimitResponse(result: ApiRateLimitResult): Response {
  return Response.json(
    {
      error: 'Too many requests. Please slow down.',
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}

// ── Convenience ────────────────────────────────────────────────────────────

/**
 * One-liner rate limit check for Payload handlers.
 * Returns a 429 Response if denied, or null if allowed.
 *
 * Usage in endpoint:
 *   const denied = applyRateLimit(req, 'leo_stream')
 *   if (denied) return denied
 */
export function applyRateLimit(
  req: {
    user?: { id?: number | string } | null
    headers: { get(name: string): string | null }
  },
  endpoint: ApiEndpoint = 'default',
): Response | null {
  const key = extractRateLimitKey(req)
  const result = checkApiRateLimit(key, endpoint)
  if (!result.allowed) {
    return rateLimitResponse(result)
  }
  return null
}
