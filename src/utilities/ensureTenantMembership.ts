/**
 * ensureTenantMembership — open-join: when an authenticated user reaches a
 * tenant's dashboard with NO membership row at all, enroll them as an active
 * tenant_member. Creating an active tenant-membership fires the autoJoinSpaces
 * afterChange hook, which populates space-memberships, so the user immediately
 * sees the tenant's non-private spaces (the PermissionService visibility grain).
 *
 * This is the open-join counterpart to autoActivatePendingMembership (which
 * handles the pending-invite case). Together they guarantee: any authenticated
 * user who visits a portal becomes a member and can see its spaces — no manual
 * per-space permission editing required.
 *
 * Called fire-and-forget from the dashboard layout — never blocks rendering,
 * never surfaces an error to the user. Idempotent (re-check before create).
 */
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'

/**
 * Pass `req` whenever you have one — from a hook, an endpoint, anything inside a
 * request. Without it this creates its OWN payload instance and writes on a
 * SECOND pooled connection: if the caller is mid-transaction, the insert's FK
 * check blocks on the still-uncommitted parent while the parent waits on this
 * write, and Postgres only breaks the tie at idle_in_transaction_session_timeout
 * — the exactly-300s hang. @see docs/FOOTGUNS.md §2.1
 */
export async function ensureTenantMembership(
  userId: number | string,
  tenantId: number | string,
  req?: PayloadRequest,
): Promise<void> {
  try {
    const payload = req?.payload ?? (await getPayload({ config }))

    // Idempotency guard: bail if ANY membership row already exists for this
    // user+tenant (active, pending, left, etc.). Pending is handled by
    // autoActivatePendingMembership; we only create when there is nothing.
    const existing = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [{ user: { equals: userId } }, { tenant: { equals: tenantId } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (existing.docs?.[0]) return

    await payload.create({
      collection: 'tenant-memberships',
      data: {
        user: Number(userId),
        tenant: Number(tenantId),
        role: 'tenant_member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        propagationTrigger: 'manual',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime cast, matches autoActivatePendingMembership
      } as any,
      overrideAccess: true,
      req,
    })
    // autoJoinSpaces (TenantMemberships afterChange) now runs and creates the
    // space-membership rows for this tenant's spaces.
  } catch {
    /* never surface to the user — runs fire-and-forget */
  }
}
