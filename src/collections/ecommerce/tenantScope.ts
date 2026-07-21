import type { CollectionConfig, PayloadRequest, Where, Access } from 'payload'
import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchTenantByExactDomain } from '@/utilities/fetchTenantByDomain'

/**
 * Tenant scoping for the ecommerce-plugin collections (carts, addresses,
 * transactions). These aren't in the multi-tenant plugin's map, so they had NO
 * tenant field — a cart/address is keyed to the customer only, and the plugin's
 * client fetches "my cart" by customer id with no tenant filter, so one cart/
 * address followed an SSO'd user across every portal (cross-tenant leak).
 *
 * This override adds a `tenant` field, sets it from the request host on create,
 * and ANDs a tenant filter into the read access — so each portal sees only its
 * own tenant's carts/addresses/transactions. Fail-safe: if the tenant can't be
 * resolved from the request (platform/apex, missing header), the read filter is
 * NOT tightened (falls back to the plugin's owner check) — never returns empty
 * and breaks the cart.
 */

/** Resolve the tenant id for the current request from its headers. */
export async function resolveTenantIdFromReq(req: PayloadRequest): Promise<number | undefined> {
  try {
    const slug = req?.headers?.get?.('x-tenant-id')
    if (slug) {
      const t = await fetchTenantBySlug(slug)
      if (t?.id != null) return Number(t.id)
    }
    const host = req?.headers?.get?.('host') || req?.headers?.get?.('x-forwarded-host')
    if (host) {
      const t = await fetchTenantByExactDomain(host)
      if (t?.id != null) return Number(t.id)
    }
  } catch {
    // Resolution failure → undefined → read access left untightened (fail-open,
    // no worse than today; never breaks the cart by returning empty).
  }
  return undefined
}

/** Wrap an ecommerce-plugin collection with tenant field + on-write + read scope. */
export const tenantScopedEcommerceOverride: CollectionOverride = ({ defaultCollection }) => {
  const base = defaultCollection as CollectionConfig
  const defaultRead = base.access?.read

  const readWithTenant: Access = async (args) => {
    const baseResult = typeof defaultRead === 'function' ? await defaultRead(args) : (defaultRead ?? true)
    if (baseResult === false) return false
    const tenantId = await resolveTenantIdFromReq(args.req)
    if (tenantId == null) return baseResult // fail-open — don't tighten when unknown
    const tenantWhere: Where = { tenant: { equals: tenantId } }
    if (baseResult === true) return tenantWhere
    return { and: [baseResult as Where, tenantWhere] }
  }

  return {
    ...base,
    access: { ...base.access, read: readWithTenant },
    fields: [
      ...base.fields,
      {
        name: 'tenant',
        type: 'relationship',
        relationTo: 'tenants',
        index: true,
        admin: { position: 'sidebar', description: 'Owning tenant (set from the request host).' },
      },
    ],
    hooks: {
      ...base.hooks,
      beforeChange: [
        ...(base.hooks?.beforeChange ?? []),
        async ({ data, req, operation }) => {
          if (operation === 'create' && data && data.tenant == null) {
            const tenantId = await resolveTenantIdFromReq(req)
            if (tenantId != null) data.tenant = tenantId
          }
          return data
        },
      ],
    },
  }
}
