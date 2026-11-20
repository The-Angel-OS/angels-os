import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import type { Post, Product, ArchiveBlock as ArchiveBlockProps } from '@/payload-types'

import configPromise from '@payload-config'
import { DefaultDocumentIDType, getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'
import { RichText } from '@/components/RichText'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import { cn } from '@/utilities/cn'

type CategoryPill = {
  id: number | string
  title: string
  slug: string
}

type SearchParamsMap = Record<string, string | string[] | undefined>

function buildArchiveUrl(
  basePath: string,
  params: { category?: string; q?: string; page?: number },
): string {
  const sp = new URLSearchParams()
  if (params.category && params.category.trim()) sp.set('category', params.category.trim())
  if (params.q && params.q.trim()) sp.set('q', params.q.trim())
  if (params.page && params.page > 1) sp.set('page', String(params.page))
  const qs = sp.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function firstParam(val: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(val) ? val[0] : val
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: DefaultDocumentIDType
    className?: string
    enableSearch?: boolean | null
    enableCategoryTabs?: boolean | null
    enablePagination?: boolean | null
    searchParams?: SearchParamsMap
    currentPath?: string
  }
> = async (props) => {
  const {
    id,
    categories,
    columns,
    introContent,
    limit: limitFromProps,
    populateBy,
    relationTo,
    selectedDocs,
    enableSearch = false,
    enableCategoryTabs = false,
    enablePagination = false,
    searchParams,
    currentPath,
  } = props

  const usePagination = Boolean(enablePagination)
  const useSearch = Boolean(enableSearch)
  const useTabs = Boolean(enableCategoryTabs)
  const limit = limitFromProps || (usePagination ? 12 : 3)

  // Which collection this block is showing. Selection mode carries it per-doc
  // (the relationship is polymorphic), so read it off the first pick.
  const selectedRelation =
    populateBy === 'selection'
      ? (selectedDocs?.[0] as { relationTo?: string } | undefined)?.relationTo
      : undefined
  const collection: 'products' | 'posts' =
    (populateBy === 'collection' ? relationTo : selectedRelation) === 'posts' ? 'posts' : 'products'
  const cardBasePath = collection === 'posts' ? '/posts' : '/products'
  const pageUrlBase = currentPath || '/'

  const q = useSearch ? firstParam(searchParams?.q) : undefined
  const categorySlug = useTabs ? firstParam(searchParams?.category) : undefined
  const pageRaw = usePagination ? firstParam(searchParams?.page) : undefined
  const currentPage = usePagination
    ? Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1)
    : 1

  let posts: Array<Product | Post> = []
  let totalDocs = 0
  let totalPages = 1
  let resolvedPage = currentPage
  const configuredCategories: CategoryPill[] = []
  let activeCategory: CategoryPill | null = null

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })
    const { tenant } = await resolveTenantFromHeaders()

    // Preserve configured category order, hydrating any scalar IDs when needed
    const rawCats = Array.isArray(categories) ? categories : []
    const missingIds: Array<number | string> = []
    for (const cat of rawCats) {
      if (cat && typeof cat === 'object' && 'id' in cat) {
        const obj = cat as { id: number | string; title?: string | null; slug?: string | null }
        if (!obj.slug || !obj.title) missingIds.push(obj.id)
      } else if (cat !== null && cat !== undefined) {
        missingIds.push(cat)
      }
    }

    const hydratedById = new Map<string, CategoryPill>()
    if (missingIds.length > 0) {
      const catDocs = await payload.find({
        collection: 'categories',
        where: { id: { in: missingIds } },
        limit: missingIds.length,
        depth: 0,
        overrideAccess: true,
      })
      for (const c of catDocs.docs as Array<{ id: number | string; title?: string | null; slug?: string | null }>) {
        if (c.slug && c.title) {
          hydratedById.set(String(c.id), { id: c.id, title: c.title, slug: c.slug })
        }
      }
    }

    for (const cat of rawCats) {
      if (cat && typeof cat === 'object' && 'id' in cat) {
        const obj = cat as { id: number | string; title?: string | null; slug?: string | null }
        if (obj.slug && obj.title) {
          configuredCategories.push({ id: obj.id, title: obj.title, slug: obj.slug })
        } else {
          const found = hydratedById.get(String(obj.id))
          if (found) configuredCategories.push(found)
        }
      } else if (cat !== null && cat !== undefined) {
        const found = hydratedById.get(String(cat))
        if (found) configuredCategories.push(found)
      }
    }

    const flattenedCategories = rawCats
      .map((category) => (category && typeof category === 'object' ? category.id : category))
      .filter((v): v is number | string => v !== null && v !== undefined)

    if (categorySlug) {
      activeCategory = configuredCategories.find((c) => c.slug === categorySlug) ?? null
      if (!activeCategory) {
        const extraCat = await payload.find({
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
        const doc = extraCat.docs?.[0] as
          | { id?: number | string; title?: string | null; slug?: string | null }
          | undefined
        if (doc?.id != null && doc.slug && doc.title) {
          activeCategory = { id: doc.id, title: doc.title, slug: doc.slug }
        }
      }
    }

    const categoryFilter = categorySlug
      ? activeCategory
        ? [{ categories: { in: [activeCategory.id] } }]
        : [{ categories: { in: [-1] } }]
      : flattenedCategories.length > 0
        ? [{ categories: { in: flattenedCategories } }]
        : []

    const searchFilter =
      q && collection === 'posts'
        ? [
            {
              or: [
                { title: { like: q } },
                { slug: { like: q } },
                { 'geo.locationName': { like: q } },
                { 'geo.category': { like: q } },
              ],
            },
          ]
        : q
          ? [{ or: [{ title: { like: q } }, { slug: { like: q } }] }]
          : []

    /**
     * Scope to THIS portal's tenant, explicitly.
     *
     * `overrideAccess: true` lets public archive listings render teaser cards
     * for members-only posts (`access: 'members'`), while their body remains
     * gated on `/posts/[slug]`.
     */
    const fetched = await payload.find({
      collection,
      // Depth 2 so each card's meta.image / hero.media resolve to a document —
      // at depth 1 they come back as raw IDs and every card reads "No image".
      depth: 2,
      limit,
      page: currentPage,
      pagination: usePagination,
      overrideAccess: true,
      sort: collection === 'posts' ? '-publishedOn' : '-createdAt',
      where: {
        and: [
          ...(tenant?.id != null ? [{ tenant: { equals: tenant.id } }] : []),
          // A draft post has no live /posts/<slug> page, so never card one.
          ...(collection === 'posts' ? [{ _status: { equals: 'published' } }] : []),
          ...categoryFilter,
          ...searchFilter,
        ],
      },
    })

    posts = fetched.docs as Array<Product | Post>
    totalDocs = fetched.totalDocs ?? posts.length
    totalPages = fetched.totalPages ?? 1
    resolvedPage = fetched.page ?? currentPage
  } else {
    if (selectedDocs?.length) {
      posts = selectedDocs
        .map((doc) => (doc.value && typeof doc.value === 'object' ? doc.value : null))
        .filter(Boolean) as Array<Product | Post>
      totalDocs = posts.length
    }
  }

  const showControls = populateBy === 'collection' && (useSearch || useTabs || usePagination)
  const isFiltered = Boolean(q || categorySlug)
  const tabCategories =
    activeCategory && !configuredCategories.some((c) => c.slug === activeCategory!.slug)
      ? [...configuredCategories, activeCategory]
      : configuredCategories

  return (
    <div id={`block-${id}`}>
      {introContent && (
        <div className="container mb-8">
          <RichText className="ml-0 max-w-3xl" data={introContent} enableGutter={false} />
        </div>
      )}

      {showControls && (
        <div className="container mb-8 space-y-4">
          {useTabs && tabCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filter by category">
              <Link
                href={buildArchiveUrl(pageUrlBase, { q })}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  !categorySlug
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                All
              </Link>
              {tabCategories.map((cat) => {
                const active = categorySlug === cat.slug
                return (
                  <Link
                    key={String(cat.id)}
                    href={buildArchiveUrl(pageUrlBase, { category: cat.slug, q })}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    {cat.title}
                  </Link>
                )
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {useSearch ? (
              <form method="GET" action={pageUrlBase} className="relative w-full max-w-md">
                {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
                <input
                  type="search"
                  name="q"
                  defaultValue={q || ''}
                  placeholder="Search by title, structure, location, or topic..."
                  className="w-full rounded-md border border-border bg-background px-4 py-2 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Search
                </button>
              </form>
            ) : (
              <div />
            )}

            {usePagination && (
              <PageRange
                collection={collection}
                currentPage={resolvedPage}
                limit={limit}
                totalDocs={totalDocs}
              />
            )}
          </div>

          {isFiltered && (
            <p className="text-sm text-muted-foreground">
              {activeCategory && (
                <>
                  Category: <span className="font-semibold text-foreground">{activeCategory.title}</span>
                  {q ? ' · ' : ' '}
                </>
              )}
              {q && (
                <>
                  Matching <span className="font-semibold text-foreground">&quot;{q}&quot;</span>{' '}
                </>
              )}
              &mdash;{' '}
              <Link href={pageUrlBase} className="underline hover:text-foreground">
                Clear filters
              </Link>
            </p>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="container">
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-lg font-medium text-foreground">
              {isFiltered ? 'No matching entries found' : 'Nothing published here yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFiltered
                ? 'Try clearing the category filter or searching with different keywords.'
                : 'Check back soon as new entries are indexed.'}
            </p>
            {isFiltered && (
              <Link
                href={pageUrlBase}
                className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reset filters
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <CollectionArchive posts={posts as never} basePath={cardBasePath} columns={columns === '3' ? 3 : 4} />
          {usePagination && totalPages > 1 && (
            <div className="container mt-8">
              <Pagination
                basePath={pageUrlBase}
                useQueryParam
                queryParams={{ category: categorySlug, q }}
                page={resolvedPage}
                totalPages={totalPages}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
