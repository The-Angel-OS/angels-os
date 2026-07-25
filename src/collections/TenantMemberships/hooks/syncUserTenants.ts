import type { CollectionAfterChangeHook } from 'payload'

/**
 * syncUserTenants — After a TenantMembership becomes active, add the tenant
 * to the user's `tenants` array (the @payloadcms/plugin-multi-tenant field).
 *
 * The multi-tenant plugin uses User.tenants[] to determine which tenants
 * a user can see in the Payload admin panel. Without this sync, users who
 * accept tenant invitations (or are added via TenantMemberships) cannot see
 * the tenant's data in the admin even though they are members.
 *
 * This hook is idempotent: if the tenant is already in the array, it skips.
 * It fires on create and update so both new memberships and status changes
 * (pending → active) are handled.
 */
export const syncUserTenants: CollectionAfterChangeHook = async ({ doc, req }) => {
  // Only sync when membership is active — ignore pending/suspended/revoked
  if (doc.status !== 'active') return doc

  const userId = typeof doc.user === 'number' ? doc.user : (doc.user as any)?.id
  const tenantId = typeof doc.tenant === 'number' ? doc.tenant : (doc.tenant as any)?.id

  if (!userId || !tenantId) return doc

  try {
    const { payload } = req

    // Fetch user's current tenants array
    // `req` on BOTH calls: this hook runs INSIDE the tenant-create transaction
    // (tenant → afterChange → membership create → afterChange → here). Without it
    // the user update lands on a separate pooled connection whose users_tenants
    // insert FKs to the still-uncommitted tenant row — it blocks on that
    // transaction while that transaction sits awaiting this call. A distributed
    // deadlock that stalled every claim for exactly 300s
    // (idle_in_transaction_session_timeout), then rolled the whole tenant back.
    // Proven with pg_blocking_pids on the live :3001 container, 260725.
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      req,
    })

    const currentTenants = (user.tenants || []) as {
      tenant: number | { id: number }
      id?: string | null
    }[]

    // Check whether this tenant is already present — avoid duplicates
    const alreadyIn = currentTenants.some((t) => {
      const tId = typeof t.tenant === 'number' ? t.tenant : (t.tenant as any)?.id
      return tId === tenantId
    })

    if (!alreadyIn) {
      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          tenants: [...currentTenants, { tenant: tenantId }],
        },
        overrideAccess: true,
        req,
      })

      payload.logger.info(
        `[syncUserTenants] Added tenant ${tenantId} to user ${userId} tenants array`,
      )
    }
  } catch (err) {
    // Non-fatal — membership is already saved; log and continue
    req.payload.logger.warn(
      `[syncUserTenants] Failed to sync user ${doc.user} tenants array: ${err}`,
    )
  }

  return doc
}
