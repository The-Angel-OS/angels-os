import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { notFound } from 'next/navigation'

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

  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    depth: 1,
    limit: POSTS_PER_PAGE,
    overrideAccess: false,
    pagination: true,
    page,
    where: { _status: { equals: 'published' } },
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

  if (posts.page && posts.page > posts.totalPages) return notFound()

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
