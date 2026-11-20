import type { Tenant } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'
import { canManagePortal } from '@/utilities/canManagePortal'

import { headers } from 'next/headers'
import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import { injectPagesUnderHome, ALWAYS_PROMOTED_PAGE_SLUGS, type PageLite } from '@/utilities/pagesNav'
import { resolveViewerStanding, isPageViewable } from '@/utilities/pageAccess'
import { injectPostsUnderNav, injectEpisodesUnderNav, isEpisodesItem, isPostsItem, type PostLite } from '@/utilities/postsNav'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'
import { injectProductsUnderNav, isShopItem, type ProductLite, DEFAULT_SHOP_DROPDOWN_COUNT } from '@/utilities/productsNav'
import { injectEventsUnderNav, type EventLite, DEFAULT_EVENTS_DROPDOWN_COUNT } from '@/utilities/eventsNav'
import { hasFeature, isGivingOrg } from '@/utilities/tenantFeatures'
import { getBookableServices } from '@/config/bookableServices'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { getNavOverrides, EMPTY_NAV_OVERRIDES, type NavOverrides } from '@/utilities/navOverrides'
import { getAvailableWorks } from '@/works/registry'

import './index.css'
import { HeaderClient } from './index.client'

type Props = {
  tenant: Tenant | null
}

export async function Header({ tenant }: Props) {
  const tenantId = tenant?.id ?? null
  let header = null
  try {
    header = tenantId
      ? await getTenantCachedDoc('header', tenantId, 1)()
      : null
  } catch (err) {
    console.error('[Header] Failed to fetch header doc:', err)
  }

  if (!header && tenantId) {
    console.warn(`[Header] No header doc found for tenant ${tenantId} (slug: ${tenant?.slug ?? 'none'})`)
  }

  // Hierarchical nav: dynamically hang the tenant's published Pages under Home.
  // Done at render so new pages appear with zero nav maintenance. Non-fatal.
  /**
   * The owner's intent layer over the derived menu — hide what they have but
   * don't want advertised, pin what must stay up front, cap the inline count.
   * Everything else the menu works out from what the endeavor actually has.
   */
  let navOverrides: NavOverrides = EMPTY_NAV_OVERRIDES
  /** The join page when this tenant has an active plan — lifted to a primary nav item. */
  let membership: { url: string; label: string } | null = null
  if (tenantId) {
    // Membership is the one recurring-revenue surface, and it was the only one
    // that could never be promoted: Shop/Book/Donate all have a force-primary
    // rule, so on Clearwater the join page sat THIRD, nested under Home between
    // "Contact" and five product listings. The CTA that takes money monthly lost
    // to a soundbar.
    //
    // Found by BLOCK, not by slug: whichever page carries the `membership` block
    // is the join surface. Nothing to configure and no naming convention to
    // remember — drop the block on a page and it promotes itself. Gated on there
    // actually being an active plan, so a half-built join page stays in More
    // instead of advertising "not configured yet".
    try {
      const payload = await getPayload({ config })
      const plans = await getMembershipPlans(payload, tenantId)
      if (plans.some((pl) => pl.active !== false)) {
        const joinPages = await payload.find({
          collection: 'pages',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { _status: { equals: 'published' } },
              { 'layout.blockType': { equals: 'membership' } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const joinPage = joinPages.docs?.[0] as { slug?: string; title?: string; navLabel?: string } | undefined
        if (joinPage?.slug) {
          membership = { url: `/${joinPage.slug}`, // The title is a headline ("Join The Angel OS Today"), never a nav label —
            // default to "Join" and let navLabel override it.
            label: joinPage.navLabel || 'Join' }
        }
      }
    } catch (err) {
      console.error('[Header] Failed to resolve the membership join page:', err)
    }
  }

  // Shop/Posts/Episodes/Events/Book are first-class only when populated — else they collapse into More.
  let hasProducts = false
  let hasEvents = false
  let hasPosts = false
  let hasEpisodes = false
  let hasBook = false
  if (tenantId) {
    try {
      const payload = await getPayload({ config })
      const [productsCount, eventsCount, servicesCount] = await Promise.all([
        payload.count({ collection: 'products', where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] }, overrideAccess: true }),
        payload.count({ collection: 'events', where: { and: [{ tenant: { equals: tenantId } }, { status: { in: ['upcoming', 'live'] } }] }, overrideAccess: true }),
        payload.count({ collection: 'services', where: { and: [{ tenant: { equals: tenantId } }, { enabled: { equals: true } }] }, overrideAccess: true }),
      ])
      hasProducts = productsCount.totalDocs > 0
      hasEvents = eventsCount.totalDocs > 0
      hasBook = servicesCount.totalDocs > 0 || getBookableServices(tenant?.slug).length > 0
    } catch (err) {
      console.error('[Header] Failed to count products/events/services:', err)
    }
  }

  if (header && tenantId) {
    try {
      const payload = await getPayload({ config })
      const pages = await payload.find({
        collection: 'pages',
        where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] },
        limit: 24,
        depth: 0,
        sort: 'title',
        overrideAccess: true,
      })
      // Resolve the viewer's membership standing ONCE so gated pages can be filtered
      // out of the nav for ineligible visitors (the same gate the page render uses).
      let viewer = { isAdmin: false, isAuthenticated: false, isMember: false, inGoodStanding: false }
      try {
        const { user } = await payload.auth({ headers: await headers() })
        viewer = await resolveViewerStanding(payload, user, tenantId)
      } catch {
        /* anonymous viewer — only public pages show */
      }
      const pageList: PageLite[] = (
        pages.docs as Array<{ id?: number | string; slug?: string | null; title?: string | null; navLabel?: string | null; navOrder?: number | null; showInNav?: boolean | null; access?: string | null; parent?: unknown }>
      )
        .filter((p) => isPageViewable(p.access, viewer))
        .map((p) => ({
          // id and parent drive the dropdowns: a page nests under its parent
          // page's top-level item. Filtered FIRST, so a parent the viewer may
          // not see cannot adopt anything — its children fall back to Home.
          id: p.id,
          slug: p.slug,
          title: p.title,
          navLabel: p.navLabel,
          navOrder: p.navOrder,
          showInNav: p.showInNav,
          parent: p.parent as PageLite['parent'],
        }))

      // Fast counts + capped preview queries (max 8) rather than fetching 1000 posts on every render.
      const videoPostWhere = {
        or: [
          { sourceType: { in: ['youtube', 'vimeo'] } },
          { sourceUrl: { like: 'youtube.com' } },
          { sourceUrl: { like: 'youtu.be' } },
        ],
      }
      const [totalPostsRes, videoPostsCountRes] = await Promise.all([
        payload.count({
          collection: 'posts',
          where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] },
          overrideAccess: true,
        }),
        payload.count({
          collection: 'posts',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { _status: { equals: 'published' } },
              videoPostWhere,
            ],
          },
          overrideAccess: true,
        }),
      ])

      hasEpisodes = videoPostsCountRes.totalDocs > 0
      hasPosts = totalPostsRes.totalDocs > videoPostsCountRes.totalDocs

      const storedNavItems = (header as { navItems?: Array<{ children?: unknown[] }> }).navItems || []
      const episodesNavHasChildren = storedNavItems.some(
        (item) => isEpisodesItem(item) && Array.isArray(item.children) && item.children.length > 0,
      )
      const postsNavHasChildren = storedNavItems.some(
        (item) => isPostsItem(item) && Array.isArray(item.children) && item.children.length > 0,
      )

      const thumb = (m: unknown, sourceUrl?: string | null): string | null => {
        if (m && typeof m === 'object') {
          const media = m as { url?: string | null; sizes?: { thumbnail?: { url?: string | null } } }
          const resolved = media.sizes?.thumbnail?.url || media.url || null
          if (resolved) return resolved
        }
        if (sourceUrl) {
          const embed = computeEmbedUrl(sourceUrl)
          if (embed.provider === 'youtube' && embed.videoId) {
            return `https://i.ytimg.com/vi/${embed.videoId}/hqdefault.jpg`
          }
        }
        return null
      }

      const [episodeRes, postRes] = await Promise.all([
        hasEpisodes && !episodesNavHasChildren
          ? payload.find({
              collection: 'posts',
              where: {
                and: [
                  { tenant: { equals: tenantId } },
                  { _status: { equals: 'published' } },
                  videoPostWhere,
                ],
              },
              limit: 8,
              depth: 1,
              sort: '-publishedOn',
              select: { slug: true, title: true, sourceUrl: true, sourceType: true, meta: { image: true } },
              overrideAccess: true,
            })
          : Promise.resolve({ docs: [] }),
        hasPosts && !postsNavHasChildren
          ? payload.find({
              collection: 'posts',
              where: {
                and: [
                  { tenant: { equals: tenantId } },
                  { _status: { equals: 'published' } },
                  {
                    or: [
                      { sourceType: { not_in: ['youtube', 'vimeo'] } },
                      { sourceType: { exists: false } },
                    ],
                  },
                ],
              },
              limit: 16,
              depth: 1,
              sort: '-publishedOn',
              select: { slug: true, title: true, sourceUrl: true, sourceType: true, meta: { image: true } },
              overrideAccess: true,
            })
          : Promise.resolve({ docs: [] }),
      ])

      type NavPostRow = {
        slug?: string | null
        title?: string | null
        sourceUrl?: string | null
        sourceType?: string | null
        meta?: { image?: unknown }
      }

      const episodeList: PostLite[] = (episodeRes.docs as NavPostRow[]).map((p) => ({
        slug: p.slug,
        title: p.title,
        image: thumb(p.meta?.image, p.sourceUrl),
      }))

      const postList: PostLite[] = (postRes.docs as NavPostRow[])
        .filter((p) => !p.sourceUrl?.includes('youtube.com') && !p.sourceUrl?.includes('youtu.be'))
        .slice(0, 8)
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          image: thumb(p.meta?.image, p.sourceUrl),
        }))

      // Top products → Shop dropdown, each with its first gallery image as a
      // thumbnail. Defaults to the top N (configurable via DEFAULT_SHOP_DROPDOWN_COUNT);
      // sorted most-recent for now — a popularity ranking can replace the sort later.
      const products = await payload.find({
        collection: 'products',
        // Published only — draft products have no live /products/<slug> page (404).
        where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] },
        limit: DEFAULT_SHOP_DROPDOWN_COUNT,
        depth: 1, // resolve gallery[].image → media
        sort: '-createdAt',
        overrideAccess: true,
      })
      const productList: ProductLite[] = (
        products.docs as Array<{ slug?: string | null; title?: string | null; gallery?: Array<{ image?: unknown }> }>
      ).map((p) => ({
        slug: p.slug,
        title: p.title,
        image: thumb(p.gallery?.[0]?.image),
      }))

      // Upcoming events → Events dropdown, each with its cover image as a thumbnail.
      const events = await payload.find({
        collection: 'events',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { startDateTime: { greater_than_equal: new Date().toISOString() } },
            // Public statuses only — draft/completed/cancelled have no live page.
            { status: { in: ['upcoming', 'live'] } },
          ],
        },
        limit: DEFAULT_EVENTS_DROPDOWN_COUNT,
        depth: 1, // resolve coverImage → media
        sort: 'startDateTime', // soonest first
        overrideAccess: true,
      })
      const eventList: EventLite[] = (
        events.docs as Array<{ slug?: string | null; title?: string | null; coverImage?: unknown }>
      ).map((e) => ({ slug: e.slug, title: e.title, image: thumb(e.coverImage) }))

      let navItems = injectPagesUnderHome((header as { navItems?: unknown[] }).navItems || [], pageList, {
        // The membership page is lifted to its own primary item below, so keep
        // it out of the Home dropdown rather than listing it twice.
        excludeSlugs: [
          // 'donate' is in ALWAYS_PROMOTED only because HeaderClient appends a
          // Giving CTA — and it only does that for a ministry or nonprofit now.
          // Excluding it anywhere else would drop a real /donate PAGE out of the
          // Home dropdown in exchange for a promotion that never comes, leaving
          // a published page with no route into the menu at all.
          ...ALWAYS_PROMOTED_PAGE_SLUGS.filter(
            (slug) => slug !== 'donate' || isGivingOrg(tenant?.businessType),
          ),
          ...(membership ? [membership.url.replace(/^\//, '')] : []),
        ],
      })

      if (hasEpisodes && !navItems.some(isEpisodesItem)) {
        navItems.push({ id: 'episodes', link: { type: 'custom', label: 'Episodes', url: '/episodes' } })
      }
      if (hasProducts && !navItems.some(isShopItem)) {
        navItems.push({ id: 'shop', link: { type: 'custom', label: 'Shop', url: '/shop' } })
      }

      navItems = injectEpisodesUnderNav(navItems, episodeList, { max: 8, skipIfHasChildren: true })
      navItems = injectPostsUnderNav(navItems, postList, { max: 8, skipIfHasChildren: true })
      navItems = injectProductsUnderNav(navItems, productList)
      navItems = injectEventsUnderNav(navItems, eventList)
      header = { ...header, navItems }
    } catch (err) {
      console.error('[Header] Failed to inject dynamic nav (pages/posts/products/events):', err)
    }
  }

  // Works (catalog rows, subscription-scoped by tenant slug) — first-class only
  // when this tenant actually has works available; else collapse into More.
  const hasWorks =
    hasFeature(tenant, 'works') && (await getAvailableWorks(tenant?.slug)).length > 0

  // Discovery link visibility — driven by the Endeavor's "Show in Discovery"
  // toggle (endeavors.federation.networkVisible). Left undefined when there's no
  // Endeavor doc yet so HeaderClient falls back to its businessType inference.
  let showDiscovery: boolean | undefined = undefined
  if (tenantId) {
    try {
      const payload = await getPayload({ config })
      const endeavor = await payload.find({
        collection: 'endeavors',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        select: { federation: true },
        overrideAccess: true,
      })
      const fed = (endeavor.docs[0] as { federation?: { networkVisible?: boolean } } | undefined)?.federation
      if (fed) showDiscovery = Boolean(fed.networkVisible)
    } catch (err) {
      console.error('[Header] Failed to resolve Discovery visibility:', err)
    }
  }

  if (tenantId) {
    try {
      const payload = await getPayload({ config })
      navOverrides = await getNavOverrides(payload, tenantId)
    } catch (err) {
      console.error('[Header] Failed to read nav overrides:', err)
    }
  }

  // Who may edit THIS portal's content. Previously decided on the client from
  // the platform roles array alone, so a portal's own tenant_admin — the person
  // whose site it is — never saw "Edit this page", while any platform editor saw
  // it everywhere. The tenant membership role is the whole point of the field.
  // Who may edit THIS portal's content — the viewer's membership role on this
  // tenant, not their platform roles. See canManagePortal for why that
  // distinction was getting the answer backwards in both directions.
  let canEditContent = false
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    canEditContent = await canManagePortal(payload, user, tenantId)
  } catch {
    /* anonymous, or roles unavailable — no edit affordance, the safe side */
  }

  const isAffiliateCatalog = tenant?.slug === 'mlb'
  const enableCart = hasProducts && !isAffiliateCatalog

  return <HeaderClient canEditContent={canEditContent} header={header} tenant={tenant} hasProducts={hasProducts} enableCart={enableCart} hasEpisodes={hasEpisodes} hasEvents={hasEvents} hasPosts={hasPosts} hasBook={hasBook} hasWorks={hasWorks} showDiscovery={showDiscovery} membership={membership} navOverrides={navOverrides} />
}
