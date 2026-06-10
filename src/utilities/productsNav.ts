/**
 * Shop dropdown — hang featured products under the Shop nav item, each with its
 * thumbnail, so Shop previews the catalog. Defaults to the top N (5); the count
 * is configurable via `max`, and the SELECTION is whatever order the caller
 * passes (default: most recent; a popularity ranking — e.g. by order count — can
 * be slotted in later without touching this).
 *
 * Same children mechanism as postsNav/pagesNav. Pure + testable.
 */

export interface ProductLite {
  slug?: string | null
  title?: string | null
  image?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

const isShopItem = (item: NavItem): boolean => {
  const link = item?.link
  return link?.url === '/shop' || (typeof link?.label === 'string' && link.label.toLowerCase() === 'shop')
}

const productToChild = (p: ProductLite): NavItem => ({
  link: { type: 'custom', label: (p.title || p.slug) as string, url: `/products/${p.slug}` },
  ...(p.image ? { image: p.image } : {}),
})

/** Default number of products shown in the Shop dropdown. */
export const DEFAULT_SHOP_DROPDOWN_COUNT = 5

export function injectProductsUnderNav(
  navItems: NavItem[],
  products: ProductLite[],
  opts: { max?: number } = {},
): NavItem[] {
  const max = opts.max ?? DEFAULT_SHOP_DROPDOWN_COUNT
  const items = Array.isArray(navItems) ? navItems : []

  const productChildren = (Array.isArray(products) ? products : [])
    .filter((p): p is ProductLite & { slug: string } => Boolean(p?.slug))
    .slice(0, max)
    .map(productToChild)

  if (productChildren.length === 0) return items

  let injected = false
  return items.map((item) => {
    if (injected || !isShopItem(item)) return item
    injected = true
    const existing = Array.isArray(item.children) ? item.children : []
    const existingUrls = new Set(existing.map((c: NavItem) => c?.link?.url))
    const merged = [...existing, ...productChildren.filter((c) => !existingUrls.has(c.link.url))]
    return { ...item, children: merged }
  })
}
