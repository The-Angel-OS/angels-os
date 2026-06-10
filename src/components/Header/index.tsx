import type { Tenant } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import { injectPagesUnderHome, type PageLite } from '@/utilities/pagesNav'

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
      header = { ...header, navItems: injectPagesUnderHome((header as { navItems?: unknown[] }).navItems || [], pageList) }
    } catch (err) {
      console.error('[Header] Failed to inject Pages under Home:', err)
    }
  }

  return <HeaderClient header={header} tenant={tenant} />
}
