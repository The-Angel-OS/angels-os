/**
 * Federation Audit Logger
 *
 * Utility for writing entries to the FederationAuditLog collection.
 * Called by federation endpoints after every request (whether allowed or denied).
 *
 * Non-blocking: audit log writes are fire-and-forget. A failed audit write
 * should NEVER cause a federation request to fail. Safety first, but
 * reliability of the actual operation is more important than logging it.
 *
 * Constitutional Reference:
 *   Article II — "All actions observable"
 *   Article IV — "The AI Bus is transparent by design"
 */

import type { Payload } from 'payload'
import type { TrustVerification } from './trustGuard'
import type { RateLimitAction } from './rateLimiter'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  action: RateLimitAction | 'skill_list'
  direction: 'inbound' | 'outbound'
  sourceFederationId: string
  sourceDomain?: string
  sourceName?: string
  targetAction?: string
  trustLevel?: string
  allowed: boolean
  deniedReason?: string
  responseTimeMs?: number
  metadata?: Record<string, unknown>
}

// ── Logger ─────────────────────────────────────────────────────────────────

/**
 * Log a federation action to the audit log.
 *
 * Fire-and-forget: this function never throws. Errors are logged to console.
 * A failed audit write should NEVER block a federation operation.
 */
export async function logFederationAction(
  payload: Payload,
  entry: AuditEntry,
): Promise<void> {
  try {
    await payload.create({
      collection: 'federation-audit-log' as any,
      data: {
        action: entry.action,
        direction: entry.direction,
        sourceFederationId: entry.sourceFederationId,
        sourceDomain: entry.sourceDomain || undefined,
        sourceName: entry.sourceName || undefined,
        targetAction: entry.targetAction || undefined,
        trustLevel: entry.trustLevel || undefined,
        allowed: entry.allowed,
        deniedReason: entry.deniedReason || undefined,
        responseTimeMs: entry.responseTimeMs || undefined,
        metadata: entry.metadata || undefined,
      } as any,
      overrideAccess: true,
    })
  } catch (err) {
    // Non-fatal — log to console but never throw
    console.warn(
      '[AuditLog] Failed to write audit entry:',
      entry.action,
      entry.sourceFederationId,
      err instanceof Error ? err.message : err,
    )
  }
}

/**
 * Log a federation request using a TrustVerification result.
 * Convenience wrapper that extracts fields from the verification.
 */
export async function logFromVerification(
  payload: Payload,
  verification: TrustVerification,
  action: RateLimitAction,
  opts: {
    direction?: 'inbound' | 'outbound'
    targetAction?: string
    responseTimeMs?: number
    metadata?: Record<string, unknown>
  } = {},
): Promise<void> {
  await logFederationAction(payload, {
    action,
    direction: opts.direction || 'inbound',
    sourceFederationId: verification.federationId,
    trustLevel: verification.trustLevel,
    allowed: verification.verified,
    deniedReason: verification.verified ? undefined : verification.reason,
    targetAction: opts.targetAction,
    responseTimeMs: opts.responseTimeMs,
    metadata: opts.metadata,
  })
}

/**
 * Log an outbound federation request.
 */
export async function logOutboundAction(
  payload: Payload,
  opts: {
    action: RateLimitAction
    targetFederationId: string
    targetDomain: string
    success: boolean
    error?: string
    responseTimeMs?: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  // For outbound, "source" is us — but we store the target's federation ID
  // since that's what's interesting for audit analysis
  await logFederationAction(payload, {
    action: opts.action,
    direction: 'outbound',
    sourceFederationId: opts.targetFederationId, // Store target for querying
    sourceDomain: opts.targetDomain,
    allowed: opts.success,
    deniedReason: opts.error,
    responseTimeMs: opts.responseTimeMs,
    metadata: {
      ...opts.metadata,
      direction_note: 'source fields contain TARGET diocese info for outbound actions',
    },
  })
}
