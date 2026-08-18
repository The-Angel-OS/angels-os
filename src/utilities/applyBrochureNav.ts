/**
 * Point a portal's navigation at its OWN pages.
 *
 * The header derives itself from what a portal has, and a freshly provisioned
 * one has almost nothing — so the bar fills with platform routes (Discovery,
 * Works, Learn, Spaces) and the pages the business actually sells with collapse
 * into "More". That is survivable on a community portal and fatal on a brochure
 * site: the prospect opens the free site built for them and sees someone else's
 * product instead of their own services.
 *
 * Fixed by hand for kessela and anthonyjstudio before this existed. Third time
 * is a utility.
 */
import type { Payload } from 'payload'
import { setNavOverrides } from './navOverrides'
import { navLink } from './defaultNavItems'

/**
 * Platform-wide routes that must never ride a small-business bar: Discovery,
 * Works, Learn, Spaces.
 *
 * These are DEMOTED, not deleted. Capping the inline count at exactly the
 * business's own pages pushes every one of them into "More", where they stay
 * reachable for an owner who wants them without ever being the first thing a
 * customer sees. Pass `hidePlatformRoutes` to drop them altogether.
 */
export const PLATFORM_ROUTES = ['/learn', '/works', '/federation/discover', '/dashboard/spaces']

export interface BrochureNavPage {
  slug: string
  title: string
  /** Home is reached by the logo and does not need a row of its own. */
  showInNav?: boolean
}

/** '/'+slug, with 'home' collapsing to '/'. */
export const navUrlFor = (slug: string): string => (slug === 'home' ? '/' : `/${slug}`)

export async function applyBrochureNav(
  payload: Payload,
  tenantId: number | string,
  pages: BrochureNavPage[],
  opts: { hidePlatformRoutes?: boolean } = {},
): Promise<{ navItems: number; pinned: string[]; hidden: string[]; maxInline: number }> {
  const items = [
    navLink('Home', '/'),
    ...pages
      .filter((p) => p.slug !== 'home' && p.showInNav !== false)
      .map((p) => navLink(p.title, navUrlFor(p.slug))),
  ]

  const existing = await payload.find({
    collection: 'header',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const header = existing.docs?.[0] as { id: number | string } | undefined
  if (header) {
    await payload.update({
      collection: 'header',
      id: header.id,
      data: { navItems: items } as never,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'header',
      data: { tenant: tenantId, navItems: items } as never,
      overrideAccess: true,
    })
  }

  const pinned = items.map((i) => i.link.url)
  const hidden = opts.hidePlatformRoutes ? PLATFORM_ROUTES : []
  // EXACTLY the pinned count, deliberately. Any slack here is a slot Discovery
  // or Spaces immediately takes, which is the whole problem being fixed — so
  // the bar holds the business's pages and nothing else, and everything the
  // platform derives collapses into "More".
  const maxInline = pinned.length
  await setNavOverrides(payload, tenantId, { pinned, hidden, maxInline })

  return { navItems: items.length, pinned, hidden, maxInline }
}
