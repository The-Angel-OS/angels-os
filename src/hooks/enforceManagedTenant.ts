import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

import { isPlatformAdmin, managedTenantIds } from '@/access/portalManager'

/**
 * A portal manager may only write into a tenant they actually manage.
 *
 * `create` access can only answer yes/no — it cannot constrain a document that
 * does not exist yet — so "may create" and "may create HERE" are two different
 * questions and this hook answers the second. It also closes the update case:
 * without it a manager could move one of their own documents onto somebody
 * else's tenant, which is a write to that tenant by another name.
 *
 * Server flows (provisioning, seeds, LEO tools) pass overrideAccess and are not
 * subject to this — the same convention the rest of the codebase uses.
 */
export const enforceManagedTenant: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (!req.user) return data
  if (isPlatformAdmin(req.user)) return data
  if (operation !== 'create' && operation !== 'update') return data

  const ids = await managedTenantIds(req)
  if (!ids.length) throw new APIError('You do not manage a portal.', 403)

  const raw = (data as { tenant?: unknown } | undefined)?.tenant
  const incoming = Number(raw && typeof raw === 'object' ? (raw as { id: unknown }).id : raw)

  // A create that names no tenant gets the only one they manage; ambiguous when
  // they manage several, and guessing wrong writes to the wrong site.
  if (!Number.isFinite(incoming)) {
    if (operation === 'create') {
      if (ids.length === 1) return { ...(data || {}), tenant: ids[0] }
      const existing = Number((originalDoc as { tenant?: unknown } | undefined)?.tenant)
      if (Number.isFinite(existing) && ids.includes(existing)) return data
      throw new APIError('Choose which portal this belongs to.', 400)
    }
    return data
  }

  if (!ids.includes(incoming)) {
    throw new APIError('That portal is not yours to write to.', 403)
  }
  return data
}

/**
 * The same guard at beforeChange, which runs AFTER beforeValidate.
 *
 * The tenant plugin injects hooks of its own and may set `tenant` itself; hook
 * ordering between a plugin and a collection is not something to assume when
 * being wrong means a write lands on someone else's portal. Checking the value
 * that is actually about to be persisted removes the assumption entirely.
 */
export const enforceManagedTenantOnChange: CollectionBeforeChangeHook = async (args) =>
  enforceManagedTenant(args as never) as never
