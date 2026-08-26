import type { CollectionBeforeValidateHook } from 'payload'

/**
 * An order's tenant is the SELLER — so read it off what is being bought.
 *
 * Orders are in `multiTenantPlugin`'s `collections`, which injects a REQUIRED
 * `tenant` field whose only auto-resolution is the `payload-tenant` cookie.
 * That cookie is an admin-panel artefact: a shopper on a portal subdomain does
 * not have one. The ecommerce plugin's `confirmOrder` never sets `tenant`
 * either — so creating an order threw
 * `ValidationError: Assigned Tenant` at the one moment it must not, AFTER
 * Stripe has already captured the card. Money taken, no order, no entitlement.
 * Zero orders exist platform-wide, which is what that looks like from outside.
 *
 * Resolution order, first hit wins:
 *   0. `data.tenant` already set by a server caller → untouched.
 *   1. the first line item's product's tenant — the seller, and authoritative.
 *   2. the `x-tenant-id` header (portal subdomain slug) — for an order with no
 *      product lines (a booking deposit, a service invoice).
 *
 * ponytail: no fallback beyond those two. An order that can resolve neither
 * should fail loudly rather than be filed under the wrong seller.
 */
export const setTenantFromItems: CollectionBeforeValidateHook = async ({ data, req, operation }) => {
  if (operation !== 'create' || !data) return data
  if (data.tenant != null && data.tenant !== '') return data

  const items = Array.isArray(data.items) ? data.items : []
  for (const item of items) {
    const raw = (item as { product?: unknown })?.product
    const productId = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : raw
    if (productId == null) continue
    try {
      const product = await req.payload.findByID({
        collection: 'products',
        id: productId as string | number,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (product?.tenant) {
        const tenantId = typeof product.tenant === 'object' ? product.tenant.id : product.tenant
        return { ...data, tenant: tenantId }
      }
    } catch {
      // Try the next line item rather than failing the whole order here.
    }
  }

  const slug = req.headers?.get?.('x-tenant-id')
  if (slug) {
    try {
      const found = await req.payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (found.docs[0]) return { ...data, tenant: found.docs[0].id }
    } catch {
      // fall through — the required-field validator will report it
    }
  }

  return data
}
