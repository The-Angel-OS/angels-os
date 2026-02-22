import type { CollectionBeforeValidateHook } from 'payload'

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
    })

    if (space?.tenant) {
      const tenantId = typeof space.tenant === 'object' ? space.tenant.id : space.tenant
      return {
        ...data,
        tenant: tenantId,
      }
    }
  } catch (err) {
    // If space lookup fails, let Payload's normal validation handle it
    console.error('[setTenantFromSpace] Failed to resolve tenant from space:', err)
  }

  return data
}
