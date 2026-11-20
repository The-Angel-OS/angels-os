import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
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
    description: `Stories, social updates, and insights from ${siteName}.`,
  }
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

/**
 * Posts listing page — tenant-aware with optional ?category= filtering and search.
 * When a portal defines a `social-posts` category (like MLB), `/posts` scopes by
 * default to `social-posts` so Shows (/shows) and Database (/database) stay distinct;
 * all other portals list their full published Posts collection cleanly.
 */
export default async function PostsPage({ searchParams }: Props) {
  const { q: searchValue, page: pageParam, category: catParam } = (await searchParams) || {}
  const pageRaw = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1)
  const q = typeof searchValue === 'string' && searchValue.trim() ? searchValue.trim() : undefined
  const categorySlug =
    typeof catParam === 'string' && catParam.trim() ? catParam.trim() : undefined

  let posts: PaginatedDocs<Post> | null = null
  let heroImage: string | null = null
  let isSocialScoped = false
  let activeCategoryTitle: string | null = null

  try {
    const payload = await getPayload({ config: configPromise })
    const { tenantFilter, tenant } = await resolveTenantFromHeaders()
    heroImage = tenantHeroImage(tenant, 'posts')

    let categoryFilterId: number | string | null = null
    let categoryMiss = false

    if (categorySlug) {
      const catRes = await payload.find({
        collection: 'categories',
        where: {
          and: [
            { slug: { equals: categorySlug } },
            ...(tenant?.id != null ? [{ tenant: { equals: tenant.id } }] : []),
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const matched = catRes.docs?.[0] as { id?: number | string; title?: string } | undefined
      if (matched?.id != null) {
        categoryFilterId = matched.id
        activeCategoryTitle = matched.title || categorySlug
      } else {
        categoryMiss = true
      }
    } else if (tenant?.id != null) {
      const socialCatRes = await payload.find({
        collection: 'categories',
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            { slug: { equals: 'social-posts' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const socialCat = socialCatRes.docs?.[0] as { id?: number | string } | undefined
      if (socialCat?.id != null) {
        categoryFilterId = socialCat.id
        isSocialScoped = true
      }
    }

    const postWhereConditions: Where[] = [
      { _status: { equals: 'published' } },
      tenantFilter,
      ...(categoryMiss
        ? ([{ categories: { in: [-1] } }] as Where[])
        : categoryFilterId != null
          ? ([{ categories: { in: [categoryFilterId] } }] as Where[])
          : []),
      ...(q
        ? ([
            {
              or: [
                { title: { like: q } },
                { slug: { like: q } },
                { 'geo.locationName': { like: q } },
              ] as Where[],
            },
          ] as Where[])
        : []),
    ]

    posts = (await payload.find({
      collection: 'posts',
      draft: false,
      depth: 1,
      limit: POSTS_PER_PAGE,
      overrideAccess: true,
      pagination: true,
      page,
      where: {
        and: postWhereConditions,
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
        access: true,
      },
      sort: '-publishedOn',
    })) as unknown as PaginatedDocs<Post>
  } catch (err) {
    console.error('[PostsPage] Query failed:', err)
  }

  return (
    <div className="container py-8">
      <CollectionHero
        title={activeCategoryTitle || 'Posts'}
        subtitle={
          isSocialScoped
            ? 'Social posts, community updates & creator dispatches'
            : 'Stories, updates, and insights'
        }
        icon="📝"
        image={heroImage}
      />

      <div className="my-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form method="GET" action="/posts" className="relative w-full max-w-md">
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
          <input
            type="search"
            name="q"
            defaultValue={q || ''}
            placeholder="Search articles and updates..."
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

      {(q || categorySlug) && (
        <p className="mb-6 text-sm text-muted-foreground">
          {activeCategoryTitle && (
            <>
              Category: <span className="font-semibold text-foreground">{activeCategoryTitle}</span>
              {q ? ' · ' : ' '}
            </>
          )}
          {q && (
            <>
              Showing results for <span className="font-semibold text-foreground">&quot;{q}&quot;</span>{' '}
            </>
          )}
          &mdash;{' '}
          <Link href="/posts" className="underline hover:text-foreground">
            Clear filters
          </Link>
        </p>
      )}

      {!posts || posts.docs?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="mb-4 text-4xl">✍️</p>
          <p className="text-lg font-medium text-foreground">
            {q || categorySlug
              ? 'No matching posts found'
              : isSocialScoped
                ? 'Social posts feed ready'
                : 'Your blog awaits'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q || categorySlug
              ? 'Try searching with different keywords or clearing filters.'
              : isSocialScoped
                ? 'Social media dispatches and community announcements will appear here. Video investigations live under Shows, and places/topics live in the Database.'
                : 'No posts yet — check back soon, or head to the dashboard to create your first one.'}
          </p>
          {q || categorySlug ? (
            <Link
              href="/posts"
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View All Posts
            </Link>
          ) : isSocialScoped ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/shows"
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Browse Shows &amp; Episodes
              </Link>
              <Link
                href="/database"
                className="inline-block rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Explore Database
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard/posts"
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      ) : (
        <>
          <CollectionArchive posts={posts.docs} showCategories />
          {posts.totalPages > 1 && posts.page && (
            <div className="mt-8">
              <Pagination
                basePath="/posts"
                useQueryParam={Boolean(q || categorySlug)}
                queryParams={{ category: categorySlug, q }}
                page={posts.page}
                totalPages={posts.totalPages}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
