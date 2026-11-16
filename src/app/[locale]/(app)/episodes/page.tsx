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
    title: 'Episodes',
    description: `Complete investigative video archive and dossiers from ${siteName}.`,
  }
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

/**
 * Episodes archive page — video investigations with live search and pagination.
 */
export default async function EpisodesPage({ searchParams }: Props) {
  const { q: searchValue, page: pageParam } = (await searchParams) || {}
  const pageRaw = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1)
  const q = typeof searchValue === 'string' && searchValue.trim() ? searchValue.trim() : undefined

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
      page,
      where: {
        and: [
          { _status: { equals: 'published' } },
          tenantFilter,
          { sourceType: { in: ['youtube', 'vimeo'] } },
          ...(q ? [{ or: [{ title: { like: q } }, { slug: { like: q } }] }] : []),
        ],
      },
      select: {
        title: true,
        slug: true,
        publishedOn: true,
        meta: true,
        hero: true,
        categories: true,
        sourceUrl: true,
        sourceType: true,
      },
      sort: '-publishedOn',
    })) as unknown as PaginatedDocs<Post>
  } catch (err) {
    console.error('[EpisodesPage] Query failed:', err)
  }

  return (
    <div className="container py-8">
      <CollectionHero
        title="Episodes"
        subtitle="Complete investigative video archive and architectural dossiers"
        icon="🎬"
        image={heroImage}
      />

      <div className="my-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form method="GET" action="/episodes" className="relative w-full max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={q || ''}
            placeholder="Search episodes by title, structure, topic..."
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Search
          </button>
        </form>

        {posts && (
          <PageRange
            collection="posts"
            currentPage={posts.page}
            limit={POSTS_PER_PAGE}
            totalDocs={posts.totalDocs}
          />
        )}
      </div>

      {q && (
        <p className="mb-6 text-sm text-muted-foreground">
          Showing results for <span className="font-semibold text-foreground">&quot;{q}&quot;</span> &mdash;{' '}
          <Link href="/episodes" className="underline hover:text-foreground">
            Clear search
          </Link>
        </p>
      )}

      {!posts || posts.docs?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="mb-4 text-4xl">🎬</p>
          <p className="text-lg font-medium text-foreground">
            {q ? 'No matching episodes found' : 'No episodes yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q
              ? 'Try searching with different keywords or structure names.'
              : 'Check back soon for new investigative releases.'}
          </p>
          {q && (
            <Link
              href="/episodes"
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View All Episodes
            </Link>
          )}
        </div>
      ) : (
        <>
          <CollectionArchive posts={posts.docs} showCategories basePath="/posts" />
          {posts.totalPages > 1 && posts.page && (
            <div className="mt-8">
              <Pagination page={posts.page} totalPages={posts.totalPages} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
