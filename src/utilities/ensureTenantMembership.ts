/**
 * User Propagation Layer — Sprint 42
 *
 * Ensures a user has a TenantMembership in a target tenant. Called at
 * cross-tenant interaction points (purchases, bookings, event registrations,
 * space joins). Creates with role='tenant_member' (lowest privilege).
 *
 * Design principles:
 * - Idempotent: no-op if membership already exists
 * - Non-fatal: errors are logged but never bubble up to callers
 * - Leverages existing hooks: creating a TenantMembership triggers
 *   syncUserTenants and autoJoinSpaces automatically
 * - Records the interaction trigger for audit trail
 *
 * Constitutional basis: Users propagate freely between Endeavors via their
 * interactions. The platform does not gatekeep — the Constitution IS the gate.
 * (Article VII)
 */
import type { Payload, PayloadRequest } from 'payload'

export type PropagationTrigger =
  | 'purchase'
  | 'booking'
  | 'event_registration'
  | 'space_join'
  | 'federation_interaction'
  | 'manual'

export interface EnsureTenantMembershipResult {
  /** True if a new TenantMembership was created */
  created: boolean
  /** True if creation was skipped (already exists or guard clause) */
  skipped: boolean
  /** Error message if creation failed */
  error?: string
}

/**
 * Ensure a user has a TenantMembership in the given tenant.
 *
 * If one already exists (any status), this is a no-op.
 * If none exists, creates one with role='tenant_member' and status='active'.
 *
 * The creation automatically triggers the existing hook chain:
 *   syncUserTenants → adds tenant to User.tenants[]
 *   autoJoinSpaces  → creates SpaceMemberships for all tenant spaces
 *
 * @param payload  - Payload instance
 * @param userId   - The user to propagate (skip if falsy = anonymous)
 * @param tenantId - The target tenant
 * @param trigger  - What caused this propagation (for audit)
 * @param req      - Optional PayloadRequest (for hook context)
 */
export async function ensureTenantMembership(
  payload: Payload,
  userId: number | string,
  tenantId: number | string,
  trigger: PropagationTrigger,
  req?: PayloadRequest,
): Promise<EnsureTenantMembershipResult> {
  // ── Guard: anonymous users ─────────────────────────────────────
  if (!userId) {
    return { created: false, skipped: true, error: 'No user ID (anonymous)' }
  }

  // ── Guard: missing tenant ──────────────────────────────────────
  if (!tenantId) {
    return { created: false, skipped: true, error: 'No tenant ID' }
  }

  try {
    // ── Idempotent check ───────────────────────────────────────────
    const existing = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs?.length > 0) {
      return { created: false, skipped: true }
    }

    // ── Create membership (fires syncUserTenants + autoJoinSpaces) ─
    await payload.create({
      collection: 'tenant-memberships',
      data: {
        user: userId,
        tenant: tenantId,
        role: 'tenant_member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        propagationTrigger: trigger,
      } as any, // `as any` until payload-types.ts is regenerated with propagationTrigger
      depth: 0,
      overrideAccess: true,
      ...(req ? { req } : {}),
    })

    payload.logger.info(
      `[Propagation] User ${userId} → Tenant ${tenantId} (trigger: ${trigger})`,
    )

    return { created: true, skipped: false }
  } catch (err) {
    // ── Non-fatal: log and return error state ───────────────────
    const message = err instanceof Error ? err.message : String(err)
    payload.logger.warn(
      `[Propagation] Failed: User ${userId} → Tenant ${tenantId} (trigger: ${trigger}): ${message}`,
    )
    return { created: false, skipped: false, error: message }
  }
}
