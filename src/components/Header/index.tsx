import type { Tenant } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import { injectPagesUnderHome, type PageLite } from '@/utilities/pagesNav'
import { injectPostsUnderNav, type PostLite } from '@/utilities/postsNav'
import { injectProductsUnderNav, type ProductLite, DEFAULT_SHOP_DROPDOWN_COUNT } from '@/utilities/productsNav'
import { injectEventsUnderNav, type EventLite, DEFAULT_EVENTS_DROPDOWN_COUNT } from '@/utilities/eventsNav'

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
      const pageList: PageLite[] = (
        pages.docs as Array<{ slug?: string | null; title?: string | null; navLabel?: string | null; navOrder?: number | null; showInNav?: boolean | null }>
      ).map((p) => ({
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

      let navItems = injectPagesUnderHome((header as { navItems?: unknown[] }).navItems || [], pageList)
      navItems = injectPostsUnderNav(navItems, postList)
      navItems = injectProductsUnderNav(navItems, productList)
      navItems = injectEventsUnderNav(navItems, eventList)
      header = { ...header, navItems }
    } catch (err) {
      console.error('[Header] Failed to inject dynamic nav (pages/posts/products/events):', err)
    }
  }

  // Shop/Events are first-class only when populated — else they collapse into More.
  let hasProducts = false
  let hasEvents = false
  if (tenantId) {
    try {
      const payload = await getPayload({ config })
      const [products, events] = await Promise.all([
        // Published only — a draft-only catalog shouldn't make Shop first-class.
        payload.count({ collection: 'products', where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'published' } }] }, overrideAccess: true }),
        payload.count({ collection: 'events', where: { and: [{ tenant: { equals: tenantId } }, { status: { in: ['upcoming', 'live'] } }] }, overrideAccess: true }),
      ])
      hasProducts = products.totalDocs > 0
      hasEvents = events.totalDocs > 0
    } catch (err) {
      console.error('[Header] Failed to count products/events:', err)
    }
  }

  return <HeaderClient header={header} tenant={tenant} hasProducts={hasProducts} hasEvents={hasEvents} />
}
