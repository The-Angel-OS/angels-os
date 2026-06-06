import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import type { Page } from '@/payload-types'

/**
 * Fetch a published CMS Page by slug, scoped to the current tenant (draft-aware
 * in preview). Returns null if none exists — callers fall back to their own
 * render. Shared by the dynamic `[slug]` route and the "special" routes
 * (/donate, /about) so any of them can be CMS-managed when a Page is authored.
 */
export async function queryPageBySlug({ slug }: { slug: string }): Promise<Page | null> {
  try {
    const { isEnabled: draft } = await draftMode()
    const { tenantFilter } = await resolveTenantFromHeaders()
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'pages',
      draft,
      limit: 1,
      overrideAccess: true, // Public pages must be readable without auth
      pagination: false,
      where: {
        and: [
          { slug: { equals: slug } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
          tenantFilter,
        ],
      },
    })

    return (result.docs?.[0] as Page) || null
  } catch (err) {
    console.error('[queryPageBySlug] Query failed:', err)
    return null
  }
}
