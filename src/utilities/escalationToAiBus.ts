/**
 * Durable AI-Bus escalation sink.
 *
 * `dispatchEscalation` (escalation.ts) fans out to CONFIGURED connectors
 * (Gotify/Telegram/…). If a tenant has none — or the connector is down — the
 * escalation vanished: fire-and-forget push with no record. That's the gap that
 * left the AI Bus `errors` channel empty despite "LEO monitors this channel."
 *
 * This sink makes every escalation DURABLE and config-free: it posts the event
 * as a `system` message into the right AI Bus channel (errors / support /
 * system-log), so it's live-visible in the dashboard, pollable by Nimue (the
 * escalation-alert path), and there for LEO to monitor — no connector required.
 *
 * FAIL-SOFT: escalation must never break the path that triggered the event.
 */
import type { Payload } from 'payload'
import type { EscalationEvent, EscalationEventType } from '@/utilities/escalation'
import { resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'

/** Which AI Bus channel each event type is recorded in. Default: `errors`. */
const ESCALATION_CHANNEL: Partial<Record<EscalationEventType, string>> = {
  error: 'errors',
  warning: 'errors',
  budget_exceeded: 'errors',
  provider_failover: 'errors',
  content_flagged: 'errors',
  content_reported: 'errors',
  itsm_incident: 'errors',
  account_deletion_requested: 'errors',
  vercel_spend: 'system-log',
  maintenance_note: 'system-log',
  federation: 'system-log',
  order: 'system-log',
  donation: 'system-log',
  booking: 'system-log',
  user_registered: 'support',
  conversation_started: 'support',
  form_submission: 'support',
}

/** Resolve the AI Bus channel slug an event is recorded in. */
export function escalationChannelFor(eventType: EscalationEventType): string {
  return ESCALATION_CHANNEL[eventType] || 'errors'
}

/**
 * Events that already post their own rich message into the AI Bus at their
 * source (so the sink must NOT double-post them). `form_submission` is written
 * by routeFormToAIBus.ts.
 */
const SELF_POSTING: ReadonlySet<EscalationEventType> = new Set<EscalationEventType>(['form_submission'])

export function isSelfPostingEscalation(eventType: EscalationEventType): boolean {
  return SELF_POSTING.has(eventType)
}

const CHANNEL_EMOJI: Record<string, string> = {
  errors: '⚠️',
  support: '📥',
  'system-log': '🛰️',
}

// ─── In-memory throttle (best-effort, per lambda instance) ───────────────────
// Keeps a burst of identical escalations from flooding the channel while still
// recording distinct ones. Mirrors escalation's rails, tuned looser.
const DEFAULT_COOLDOWN_MS = 120_000 // identical (tenant,eventType,dedupeKey)
const MAX_POSTS_PER_MIN = 30 // per tenant

const lastPostAt = new Map<string, number>() // `${tenant}::${eventType}::${dedupeKey}` → ms
const tenantWindow = new Map<string, number[]>() // tenant → recent post ms

/** Reset internal throttle state — TESTS ONLY. */
export function __resetEscalationAiBusState(): void {
  lastPostAt.clear()
  tenantWindow.clear()
}

/**
 * Pure throttle decision — should this escalation be recorded now? Records the
 * attempt into the in-memory state when it returns true. Exposed for testing.
 */
export function shouldRecordEscalation(
  event: Pick<EscalationEvent, 'tenantId' | 'eventType' | 'title' | 'dedupeKey'>,
  now: number = Date.now(),
): boolean {
  if (isSelfPostingEscalation(event.eventType)) return false

  const tenantKey = String(event.tenantId)
  const dedupeKey = event.dedupeKey || event.title
  const cdKey = `${tenantKey}::${event.eventType}::${dedupeKey}`

  const last = lastPostAt.get(cdKey)
  if (last != null && now - last < DEFAULT_COOLDOWN_MS) return false

  const recent = (tenantWindow.get(tenantKey) || []).filter((t) => now - t < 60_000)
  tenantWindow.set(tenantKey, recent)
  if (recent.length >= MAX_POSTS_PER_MIN) return false

  recent.push(now)
  lastPostAt.set(cdKey, now)
  return true
}

/** Find a system author (LEO) for the tenant, falling back to user id 1. */
async function resolveEscalationAuthor(payload: Payload, tenantId: number | string): Promise<number> {
  try {
    const leo = await payload.find({
      collection: 'users',
      where: {
        and: [
          { servesTenant: { equals: tenantId } },
          { 'agentConfig.agentType': { equals: 'leo' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = leo.docs?.[0]?.id
    if (typeof id === 'number') return id
  } catch {
    /* fall through */
  }
  return 1
}

/**
 * Record an escalation as a durable message in the tenant's AI Bus. Fail-soft;
 * throttled. Safe to await from dispatchEscalation (escalations are exceptional
 * events, not the hot per-message path).
 */
export async function postEscalationToAiBus(
  payload: Payload,
  event: EscalationEvent,
  now: number = Date.now(),
): Promise<void> {
  try {
    if (!shouldRecordEscalation(event, now)) return

    const spaceId = await resolveAiBusSpaceId(payload as never, event.tenantId)
    if (!spaceId) return

    const channel = escalationChannelFor(event.eventType)
    const emoji = CHANNEL_EMOJI[channel] || '•'
    const author = await resolveEscalationAuthor(payload, event.tenantId)

    const text = [
      `${emoji} **${event.title}**`,
      '',
      event.message,
    ].join('\n')

    await payload.create({
      collection: 'messages',
      data: {
        content: wrapTextContent(text),
        space: Number(spaceId),
        channel,
        messageType: 'system',
        author,
        tenant: event.tenantId,
        visibility: 'tenant',
        metadata: {
          kind: 'escalation',
          eventType: event.eventType,
          priority: event.priority ?? 5,
          dedupeKey: event.dedupeKey || event.title,
          ...(event.extras ? { extras: event.extras } : {}),
        },
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger?.warn?.(`[escalationToAiBus] failed to record ${event.eventType}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
