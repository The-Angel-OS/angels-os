/**
 * providerHealth.ts — lightweight circuit breaker for AI providers.
 *
 * When a provider fails fatally (credit/auth/quota), mark it DOWN for a TTL so the
 * fallback chain SKIPS it instead of hammering a dead provider every request.
 * Records an outage entry (for the CIC "Provider Outages" panel to read) and flags
 * the first down-transition so callers can escalate exactly once.
 *
 * In-memory (per serverless instance). Good enough to stop retry storms within a
 * warm instance; persistence to the Settings bag is a follow-up so outages survive
 * cold starts and show platform-wide on the CIC.
 */

export interface Outage {
  provider: string
  reason: string
  since: number
  until: number
}

const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutes

const outages = new Map<string, Outage>()

/** Pull an HTTP status off an AI SDK error (APICallError) or its nested cause. */
function statusOf(err: unknown): number | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any
  const s = e?.statusCode ?? e?.status ?? e?.cause?.statusCode ?? e?.cause?.status
  return typeof s === 'number' ? s : undefined
}

/** Error messages that mean "this provider is unusable right now" (skip it). */
export function isFatalProviderError(err: unknown): boolean {
  // Status-code path — most reliable when the SDK preserves it.
  const status = statusOf(err)
  if (status === 429 || status === 529 || status === 401 || status === 402 || status === 403) return true

  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase()
  return (
    msg.includes('credit balance is too low') ||
    msg.includes('insufficient') ||
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('429') ||
    msg.includes('529') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    // The exact text the AI SDK surfaced on Core's outage ("Last error: Too Many
    // Requests") — matched neither '429' nor 'rate limit', so failover never fired.
    msg.includes('too many request') ||
    msg.includes('overloaded') ||
    msg.includes('capacity') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('unauthorized') ||
    msg.includes('permission')
  )
}

export function isDown(provider: string, now: number = Date.now()): boolean {
  const o = outages.get(provider)
  if (!o) return false
  if (now >= o.until) {
    outages.delete(provider) // TTL expired → allow a retry
    return false
  }
  return true
}

/**
 * Mark a provider down. Returns true ONLY on the first down-transition (so the
 * caller escalates once, not every request).
 */
export function markDown(
  provider: string,
  reason: string,
  ttlMs: number = DEFAULT_TTL_MS,
  now: number = Date.now(),
): boolean {
  const wasDown = isDown(provider, now)
  outages.set(provider, { provider, reason, since: now, until: now + ttlMs })
  if (!wasDown) {
    console.error(`[providerHealth] ⛔ ${provider} DOWN — ${reason} (skipping for ${Math.round(ttlMs / 60000)}m)`)
  }
  return !wasDown
}

/** A provider call succeeded — clear any outage. */
export function recordSuccess(provider: string): void {
  if (outages.delete(provider)) {
    console.log(`[providerHealth] ✅ ${provider} recovered`)
  }
}

export function clear(provider: string): void {
  outages.delete(provider)
}

/** Current outages — for the CIC control panel. */
export function listOutages(now: number = Date.now()): Outage[] {
  return [...outages.values()].filter((o) => now < o.until)
}
