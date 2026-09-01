/**
 * Pages-under-Home — the hierarchical nav slice.
 *
 * The Home menu item gets a DYNAMIC dropdown of the tenant's Pages, populated at
 * render time from the Pages collection — so "create as many pages as you can
 * handle" needs zero nav maintenance. Any manually-authored children on Home are
 * preserved; page links are merged in (deduped by URL).
 *
 * A page with a `parent` nests under THAT page's top-level nav item instead of
 * under Home. This is the DNN model, and it is the reason `parent` has existed
 * on Pages all along with nothing reading it: the menu is the page tree, so the
 * page tree is the menu editor. Setting a parent in the admin is the whole
 * configuration step.
 *
 * A child whose parent is not a top-level nav item falls back to the Home
 * dropdown rather than disappearing — losing a page from the menu because its
 * parent was unpublished is worse than showing it in a slightly odd place.
 *
 * Pure so it's testable and reused by both the desktop and mobile headers.
 */

export interface PageLite {
  /** Needed only to resolve `parent` (an id at depth 0) back to a slug. */
  id?: number | string | null
  slug?: string | null
  title?: string | null
  /** Optional menu label override (defaults to title, then slug). */
  navLabel?: string | null
  /** Sort order in the menu; lower first. Blank sorts last (then by title). */
  navOrder?: number | null
  /** When false, the page is published but excluded from the nav (e.g. a campaign page). */
  showInNav?: boolean | null
  /**
   * Nested-docs parent. An id at depth 0, the populated doc at depth > 0 —
   * accept both so callers are not forced to pay for a join they do not need.
   */
  parent?: number | string | { id?: number | string | null } | null
}

/** The parent's id, whether it arrived as a scalar or a populated doc. */
const parentIdOf = (p: PageLite): string | null => {
  const raw = p.parent
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object') return raw.id === null || raw.id === undefined ? null : String(raw.id)
  return String(raw)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

/**
 * Page slugs that must NEVER be injected under Home because the header chrome
 * already promotes them as first-class items ('home' is the parent itself;
 * 'donate' is always appended as the Donate/Giving CTA by HeaderClient). When a
 * new always-on CTA collides with a CMS page slug, add it here — this constant
 * is the single source both the server header and any future menu builders use.
 */
export const ALWAYS_PROMOTED_PAGE_SLUGS = ['home', 'donate'] as const

const isHomeItem = (item: NavItem): boolean => {
  const link = item?.link
  return link?.url === '/' || (typeof link?.label === 'string' && link.label.toLowerCase() === 'home')
}

/** Build a child nav link from a page (navLabel overrides title). */
const pageToChild = (p: PageLite): NavItem => ({
  link: { type: 'custom', label: (p.navLabel || p.title || p.slug) as string, url: `/${p.slug}` },
})

/** Sort: by navOrder ascending (blank/last), then alphabetically by display label. */
const byNavOrder = (a: PageLite, b: PageLite): number => {
  const ao = typeof a.navOrder === 'number' ? a.navOrder : Number.POSITIVE_INFINITY
  const bo = typeof b.navOrder === 'number' ? b.navOrder : Number.POSITIVE_INFINITY
  if (ao !== bo) return ao - bo
  return String(a.navLabel || a.title || a.slug).localeCompare(String(b.navLabel || b.title || b.slug))
}

/**
 * Inject the tenant's pages as children of the Home nav item. Pages with
 * showInNav === false are excluded (e.g. campaign/landing pages). Sorted by
 * navOrder then label. Returns navItems unchanged when there are no eligible
 * pages. `excludeSlugs` defaults to ['home']. Capped by `max`.
 */
export function injectPagesUnderHome(
  navItems: NavItem[],
  pages: PageLite[],
  opts: { max?: number; excludeSlugs?: string[] } = {},
): NavItem[] {
  const max = opts.max ?? 12
  const exclude = new Set(opts.excludeSlugs ?? ['home'])
  const items = Array.isArray(navItems) ? navItems : []

  const eligible = (Array.isArray(pages) ? pages : [])
    .filter((p): p is PageLite & { slug: string } => Boolean(p?.slug) && !exclude.has(p.slug as string))
    .filter((p) => p.showInNav !== false)
    .sort(byNavOrder)

  // id -> slug, off the same list, so nesting costs no extra query and works at
  // depth 0. A parent that is unpublished or gated simply is not in here, and
  // its children fall through to Home.
  const slugById = new Map<string, string>()
  for (const p of eligible) if (p.id !== null && p.id !== undefined) slugById.set(String(p.id), p.slug)

  // A parent only takes children if it is ALREADY a top-level item. Nesting
  // under something the visitor cannot see is how a page goes missing.
  const topLevelUrls = new Set(
    items.map((i: NavItem) => i?.link?.url).filter((u: unknown): u is string => typeof u === 'string'),
  )
  const urlForParent = (p: PageLite): string | null => {
    const pid = parentIdOf(p)
    if (!pid) return null
    const slug = slugById.get(pid)
    if (!slug) return null
    const url = `/${slug}`
    return topLevelUrls.has(url) ? url : null
  }

  const nested = new Map<string, NavItem[]>()
  const underHome: NavItem[] = []
  for (const p of eligible) {
    const url = urlForParent(p)
    if (url) {
      const list = nested.get(url) ?? []
      list.push(pageToChild(p))
      nested.set(url, list)
    } else {
      underHome.push(pageToChild(p))
    }
  }

  const pageChildren = underHome.slice(0, max)
  if (pageChildren.length === 0 && nested.size === 0) return items

  /** Merge new children onto an item, keeping hand-authored ones and deduping by URL. */
  const withChildren = (item: NavItem, add: NavItem[]): NavItem => {
    const existing = Array.isArray(item.children) ? item.children : []
    const seen = new Set(existing.map((c: NavItem) => c?.link?.url))
    return { ...item, children: [...existing, ...add.filter((c) => !seen.has(c.link.url))] }
  }

  let injected = false
  return items.map((item) => {
    const own = nested.get(item?.link?.url)
    let next = own ? withChildren(item, own.slice(0, max)) : item
    if (!injected && isHomeItem(item) && pageChildren.length > 0) {
      injected = true
      next = withChildren(next, pageChildren)
    }
    return next
  })
}
