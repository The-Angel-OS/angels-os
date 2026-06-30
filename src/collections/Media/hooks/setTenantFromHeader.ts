import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Auto-resolve the media tenant for browser uploads (chat attachments).
 *
 * Media is tenant-scoped (multi-tenant plugin adds a required `tenant` field).
 * The plugin's defaultValue only resolves from the `payload-tenant` cookie,
 * which isn't reliably set in the custom dashboard — especially for a
 * super_admin viewing the platform/Core context. When the browser uploads
 * straight to /api/media, the client only attaches `tenant` if it can resolve
 * one; on Core (federation.kendev.co etc.) the middleware sets NO x-tenant-id
 * header (platform domains map to null) AND there's usually no payload-tenant
 * cookie → the create fails the required-tenant validator ("invalid tenant id").
 *
 * Resolution order (first hit wins), mirroring Messages/setTenantFromSpace so
 * uploads are server-authoritative and work on Core where there's no subdomain:
 *   0. `data.tenant` already set by a server caller → untouched.
 *   1. `data._tenantSpace` hint (the active chat space id the client sends) →
 *      look up the space's tenant. This is the authoritative source for chat
 *      attachments and works on the platform/Core domain.
 *   2. `x-tenant-id` header (subdomain slug) → look up the tenant by slug.
 *
 * The `_tenantSpace` hint is a transient field — it is NOT part of the Media
 * schema, so we strip it from `data` before validation regardless of outcome.
 *
 * All lookups pass `req` so they JOIN the request's own connection rather than
 * acquiring a separate pooled one that can stall under connection pressure
 * (the kendev node-health class of failure).
 */
export const setTenantFromHeader: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create') return data

  // Pull and strip the transient space hint (never persisted to Media).
  const spaceHint = (data as Record<string, unknown> | undefined)?._tenantSpace
  if (data && '_tenantSpace' in data) {
    delete (data as Record<string, unknown>)._tenantSpace
  }

  // A server caller already resolved the tenant — leave it alone.
  if (data?.tenant) return data

  // 1. Resolve from the active chat space (authoritative; works on Core).
  if (spaceHint != null && spaceHint !== '') {
    const spaceId = typeof spaceHint === 'object'
      ? (spaceHint as { id?: string | number }).id
      : spaceHint
    if (spaceId != null) {
      try {
        const space = await req.payload.findByID({
          collection: 'spaces',
          id: spaceId as string | number,
          depth: 0,
          overrideAccess: true,
          req,
        })
        if (space?.tenant) {
          const tenantId = typeof space.tenant === 'object' ? space.tenant.id : space.tenant
          return { ...data, tenant: tenantId }
        }
      } catch (err) {
        console.error('[setTenantFromHeader] Failed to resolve tenant from space:', err)
      }
    }
  }

  // 2. Fall back to the subdomain slug header.
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
