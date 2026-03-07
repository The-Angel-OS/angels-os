import type { Where } from 'payload'

/**
 * Build a tenant isolation filter for Payload queries.
 *
 * TENANT ISOLATION RULE: Every collection query that uses overrideAccess: true
 * MUST include an explicit tenant filter. Never leave the tenant filter empty —
 * that returns content from ALL tenants, causing cross-tenant data leakage.
 *
 * When tenantId is set → scope to that specific tenant.
 * When tenantId is null/undefined → only return docs with NO tenant assigned
 * (platform-level content). This prevents tenant X's pages/posts/products
 * from appearing on the platform domain or another tenant's subdomain.
 */
export function buildTenantFilter(tenantId: number | string | null | undefined): Where {
  if (tenantId != null) {
    return { tenant: { equals: tenantId } }
  }
  // Platform context — only return documents with no tenant (platform-level content)
  return { tenant: { exists: false } }
}
