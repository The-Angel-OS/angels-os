import type { Access } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * Ownership-scoped access: a document is visible to the people it is ABOUT.
 *
 * Returns a Where query rather than a boolean, which is the whole point.
 * `authenticated` (Boolean(user)) is never sufficient in this system, because
 * customers and vendors share ONE dashboard — a customer signing in to see
 * their own appointment is `authenticated` exactly like the electrician is. So
 * a bare authenticated check on customer-reachable data exposes every record on
 * the node, across every tenant, to anyone who ever transacted. (260725.)
 *
 * Admins are unscoped; guests get nothing.
 *
 * For MANAGER surfaces — a vendor viewing their whole book — scope the QUERY
 * with `overrideAccess: true` plus a tenant filter, as /dashboard/appointments
 * does. Do not widen the collection for everyone to serve the manager case.
 */
export const ownedBy =
  (...fields: string[]): Access =>
  ({ req }) => {
    if (req.user && checkRole(ADMIN_ROLES, req.user)) return true
    if (!req.user?.id) return false
    const id = req.user.id
    return fields.length === 1
      ? { [fields[0]!]: { equals: id } }
      : { or: fields.map((f) => ({ [f]: { equals: id } })) }
  }

/**
 * Ownership by the `customer` field — the commerce default, wired through
 * plugins/index.ts.
 */
export const isDocumentOwner: Access = ownedBy('customer')
