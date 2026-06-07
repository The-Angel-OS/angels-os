/**
 * Gotify escalation — policy + central dispatcher.
 *
 * Angel OS events (errors, AI-budget exceeded, provider failover, Vercel spend,
 * federation, orders/donations/bookings, future ITSM) can be pushed to Gotify so
 * the Android client lights up. WHICH events push, at WHAT priority, is configured
 * PER gotify Connector in its `config.escalation` policy — and there can be N
 * gotify connectors per tenant (each its own Gotify app/server/token), so the
 * dispatcher FANS OUT to every matching connector using that connector's own
 * `config.appToken`.
 *
 * Two safety rails so we don't recreate the Uptime-Kuma flap-storm:
 *   - per-(connector,eventType,dedupeKey) cooldown (in-memory, best-effort)
 *   - per-(connector) max sends per rolling minute
 * In-memory state is per-lambda-instance on Vercel — imperfect but materially
 * dampens bursts; a durable counter can replace it later.
 *
 * Everything here is FAIL-SOFT — escalation must never break the path that
 * triggered the event.
 *
 * @see src/utilities/gotifyNotify.ts  @see src/utilities/logError.ts
 */
import type { Payload } from 'payload'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { gotifyNotify } from '@/utilities/gotifyNotify'

/**
 * Canonical Angel OS event types that can be escalated to Gotify.
 *
 * WIRED today: `error` / `warning` (logError tap, src/utilities/logError.ts —
 * funnels most system events) and `user_registered` (Users afterChange hook,
 * src/collections/Users/hooks/notifyUserRegistered.ts — the operator's pulse on
 * a quiet node).
 *
 * SEAM (stored in policy, not yet emitted): `conversation_started`,
 * `budget_exceeded`, `provider_failover`, `vercel_spend`, `federation`, `order`,
 * `donation`, `booking`, `itsm_incident`. To enable one, call
 * `dispatchToGotify(payload, { eventType, … })` at that event's source (e.g. the
 * over-budget branch in leo-stream, the Orders paid transition). No changes here.
 */
export type EscalationEventType =
  | 'error'
  | 'warning'
  | 'user_registered'
  | 'conversation_started'
  | 'budget_exceeded'
  | 'provider_failover'
  | 'vercel_spend'
  | 'federation'
  | 'order'
  | 'donation'
  | 'booking'
  | 'itsm_incident'

export interface EscalationEvent {
  tenantId: number | string
  eventType: EscalationEventType
  title: string
  message: string
  /** 0–10 desired Gotify priority; the policy's minPriority is a floor. */
  priority?: number
  /** Stable key for dedupe/cooldown (e.g. error source, room name). Defaults to title. */
  dedupeKey?: string
  extras?: Record<string, unknown>
}

/** Per-event-type rule inside a connector's escalation policy. */
export interface EscalationRule {
  enabled?: boolean
  /** Floor for the Gotify priority sent for this event type (0–10). */
  minPriority?: number
}

export interface EscalationPolicy {
  /** Master switch for escalation on this connector. */
  enabled?: boolean
  /** Max notifications per rolling 60s per connector (default 10). */
  rateLimitPerMin?: number
  /** Cooldown seconds for an identical (eventType+dedupeKey) per connector (default 300). */
  cooldownSeconds?: number
  /** Per-event-type rules. Missing entry = disabled. */
  events?: Partial<Record<EscalationEventType, EscalationRule>>
}

export interface EscalationDispatchResult {
  matched: number
  sent: number
  suppressed: number
  failed: number
}

const DEFAULT_RATE_LIMIT = 10
const DEFAULT_COOLDOWN_SECONDS = 300

// ─── In-memory rate-limit / cooldown state (best-effort, per instance) ───────
// connectorId → recent send timestamps (ms)
const sendWindow = new Map<string, number[]>()
// `${connectorId}::${eventType}::${dedupeKey}` → last send ms
const cooldownAt = new Map<string, number>()

/** Reset internal state — TESTS ONLY. */
export function __resetEscalationState(): void {
  sendWindow.clear()
  cooldownAt.clear()
}

/**
 * Decide whether a connector's policy admits this event, and at what priority.
 * Pure — no side effects, no clock dependence except the `now` you pass for limits.
 */
export function policyAdmits(
  policy: EscalationPolicy | undefined,
  event: Pick<EscalationEvent, 'eventType' | 'priority'>,
): { admit: boolean; priority: number; reason?: string } {
  if (!policy || policy.enabled === false) return { admit: false, priority: 0, reason: 'policy disabled' }
  const rule = policy.events?.[event.eventType]
  if (!rule || rule.enabled === false) return { admit: false, priority: 0, reason: 'event type disabled' }

  const requested = Number.isFinite(event.priority as number) ? (event.priority as number) : 5
  const floor = Number.isFinite(rule.minPriority as number) ? (rule.minPriority as number) : 0
  const priority = Math.max(0, Math.min(10, Math.max(requested, floor)))
  return { admit: true, priority }
}

/**
 * Fan an event out to every enabled gotify connector for the tenant whose
 * escalation policy admits it. Fail-soft; returns counts.
 */
export async function dispatchToGotify(
  payload: Payload,
  event: EscalationEvent,
  now: number = Date.now(),
): Promise<EscalationDispatchResult> {
  const result: EscalationDispatchResult = { matched: 0, sent: 0, suppressed: 0, failed: 0 }

  let connectors: Awaited<ReturnType<typeof findAllConnectors>>
  try {
    connectors = await findAllConnectors(payload, 'gotify')
  } catch {
    return result
  }

  // Scope to this tenant.
  const forTenant = connectors.filter((c) => String(c.tenantId) === String(event.tenantId))

  for (const connector of forTenant) {
    const cfg = (connector.config || {}) as Record<string, unknown>
    const policy = (cfg.escalation as EscalationPolicy) || undefined

    const verdict = policyAdmits(policy, event)
    if (!verdict.admit) continue
    result.matched++

    const serverUrl = String(cfg.serverUrl || process.env.GOTIFY_SERVER_URL || '')
    const appToken = String(cfg.appToken || '')
    if (!serverUrl || !appToken) {
      // Configured to escalate but missing transport — skip (not a hard failure).
      result.failed++
      continue
    }

    // Rate-limit + cooldown gates (best-effort).
    const rateLimit = Number(policy?.rateLimitPerMin ?? DEFAULT_RATE_LIMIT)
    const cooldownMs = Number(policy?.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS) * 1000
    const dedupeKey = event.dedupeKey || event.title
    const cdKey = `${connector.id}::${event.eventType}::${dedupeKey}`

    const lastSent = cooldownAt.get(cdKey)
    if (lastSent != null && now - lastSent < cooldownMs) {
      result.suppressed++
      continue
    }

    // Prune-and-store the rolling window up front so it self-prunes on every
    // path (not only on success — otherwise a connector that's always failing
    // accumulates stale timestamps).
    const recent = (sendWindow.get(connector.id) || []).filter((t) => now - t < 60_000)
    sendWindow.set(connector.id, recent)
    if (recent.length >= rateLimit) {
      result.suppressed++
      continue
    }

    // Record the attempt against BOTH gates BEFORE sending. A dead/slow server
    // makes gotifyNotify return ok:false; if we only counted successes, a flap
    // storm against a down server would retry every event with zero throttling —
    // exactly what the limiter exists to prevent. Counting the attempt caps it.
    recent.push(now)
    cooldownAt.set(cdKey, now)

    const sendResult = await gotifyNotify(
      {
        title: event.title,
        message: event.message,
        priority: verdict.priority,
        extras: event.extras,
      },
      { serverUrl, appToken },
    )

    if (sendResult.ok) result.sent++
    else result.failed++
  }

  return result
}
