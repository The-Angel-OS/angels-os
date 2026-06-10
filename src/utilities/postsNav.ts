/**
 * Posts-latest dropdown — hang the most recent posts under the Posts nav item,
 * each carrying its meta/OG image so the dropdown renders a thumbnail ("the meta
 * icon of those"). Same children mechanism as pagesNav, plus an `image`.
 *
 * Pure + testable; the server resolves the thumbnail URL and passes it in.
 */

export interface PostLite {
  slug?: string | null
  title?: string | null
  /** Resolved thumbnail URL (meta.image → media sizes.thumbnail/url). */
  image?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

const isPostsItem = (item: NavItem): boolean => {
  const link = item?.link
  return link?.url === '/posts' || (typeof link?.label === 'string' && link.label.toLowerCase() === 'posts')
}

const postToChild = (p: PostLite): NavItem => ({
  link: { type: 'custom', label: (p.title || p.slug) as string, url: `/posts/${p.slug}` },
  ...(p.image ? { image: p.image } : {}),
})

/**
 * Inject the latest posts as children of the Posts nav item. Returns navItems
 * unchanged when there are no eligible posts. `max` caps the dropdown (default 5).
 * Manually-authored children are preserved; posts merge in (deduped by URL).
 */
export function injectPostsUnderNav(
  navItems: NavItem[],
  posts: PostLite[],
  opts: { max?: number } = {},
): NavItem[] {
  const max = opts.max ?? 5
  const items = Array.isArray(navItems) ? navItems : []

  const postChildren = (Array.isArray(posts) ? posts : [])
    .filter((p): p is PostLite & { slug: string } => Boolean(p?.slug))
    .slice(0, max)
    .map(postToChild)

  if (postChildren.length === 0) return items

  let injected = false
  return items.map((item) => {
    if (injected || !isPostsItem(item)) return item
    injected = true
    const existing = Array.isArray(item.children) ? item.children : []
    const existingUrls = new Set(existing.map((c: NavItem) => c?.link?.url))
    const merged = [...existing, ...postChildren.filter((c) => !existingUrls.has(c.link.url))]
    return { ...item, children: merged }
  })
}
