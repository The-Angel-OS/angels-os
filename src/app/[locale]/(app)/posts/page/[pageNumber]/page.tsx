import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { PaginatedDocs } from 'payload'
import { headers } from 'next/headers'
import React from 'react'
import { notFound } from 'next/navigation'

import type { Post } from '@/payload-types'
import { CollectionArchive, POSTS_PER_PAGE } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'

export const metadata = {
  description: 'Blog posts and articles from Angel OS.',
  title: 'Posts',
}

type Args = {
  params: Promise<{ pageNumber: string }>
}

export default async function PostsPageNumber({ params }: Args) {
  const { pageNumber } = await params
  const page = parseInt(pageNumber, 10)
  if (isNaN(page) || page < 1) return notFound()

  let posts: PaginatedDocs<Post> | null = null

  try {
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

    posts = (await payload.find({
      collection: 'posts',
      draft: false,
      depth: 1,
      limit: POSTS_PER_PAGE,
      overrideAccess: true,
      pagination: true,
      page,
      where: {
        and: [
          { _status: { equals: 'published' } },
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
    })) as unknown as PaginatedDocs<Post>
  } catch (err) {
    console.error('[PostsPageNumber] Query failed:', err)
  }

  if (posts?.page && posts.page > posts.totalPages) return notFound()

  return (
    <div className="container py-12">
      <h1 className="mb-8 text-3xl font-bold">Posts</h1>

      <div className="mb-6">
        {posts && (
          <PageRange
            collection="posts"
            currentPage={posts.page}
            limit={POSTS_PER_PAGE}
            totalDocs={posts.totalDocs}
          />
        )}
      </div>

      {!posts || posts.docs?.length === 0 ? (
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
