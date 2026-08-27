import type { FilterOptions } from 'payload'

/**
 * Scope a relationship picker to the tenant of the document being edited.
 *
 * The multi-tenant plugin already REJECTS a cross-tenant pick at validation, but
 * it does not narrow the picker, and a platform admin reads every tenant — so the
 * Featured Posts & Products control on a portal's page listed every other portal's
 * catalogue and only complained on save. Offering a choice that cannot be saved is
 * the bug; this removes it from the list.
 *
 * `data` is the whole document (blocks are nested, so siblingData has no tenant).
 * Returns `true` — no constraint — when there is no tenant yet, which is the case
 * for an unsaved page and for the platform tenant's own editors.
 */
export const tenantFilterOptions: FilterOptions = ({ data }) => {
  const raw = (data as { tenant?: unknown } | undefined)?.tenant
  const tenant = raw && typeof raw === 'object' ? (raw as { id?: number | string }).id : raw
  if (tenant === undefined || tenant === null || tenant === '') return true
  // Number, because the plugin's own filterOptions compares ids in JS and a
  // string id silently matches nothing. @see ensurePageChannel.ts
  const id = typeof tenant === 'string' ? Number(tenant) : tenant
  return Number.isNaN(id as number) ? true : { tenant: { equals: id } }
}
