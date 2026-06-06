/**
 * recordCostEvent — fail-soft writer for the unified Operating-Costs ledger.
 *
 * Every cost source (AI/intelligence, telephony, storage, infra) funnels here
 * so the control panel and LEO read ONE substrate. Writes are best-effort: if
 * the `cost-events` table doesn't exist yet on this node's DB (Vercel prod
 * doesn't auto-push schema), or any transient error occurs, we swallow it and
 * never let cost accounting break the request it rode in on.
 *
 * @see src/collections/CostEvents — the ledger
 * @see src/utilities/aiUsage.ts — the AI telemetry shape this maps from
 */
import type { Payload } from 'payload'
import type { AiResponseTelemetry } from './aiUsage'

export type CostCategory = 'intelligence' | 'telephony' | 'storage' | 'infra' | 'other'

export interface CostEventInput {
  tenantId?: number | string | null
  category: CostCategory
  source: string
  provider?: string
  costCents?: number
  costEstimated?: boolean
  currency?: string
  billedToTenantKey?: boolean
  quantity?: number
  unit?: 'tokens' | 'seconds' | 'minutes' | 'bytes' | 'gb' | 'requests' | 'count'
  // intelligence-specific
  model?: string
  tier?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  latencyMs?: number
  ttftMs?: number
  finishReason?: string
  toolCallCount?: number
  failedOver?: boolean
  // linkage
  messageRef?: number | string
  conversationId?: string
  userId?: number | string
  occurredAt?: string
  metadata?: Record<string, unknown>
}

/** Strip undefined keys so we never write nulls over column defaults. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v
  return out as Partial<T>
}

/**
 * Append a cost event to the ledger. Never throws.
 */
export async function recordCostEvent(payload: Payload, event: CostEventInput): Promise<void> {
  try {
    const data = compact({
      tenant: event.tenantId ?? undefined,
      category: event.category,
      source: event.source,
      provider: event.provider,
      costCents: event.costCents,
      costEstimated: event.costEstimated,
      currency: event.currency,
      billedToTenantKey: event.billedToTenantKey,
      quantity: event.quantity,
      unit: event.unit,
      model: event.model,
      tier: event.tier,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      totalTokens: event.totalTokens,
      latencyMs: event.latencyMs,
      ttftMs: event.ttftMs,
      finishReason: event.finishReason,
      toolCallCount: event.toolCallCount,
      failedOver: event.failedOver,
      messageRef: event.messageRef,
      conversationId: event.conversationId,
      userId: event.userId != null ? String(event.userId) : undefined,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    })

    await payload.create({
      collection: 'cost-events' as any,
      data: data as any,
      overrideAccess: true,
    })
  } catch {
    // fail-soft — table may not exist yet, or a transient error. Cost
    // accounting must never break the response it rode in on.
  }
}

/**
 * Convenience: map captured AI response telemetry to an intelligence cost event.
 * Fire-and-forget alongside the Messages.metadata capture in leo-stream.
 */
export async function recordAiUsage(
  payload: Payload,
  args: {
    telemetry: AiResponseTelemetry
    tenantId?: number | string | null
    conversationId?: string
    userId?: number | string
    messageRef?: number | string
    /** True when the turn was served via the tenant's own provider key (BYOK). */
    billedToTenantKey?: boolean
  },
): Promise<void> {
  const t = args.telemetry
  await recordCostEvent(payload, {
    tenantId: args.tenantId,
    category: 'intelligence',
    source: 'leo-stream',
    provider: t.provider,
    model: t.model,
    tier: t.tier,
    costCents: t.costCents,
    costEstimated: t.costEstimated,
    billedToTenantKey: args.billedToTenantKey,
    quantity: t.totalTokens,
    unit: 'tokens',
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    totalTokens: t.totalTokens,
    latencyMs: t.latencyMs,
    ttftMs: t.ttftMs,
    finishReason: t.finishReason,
    toolCallCount: t.toolCallCount,
    failedOver: t.failedOver,
    messageRef: args.messageRef,
    conversationId: args.conversationId,
    userId: args.userId,
  })
}
