/**
 * Nav repair — backfill missing DEFAULT nav links onto an existing tenant's nav
 * without disturbing what's already there.
 *
 * createDefaultTenantNavigation is find-or-create: once a tenant has a header it
 * never gets new default links (e.g. Contact, added later). This computes the
 * union: keep every existing item (and its row id) untouched, append only the
 * defaults whose URL isn't already present. Custom/reordered nav is preserved.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

/** The comparable URL for a nav item — only 'custom' links carry one. */
function navUrl(item: NavItem): string | null {
  const link = item?.link
  if (link && link.type === 'custom' && typeof link.url === 'string') return link.url
  return null
}

export interface NavBackfillResult {
  items: NavItem[]
  added: string[] // URLs of links appended
}

/**
 * Merge `defaults` into `existing`: append any default link whose URL is absent.
 * New links land just before a `/dashboard` link if present (so Dashboard stays
 * last), else at the end. Returns the original array unchanged when nothing's missing.
 */
export function backfillNavItems(existing: NavItem[], defaults: NavItem[]): NavBackfillResult {
  const list = Array.isArray(existing) ? existing : []
  const present = new Set(list.map(navUrl).filter((u): u is string => Boolean(u)))

  const missing = (Array.isArray(defaults) ? defaults : []).filter((d) => {
    const u = navUrl(d)
    return u != null && !present.has(u)
  })
  if (missing.length === 0) return { items: list, added: [] }

  const dashIdx = list.findIndex((i) => navUrl(i) === '/dashboard')
  const items =
    dashIdx >= 0
      ? [...list.slice(0, dashIdx), ...missing, ...list.slice(dashIdx)]
      : [...list, ...missing]

  return { items, added: missing.map((m) => navUrl(m)).filter((u): u is string => Boolean(u)) }
}
