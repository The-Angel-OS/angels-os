import type { CollectionBeforeValidateHook } from 'payload'
import { logError } from '@/utilities/logError'

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

  // 1. Resolve from the active chat space — AUTHORITATIVE, and it overrides any
  //    client/plugin-provided `data.tenant`. A chat attachment MUST live in its
  //    space's tenant: the message's `attachments[].media` relationship is
  //    validated against the space's tenant, so a media stamped with a different
  //    tenant (e.g. the `payload-tenant` cookie defaulting to the platform tenant
  //    while the space belongs to a guardian-angel tenant) is rejected downstream
  //    as "invalid: Attachments > Media" — the upload appears to fail. The space
  //    is the ground truth, so it wins here. Only browser chat uploads send
  //    `_tenantSpace`; server callers don't, so their explicit `data.tenant`
  //    (handled below) is untouched.
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
        // This is the "invalid tenant id" upload failure class — escalate so it's
        // visible. Log without tenantId (none resolved) to avoid AI-Bus recursion.
        console.error('[setTenantFromHeader] Failed to resolve tenant from space:', err)
        void logError({
          source: 'Media/setTenantFromHeader/space',
          message: `Media tenant resolution from space ${String(spaceId)} failed (upload may be rejected): ${err instanceof Error ? err.message : String(err)}`,
          details: err instanceof Error ? err.stack : String(err),
        })
      }
    }
  }

  // A server caller (or the plugin default) already resolved a tenant and there's
  // no authoritative space hint — leave it alone. This preserves provisioning /
  // bridge writes that set `data.tenant` deliberately.
  if (data?.tenant) return data

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
    // Non-fatal — let Payload's normal validation handle a still-missing tenant,
    // but escalate (this also produces "invalid tenant id" on uploads).
    console.error('[setTenantFromHeader] Failed to resolve tenant from header:', err)
    void logError({
      source: 'Media/setTenantFromHeader/header',
      message: `Media tenant resolution from x-tenant-id="${tenantSlug}" failed (upload may be rejected): ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
    })
  }

  return data
}
