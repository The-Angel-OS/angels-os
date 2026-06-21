import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Auto-resolve the media tenant from the request's subdomain context.
 *
 * Media is tenant-scoped (multi-tenant plugin adds a required `tenant` field).
 * The plugin's defaultValue only resolves from the `payload-tenant` cookie,
 * which isn't reliably set in the custom dashboard — especially for a
 * super_admin viewing a tenant subdomain. When the browser uploads straight
 * to /api/media (chat attachments), the client only attaches `tenant` if it
 * can resolve one; on a super-admin view it often can't → the create fails
 * the required-tenant validator with a 400 ("failed to upload").
 *
 * This beforeValidate hook fills `tenant` from the `x-tenant-id` header (the
 * subdomain slug the user is viewing) before validation runs, so uploads no
 * longer depend on the client knowing the tenant. Server callers that pass
 * `tenant` explicitly are untouched (guarded on `data?.tenant`).
 *
 * Mirrors Messages/hooks/setTenantFromSpace. Passes `req` to the lookup so it
 * joins the request's own connection (no separate pooled connection that can
 * stall under connection pressure).
 */
export const setTenantFromHeader: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create' || data?.tenant) return data

  const tenantSlug = req.headers?.get?.('x-tenant-id')
  if (!tenantSlug) return data

  try {
    const tenants = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const tenantId = tenants.docs?.[0]?.id
    if (tenantId) {
      return { ...data, tenant: tenantId }
    }
  } catch (err) {
    // Non-fatal — let Payload's normal validation handle a still-missing tenant.
    console.error('[setTenantFromHeader] Failed to resolve tenant from header:', err)
  }

  return data
}
