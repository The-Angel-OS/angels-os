import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import type { PaginatedDocs } from 'payload'
import React from 'react'
import Link from 'next/link'

import type { Post } from '@/payload-types'
import { CollectionArchive, POSTS_PER_PAGE } from '@/components/CollectionArchive'
import { CollectionHero } from '@/components/CollectionHero'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Angel OS'
  return {
    title: 'Posts', // bare — the (app) layout's title.template appends the portal name
    description: `Stories, updates, and insights from ${siteName}.`,
  }
}

/**
 * Posts listing page — tenant-aware with branded hero.
 */
export default async function PostsPage() {
  let posts: PaginatedDocs<Post> | null = null

  let heroImage: string | null = null
  try {
    const payload = await getPayload({ config: configPromise })
    const { tenantFilter, tenant } = await resolveTenantFromHeaders()
    heroImage = tenantHeroImage(tenant, 'posts')

    posts = (await payload.find({
      collection: 'posts',
      draft: false,
      depth: 1,
      limit: POSTS_PER_PAGE,
      overrideAccess: true,
      pagination: true,
      page: 1,
      where: {
        and: [
          { _status: { equals: 'published' } },
          tenantFilter,
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
    console.error('[PostsPage] Query failed:', err)
  }

  return (
    <div className="container py-8">
      <CollectionHero
        title="Posts"
        subtitle="Stories, updates, and insights"
        icon="📝"
        image={heroImage}
      />

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
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="mb-4 text-4xl">✍️</p>
          <p className="text-lg font-medium text-foreground">Your blog awaits</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No posts yet — check back soon, or head to the dashboard to create your first one.
          </p>
          <Link
            href="/dashboard/posts"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
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
