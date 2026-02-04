import type { Field } from 'payload'

/**
 * Tenant relationship field for multi-tenant collections.
 * The multi-tenant plugin may also add a tenant field; this provides an explicit
 * field when the collection schema needs it (e.g. for non-plugin collections).
 */
export const tenantField: Field = {
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  admin: {
    description: 'Tenant this document belongs to',
  },
}
