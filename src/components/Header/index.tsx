import type { Tenant } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'

import { headers } from 'next/headers'
import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import { injectPagesUnderHome, ALWAYS_PROMOTED_PAGE_SLUGS, type PageLite } from '@/utilities/pagesNav'
import { resolveViewerStanding, isPageViewable } from '@/utilities/pageAccess'
import { injectPostsUnderNav, type PostLite } from '@/utilities/postsNav'
import { injectProductsUnderNav, type ProductLite, DEFAULT_SHOP_DROPDOWN_COUNT } from '@/utilities/productsNav'
import { injectEventsUnderNav, type EventLite, DEFAULT_EVENTS_DROPDOWN_COUNT } from '@/utilities/eventsNav'
import { getAllSouls } from '@/souls'
import { getBookableServices } from '@/config/bookableServices'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { isWorkAvailable, isWorkPublished } from '@/souls/subscriptions'

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
        pages.docs as Array<{ slug?: string | null; title?: string | null; navLabel?: string | null; navOrder?: number | null; showInNav?: boolean | null; access?: string | null }>
      )
        .filter((p) => isPageViewable(p.access, viewer))
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          navLabel: p.navLabel,
          navOrder: p.navOrder,
          showInNav: p.showInNav,
        }))

      // Latest posts → Posts dropdown, each with its meta image as a thumbnail.
      const posts = await payload.find({
        collection: 'posts',
        where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] },
        limit: 5,
        depth: 1, // resolve meta.image → media
        sort: '-publishedOn',
        overrideAccess: true,
      })
      const thumb = (m: unknown): string | null => {
        if (!m || typeof m !== 'object') return null
        const media = m as { url?: string | null; sizes?: { thumbnail?: { url?: string | null } } }
        return media.sizes?.thumbnail?.url || media.url || null
      }
      const postList: PostLite[] = (posts.docs as Array<{ slug?: string | null; title?: string | null; meta?: { image?: unknown } }>).map((p) => ({
        slug: p.slug,
        title: p.title,
        image: thumb(p.meta?.image),
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
          ...ALWAYS_PROMOTED_PAGE_SLUGS,
          ...(membership ? [membership.url.replace(/^\//, '')] : []),
        ],
      })
      navItems = injectPostsUnderNav(navItems, postList)
      navItems = injectProductsUnderNav(navItems, productList)
      navItems = injectEventsUnderNav(navItems, eventList)
      header = { ...header, navItems }
    } catch (err) {
      console.error('[Header] Failed to inject dynamic nav (pages/posts/products/events):', err)
    }
  }

  // Shop/Posts/Events/Book are first-class only when populated — else they collapse into More.
  let hasProducts = false
  let hasEvents = false
  let hasPosts = false
  let hasBook = false
  if (tenantId) {
    try {
      const payload = await getPayload({ config })
      const [products, events, posts, services] = await Promise.all([
        // Published only — a draft-only catalog shouldn't make Shop first-class.
        payload.count({ collection: 'products', where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] }, overrideAccess: true }),
        payload.count({ collection: 'events', where: { and: [{ tenant: { equals: tenantId } }, { status: { in: ['upcoming', 'live'] } }] }, overrideAccess: true }),
        payload.count({ collection: 'posts', where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] }, overrideAccess: true }),
        // Book promotes when the tenant has at least one enabled bookable service —
        // DB `services` OR the static bookableServices seed (fallback-aware, matching
        // what the /book page actually resolves via resolveServices). A tenant whose
        // catalog lives only in the static config (e.g. clearwater-cruisin) was
        // previously read as 0 and Book collapsed into "More".
        payload.count({ collection: 'services', where: { and: [{ tenant: { equals: tenantId } }, { enabled: { equals: true } }] }, overrideAccess: true }),
      ])
      hasProducts = products.totalDocs > 0
      hasEvents = events.totalDocs > 0
      hasPosts = posts.totalDocs > 0
      hasBook = services.totalDocs > 0 || getBookableServices(tenant?.slug).length > 0
    } catch (err) {
      console.error('[Header] Failed to count products/events/posts/services:', err)
    }

  }

  // Works (file-based souls, subscription-scoped by tenant slug) — first-class only
  // when this tenant actually has works available; else collapse into More.
  const hasWorks = getAllSouls().some((s) => isWorkAvailable(s.id, tenant?.slug) && isWorkPublished(s.id))

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

  return <HeaderClient header={header} tenant={tenant} hasProducts={hasProducts} hasEvents={hasEvents} hasPosts={hasPosts} hasBook={hasBook} hasWorks={hasWorks} showDiscovery={showDiscovery} membership={membership} />
}
