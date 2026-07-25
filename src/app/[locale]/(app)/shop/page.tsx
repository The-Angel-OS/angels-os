import { Grid } from '@/components/Grid'
import { ProductGridItem } from '@/components/ProductGridItem'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import React from 'react'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Angel OS'
  return {
    title: 'Shop', // bare — the (app) layout's title.template appends the portal name
    description: `Products crafted with care from ${siteName}.`,
  }
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

/**
 * Shop page — tenant-aware product listing.
 *
 * Reads x-tenant-id from middleware to resolve the current tenant,
 * then filters products to only show items belonging to that tenant.
 * Uses overrideAccess: true with explicit tenant filter to bypass
 * the multi-tenant plugin's access control (which was hiding products
 * when the hostname-derived slug didn't match tenant records).
 */
const PRODUCTS_PER_PAGE = 12

export default async function ShopPage({ searchParams }: Props) {
  const { q: searchValue, sort, category, page: pageParam } = await searchParams
  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const pageRaw = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1)

  const products = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: true,
    limit: PRODUCTS_PER_PAGE,
    page,
    pagination: true,
    select: {
      title: true,
      slug: true,
      gallery: true,
      categories: true,
      priceInUSD: true,
      meta: true,
    },
    ...(sort ? { sort } : { sort: 'title' }),
    where: {
      and: [
        { _status: { equals: 'published' } } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        tenantFilter,
        ...(searchValue ? [{ title: { like: searchValue } }] : []),
        ...(category ? [{ categories: { contains: category } }] : []),
      ],
    },
  })

  // Build a page URL that preserves the active filters (q/sort/category).
  const pageHref = (n: number) => {
    const p = new URLSearchParams()
    if (typeof searchValue === 'string' && searchValue) p.set('q', searchValue)
    if (typeof sort === 'string' && sort) p.set('sort', sort)
    if (typeof category === 'string' && category) p.set('category', category)
    if (n > 1) p.set('page', String(n))
    const qs = p.toString()
    return qs ? `/shop?${qs}` : '/shop'
  }

  const { totalDocs, totalPages, hasPrevPage, hasNextPage } = products
  const firstOnPage = totalDocs === 0 ? 0 : (page - 1) * PRODUCTS_PER_PAGE + 1
  const lastOnPage = (page - 1) * PRODUCTS_PER_PAGE + products.docs.length
  const resultsText = products.docs.length > 1 ? 'results' : 'result'

  return (
    <div>
      {searchValue ? (
        <p className="mb-4">
          {products.docs?.length === 0
            ? 'There are no products that match '
            : `Showing ${products.docs.length} ${resultsText} for `}
          <span className="font-bold">&quot;{searchValue}&quot;</span>
        </p>
      ) : null}

      {!searchValue && products.docs?.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="mb-4 text-4xl">🛍️</p>
          <p className="text-lg font-medium text-foreground">Shop coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Products are being prepared — check back soon or visit the dashboard to add your first listing.
          </p>
          <Link
            href="/dashboard/products"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
      )}

      {products?.docs.length > 0 ? (
        <>
          <Grid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.docs.map((product) => {
              return <ProductGridItem key={product.id} product={product} />
            })}
          </Grid>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6"
              aria-label="Shop pagination"
            >
              <span className="text-sm text-muted-foreground">
                Showing {firstOnPage}–{lastOnPage} of {totalDocs} {resultsText}
              </span>
              <div className="flex items-center gap-2">
                {hasPrevPage ? (
                  <Link
                    href={pageHref(page - 1)}
                    rel="prev"
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    ← Prev
                  </Link>
                ) : (
                  <span className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/50">
                    ← Prev
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                {hasNextPage ? (
                  <Link
                    href={pageHref(page + 1)}
                    rel="next"
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/50">
                    Next →
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      ) : null}
    </div>
  )
}
