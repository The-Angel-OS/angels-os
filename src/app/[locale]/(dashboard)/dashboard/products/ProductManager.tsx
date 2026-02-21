'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export interface SerializedProduct {
  id: number
  title: string
  slug: string
  priceInUSD: number | null
  inventory: number | null
  status: 'draft' | 'published'
  categories: string[]
  galleryCount: number
  firstImageUrl: string | null
  createdAt: string
  updatedAt: string
}

interface ProductManagerProps {
  products: SerializedProduct[]
  totalProducts: number
}

type FilterStatus = 'all' | 'draft' | 'published'

export function ProductManager({ products, totalProducts }: ProductManagerProps) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')

  const filtered = products.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const publishedCount = products.filter((p) => p.status === 'published').length
  const draftCount = products.filter((p) => p.status === 'draft').length

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {totalProducts} product{totalProducts !== 1 ? 's' : ''} total
            {publishedCount > 0 && ` · ${publishedCount} published`}
            {draftCount > 0 && ` · ${draftCount} draft${draftCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/admin/collections/products/create"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New Product
        </Link>
      </div>

      {/* Filters + Search */}
      {totalProducts > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 rounded-md border border-border bg-muted/50 p-0.5">
            {(['all', 'published', 'draft'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'All' : s === 'published' ? 'Published' : 'Drafts'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalProducts === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Your store is ready!</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Add your first product to start selling. LEO can help you create products with descriptions, pricing, and even generate product images.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/products/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add Your First Product
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Ask LEO: &ldquo;Help me create my first product&rdquo;
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No products match your filters.{' '}
            <button
              onClick={() => { setFilter('all'); setSearch('') }}
              className="text-primary hover:underline"
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        /* Product grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: SerializedProduct }) {
  const priceStr = product.priceInUSD != null ? `$${product.priceInUSD.toFixed(2)}` : 'No price'

  return (
    <Link
      href={`/admin/collections/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
    >
      {/* Image or placeholder */}
      <div className="relative aspect-[4/3] bg-muted">
        {product.firstImageUrl ? (
          <img
            src={product.firstImageUrl}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-10 w-10 text-muted-foreground/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            product.status === 'published'
              ? 'bg-emerald-500 text-white'
              : 'bg-yellow-500 text-black'
          }`}
        >
          {product.status}
        </span>
        {/* Gallery count */}
        {product.galleryCount > 1 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {product.galleryCount} images
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="mb-1 truncate text-sm font-semibold group-hover:text-primary">
          {product.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{priceStr}</span>
          {product.inventory != null && (
            <span className={`text-xs ${product.inventory === 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {product.inventory === 0 ? 'Out of stock' : `${product.inventory} in stock`}
            </span>
          )}
        </div>
        {product.categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.categories.map((cat, i) => (
              <span
                key={i}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
