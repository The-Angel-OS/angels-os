import type { Tenant } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import { injectPagesUnderHome, type PageLite } from '@/utilities/pagesNav'
import { injectPostsUnderNav, type PostLite } from '@/utilities/postsNav'

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
      const pageList: PageLite[] = (pages.docs as Array<{ slug?: string | null; title?: string | null }>).map((p) => ({
        slug: p.slug,
        title: p.title,
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

      let navItems = injectPagesUnderHome((header as { navItems?: unknown[] }).navItems || [], pageList)
      navItems = injectPostsUnderNav(navItems, postList)
      header = { ...header, navItems }
    } catch (err) {
      console.error('[Header] Failed to inject dynamic nav (pages/posts):', err)
    }
  }

  return <HeaderClient header={header} tenant={tenant} />
}
