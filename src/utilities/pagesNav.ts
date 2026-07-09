/**
 * Pages-under-Home — the hierarchical nav slice.
 *
 * The Home menu item gets a DYNAMIC dropdown of the tenant's Pages, populated at
 * render time from the Pages collection — so "create as many pages as you can
 * handle" needs zero nav maintenance. One level only (no nesting), which covers
 * almost every real site. Any manually-authored children on Home are preserved;
 * page links are merged in (deduped by URL).
 *
 * Pure so it's testable and reused by both the desktop and mobile headers.
 */

export interface PageLite {
  slug?: string | null
  title?: string | null
  /** Optional menu label override (defaults to title, then slug). */
  navLabel?: string | null
  /** Sort order in the menu; lower first. Blank sorts last (then by title). */
  navOrder?: number | null
  /** When false, the page is published but excluded from the nav (e.g. a campaign page). */
  showInNav?: boolean | null
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

  const pageChildren = (Array.isArray(pages) ? pages : [])
    .filter((p): p is PageLite & { slug: string } => Boolean(p?.slug) && !exclude.has(p.slug as string))
    .filter((p) => p.showInNav !== false)
    .sort(byNavOrder)
    .slice(0, max)
    .map(pageToChild)

  if (pageChildren.length === 0) return items

  let injected = false
  const next = items.map((item) => {
    if (injected || !isHomeItem(item)) return item
    injected = true
    const existing = Array.isArray(item.children) ? item.children : []
    const existingUrls = new Set(existing.map((c: NavItem) => c?.link?.url))
    const merged = [...existing, ...pageChildren.filter((c) => !existingUrls.has(c.link.url))]
    return { ...item, children: merged }
  })

  return next
}
