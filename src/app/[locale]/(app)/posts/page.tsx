import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import React from 'react'

import { CollectionArchive, POSTS_PER_PAGE } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'

export const metadata = {
  description: 'Blog posts and articles from Angel OS.',
  title: 'Posts',
}

/**
 * Posts listing page — tenant-aware.
 *
 * Reads the x-tenant-id header injected by middleware to resolve the current
 * tenant, then filters posts to only show content belonging to that tenant.
 * This fixes the issue where posts were invisible because the multi-tenant
 * plugin's access control was filtering them out.
 */
export default async function PostsPage() {
  const payload = await getPayload({ config: configPromise })

  // Resolve tenant from middleware-injected header
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }

  // If no tenant found by slug, try the "default" tenant as fallback
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    depth: 1,
    limit: POSTS_PER_PAGE,
    overrideAccess: true, // Bypass multi-tenant plugin access control — we filter explicitly
    pagination: true,
    page: 1,
    where: {
      and: [
        { _status: { equals: 'published' } },
        // Tenant filter: show posts from the resolved tenant
        ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
      ],
    },
    select: {
      title: true,
      slug: true,
      publishedOn: true,
      meta: true,
      hero: true,
      categories: true,
    },
    sort: '-publishedOn',
  })

  return (
    <div className="container py-12">
      <h1 className="mb-8 text-3xl font-bold">Posts</h1>

      <div className="mb-6">
        <PageRange
          collection="posts"
          currentPage={posts.page}
          limit={POSTS_PER_PAGE}
          totalDocs={posts.totalDocs}
        />
      </div>

      {posts.docs?.length === 0 ? (
        <p className="text-muted-foreground">No posts yet. Check back soon!</p>
      ) : (
        <>
          <CollectionArchive posts={posts.docs} showCategories />
          {posts.totalPages > 1 && posts.page && (
            <Pagination page={posts.page} totalPages={posts.totalPages} />
          )}
        </>
      )}
    </div>
  )
}
