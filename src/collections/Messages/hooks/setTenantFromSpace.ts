import type { CollectionBeforeValidateHook } from 'payload'
import { logError } from '@/utilities/logError'

/**
 * Auto-resolve the message tenant from the linked space.
 *
 * The multi-tenant plugin adds a `tenant` field with a custom validator
 * that requires a non-null value. The plugin's `defaultValue` only resolves
 * from the `payload-tenant` cookie, which isn't set in the custom dashboard.
 *
 * This **beforeValidate** hook runs before field validation, allowing us
 * to populate the tenant from the space's tenant relationship before the
 * plugin's required-field check fails with a 400.
 *
 * Server-side endpoints (LEO, AI Bus) already pass tenant explicitly with
 * overrideAccess, so this hook only activates when tenant is missing.
 */
export const setTenantFromSpace: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  // Only auto-fill on create when tenant is missing
  if (operation !== 'create' || data?.tenant) return data

  const spaceId = data?.space
  if (!spaceId) return data

  try {
    const space = await req.payload.findByID({
      collection: 'spaces',
      id: typeof spaceId === 'object' ? spaceId.id : spaceId,
      depth: 0,
      overrideAccess: true,
      // Pass req so the lookup JOINS the request's transaction/connection instead
      // of acquiring a separate pooled connection. Without this, under connection
      // pressure (shared IONOS cap / flaky node) the lookup blocks → hook fails →
      // tenant stays unset → the create throws → the message vanishes. Same class
      // as the moderateMessage nested-write deadlock.
      req,
    })

    if (space?.tenant) {
      const tenantId = typeof space.tenant === 'object' ? space.tenant.id : space.tenant
      return {
        ...data,
        tenant: tenantId,
      }
    }
  } catch (err) {
    // If space lookup fails, let Payload's normal validation handle it — but
    // escalate, because this is the exact failure that makes a message vanish
    // (tenant stays unset → the create throws). Log WITHOUT tenantId so it only
    // writes to application-logs and never emits to the AI Bus errors channel
    // (which would re-enter this same hook → recursion).
    console.error('[setTenantFromSpace] Failed to resolve tenant from space:', err)
    void logError({
      source: 'Messages/setTenantFromSpace',
      message: `Tenant resolution from space ${typeof spaceId === 'object' ? (spaceId as { id?: unknown }).id : spaceId} failed (message may be dropped): ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
    })
  }

  return data
}
