/**
 * Outbound Retry Engine — Exponential backoff for all outbound senders.
 *
 * Pure utility with zero Payload imports. Wraps any async operation with
 * configurable retry logic, exponential backoff, and jitter.
 *
 * Used by: resolveWhatsAppSender, resolveTelegramSender, resolveSmsSender,
 * resolveEmailSender — any outbound operation that talks to an external API.
 *
 * @see src/utilities/resolveWhatsAppSender.ts
 * @see src/utilities/resolveTelegramSender.ts
 * @see src/utilities/resolveSmsSender.ts
 * @see src/utilities/resolveEmailSender.ts
 */

// ─── Configuration ───────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number
  /** Base delay in milliseconds. Doubles each attempt. Default: 1000 */
  baseDelayMs?: number
  /** Maximum delay cap in milliseconds. Default: 16000 */
  maxDelayMs?: number
  /** Jitter factor (0–1). 0.25 = ±25% randomization on delay. Default: 0.25 */
  jitter?: number
  /** Custom predicate to decide if an error is retryable. Default: isRetryableError */
  isRetryable?: (err: unknown) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 16_000,
  jitter: 0.25,
  isRetryable: isRetryableError,
}

// ─── Core Retry Function ─────────────────────────────────────

/**
 * Execute an async function with exponential backoff retry.
 *
 * ```ts
 * const result = await withRetry(() => fetch(url), { maxAttempts: 3 })
 * ```
 *
 * Delays between attempts: baseDelay, baseDelay*4, baseDelay*16 (quadratic)
 * Each delay has ±jitter randomization to avoid thundering herd.
 *
 * Only retries on retryable errors (5xx, 429, network errors).
 * Client errors (4xx except 429) fail immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    jitter,
    isRetryable,
  } = { ...DEFAULT_OPTIONS, ...opts }

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Don't retry on non-retryable errors (4xx client errors)
      if (!isRetryable(err)) {
        throw err
      }

      // Don't wait after the last attempt
      if (attempt < maxAttempts) {
        const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter)
        await sleep(delay)
      }
    }
  }

  // All attempts exhausted
  throw lastError
}

// ─── HTTP Status Classification ──────────────────────────────

/**
 * Returns true if an HTTP status code is worth retrying.
 *
 * Retryable: 429 (rate limit), 500, 502, 503, 504 (server errors)
 * Not retryable: 400, 401, 403, 404, 409, 422 (client errors — won't fix on retry)
 */
export function isRetryableStatus(status: number): boolean {
  if (status === 429) return true // Rate limited
  if (status >= 500 && status < 600) return true // Server errors
  return false
}

/**
 * Default error retryability check.
 *
 * Retries on:
 * - Network errors (TypeError from fetch, ECONNRESET, ETIMEDOUT, etc.)
 * - HTTP 5xx or 429 errors (extracted from error message)
 *
 * Does not retry on:
 * - HTTP 4xx (except 429)
 * - Validation errors
 * - Auth errors
 */
export function isRetryableError(err: unknown): boolean {
  if (!err) return false

  // Network-level errors (fetch throws TypeError on DNS/connection failures)
  if (err instanceof TypeError) return true

  if (err instanceof Error) {
    const msg = err.message.toLowerCase()

    // Node.js network error codes
    if (msg.includes('econnreset') || msg.includes('econnrefused')) return true
    if (msg.includes('etimedout') || msg.includes('esockettimedout')) return true
    if (msg.includes('enotfound') || msg.includes('enetunreach')) return true
    if (msg.includes('fetch failed') || msg.includes('network')) return true

    // HTTP status codes embedded in error messages (common in our senders)
    // Pattern: "WhatsApp API 502: ..." or "Telegram API 503: ..."
    const statusMatch = msg.match(/api\s+(\d{3})/i) || msg.match(/(\d{3}):\s/)
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10)
      return isRetryableStatus(status)
    }

    // Rate limit keywords
    if (msg.includes('rate limit') || msg.includes('too many requests')) return true
    if (msg.includes('throttl')) return true
  }

  return false
}

// ─── Delay Calculation ───────────────────────────────────────

/**
 * Calculate the delay for a given attempt with exponential backoff and jitter.
 *
 * attempt 1 → baseDelay * 1    (1000ms)
 * attempt 2 → baseDelay * 4    (4000ms)
 * attempt 3 → baseDelay * 16   (16000ms)
 *
 * Each delay gets ±jitter randomization to avoid thundering herd.
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: number,
): number {
  // Quadratic backoff: base * 4^(attempt-1)
  const exponentialDelay = baseDelayMs * Math.pow(4, attempt - 1)
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

  // Add jitter: ±jitter% randomization
  const jitterRange = cappedDelay * jitter
  const jitterOffset = (Math.random() * 2 - 1) * jitterRange

  return Math.max(0, Math.round(cappedDelay + jitterOffset))
}

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
