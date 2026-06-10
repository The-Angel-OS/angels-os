/**
 * Events dropdown — hang the next upcoming events under the Events nav item, each
 * with its cover image as a thumbnail. Completes the Pages/Posts/Shop/Events
 * dropdown family. Pure + testable; the server resolves the thumbnail URL.
 */

export interface EventLite {
  slug?: string | null
  title?: string | null
  image?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavItem = any

const isEventsItem = (item: NavItem): boolean => {
  const link = item?.link
  return link?.url === '/events' || (typeof link?.label === 'string' && link.label.toLowerCase() === 'events')
}

const eventToChild = (e: EventLite): NavItem => ({
  link: { type: 'custom', label: (e.title || e.slug) as string, url: `/events/${e.slug}` },
  ...(e.image ? { image: e.image } : {}),
})

export const DEFAULT_EVENTS_DROPDOWN_COUNT = 5

export function injectEventsUnderNav(
  navItems: NavItem[],
  events: EventLite[],
  opts: { max?: number } = {},
): NavItem[] {
  const max = opts.max ?? DEFAULT_EVENTS_DROPDOWN_COUNT
  const items = Array.isArray(navItems) ? navItems : []

  const eventChildren = (Array.isArray(events) ? events : [])
    .filter((e): e is EventLite & { slug: string } => Boolean(e?.slug))
    .slice(0, max)
    .map(eventToChild)

  if (eventChildren.length === 0) return items

  let injected = false
  return items.map((item) => {
    if (injected || !isEventsItem(item)) return item
    injected = true
    const existing = Array.isArray(item.children) ? item.children : []
    const existingUrls = new Set(existing.map((c: NavItem) => c?.link?.url))
    const merged = [...existing, ...eventChildren.filter((c) => !existingUrls.has(c.link.url))]
    return { ...item, children: merged }
  })
}
