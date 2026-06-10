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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

const isHomeItem = (item: NavItem): boolean => {
  const link = item?.link
  return link?.url === '/' || (typeof link?.label === 'string' && link.label.toLowerCase() === 'home')
}

/** Build a child nav link from a page. */
const pageToChild = (p: PageLite): NavItem => ({
  link: { type: 'custom', label: (p.title || p.slug) as string, url: `/${p.slug}` },
})

/**
 * Inject the tenant's pages as children of the Home nav item. Returns navItems
 * unchanged when there are no eligible pages. `excludeSlugs` defaults to ['home']
 * (the page that IS Home). Capped by `max` so the dropdown stays sane.
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
