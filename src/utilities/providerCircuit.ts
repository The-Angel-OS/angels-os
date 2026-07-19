/**
 * providerCircuit — a passive circuit breaker for multi-provider fallback.
 *
 * The goal (Ken 260718): a fail-soft / fail-up provider order where a single
 * provider outage doesn't hose the system, we DON'T hammer the known-down
 * provider on every call, and we don't pay for a separate health-check that
 * would become the majority of traffic. The insight: the REAL calls are the
 * health signal. Every attempt reports success/failure here; a failed provider
 * is skipped for a cooldown, then gets ONE half-open trial, recovering on
 * success and backing off exponentially on repeat failure.
 *
 * In-memory + per-process (ample for the single self-host node; each serverless
 * instance keeps its own map, which is fine — a cold instance just re-learns on
 * its first call). No timers, no background work: state is read and written
 * inline on each call, so there is nothing to leak or clean up.
 *
 * Usage:
 *   for (const p of orderedProviders) {
 *     if (circuitOpen(p.key)) continue          // skip — in cooldown
 *     const r = await p.run()
 *     if (r.ok) { reportSuccess(p.key); return r }
 *     reportFailure(p.key)                       // open circuit, fall through
 *   }
 */

type Circuit = { fails: number; downUntil: number }

const circuits = new Map<string, Circuit>()

/** First cooldown after a failure. Doubles each consecutive failure. */
const BASE_COOLDOWN_MS = 30_000
/** Cap so a long outage never parks a provider for more than this. */
const MAX_COOLDOWN_MS = 10 * 60_000

// Date.now is unavailable in workflow scripts but this is app runtime — fine.
const now = () => Date.now()

/**
 * True when `key`'s circuit is open (in cooldown) — skip this provider. Once the
 * cooldown has elapsed the circuit is half-open: this returns false so the next
 * real call trials the provider, and the outcome (reportSuccess/reportFailure)
 * decides whether it recovers or backs off further.
 */
export function circuitOpen(key: string): boolean {
  const c = circuits.get(key)
  if (!c) return false
  return now() < c.downUntil
}

/** Provider answered — clear its circuit so it's fully back in rotation. */
export function reportSuccess(key: string): void {
  circuits.delete(key)
}

/**
 * Provider failed in a way that implies it's unhealthy (rate-limit, 5xx, network
 * — NOT a bad-input/4xx that would fail on every provider). Opens the circuit for
 * an exponentially-backing-off cooldown.
 */
export function reportFailure(key: string): void {
  const c = circuits.get(key) ?? { fails: 0, downUntil: 0 }
  c.fails += 1
  const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (c.fails - 1), MAX_COOLDOWN_MS)
  c.downUntil = now() + cooldown
  circuits.set(key, c)
}

/**
 * Classify an error/HTTP status as a provider-health failure (open the circuit)
 * vs a request-level failure that would fail on ANY provider (don't open it —
 * e.g. a content-policy 400 or malformed prompt). Callers use this to decide
 * whether to reportFailure.
 */
export function isProviderHealthFailure(statusOrError: number | string | Error): boolean {
  if (typeof statusOrError === 'number') {
    // 429 rate-limit + any 5xx = provider health; 408 request timeout too.
    return statusOrError === 429 || statusOrError === 408 || statusOrError >= 500
  }
  const msg = (statusOrError instanceof Error ? statusOrError.message : String(statusOrError)).toLowerCase()
  // Network / timeout / rate-limit signatures; explicitly NOT content_policy.
  if (msg.includes('content_policy') || msg.includes('safety')) return false
  return (
    msg.includes('timeout') ||
    msg.includes('econn') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('rate') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded')
  )
}

/** Snapshot for diagnostics / a readiness surface. */
export function circuitSnapshot(): Array<{ key: string; open: boolean; fails: number; downForMs: number }> {
  const t = now()
  return Array.from(circuits.entries()).map(([key, c]) => ({
    key,
    open: t < c.downUntil,
    fails: c.fails,
    downForMs: Math.max(0, c.downUntil - t),
  }))
}

/** Test/ops helper — clear all circuits. */
export function resetCircuits(): void {
  circuits.clear()
}
