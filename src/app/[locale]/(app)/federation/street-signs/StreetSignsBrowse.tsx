'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { trackStreetSignImpression, trackStreetSignClick } from './actions'

export interface StreetSign {
  id: number | string
  title: string
  description: string
  contentType: string
  source: {
    dioceseName: string
    dioceseDomain: string
    federationId: string
    contentId: string
    contentUrl: string
    creatorName: string
  }
  tags: string[]
  holonTypes: string[]
  region: string
  thumbnail: string | null
  price: number | null
  currency: string
  impressions: number
  clickThroughs: number
}

const CONTENT_TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Products', value: 'product' },
  { label: 'Posts', value: 'post' },
  { label: 'Events', value: 'event' },
  { label: 'Services', value: 'service' },
  { label: 'Portfolios', value: 'portfolio' },
  { label: 'Endeavors', value: 'endeavor' },
]

const CONTENT_TYPE_STYLES: Record<string, string> = {
  product: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  post: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  event: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  service: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  portfolio: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  endeavor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  product: 'Product',
  post: 'Post',
  event: 'Event',
  service: 'Service',
  portfolio: 'Portfolio',
  endeavor: 'Endeavor',
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

interface StreetSignsBrowseProps {
  initialSigns: StreetSign[]
  total: number
}

export function StreetSignsBrowse({ initialSigns, total }: StreetSignsBrowseProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Track impressions for visible signs (fire-and-forget on mount)
  React.useEffect(() => {
    initialSigns.forEach((sign) => {
      trackStreetSignImpression(sign.id).catch(() => {})
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback((sign: StreetSign) => {
    trackStreetSignClick(sign.id).catch(() => {})
    if (sign.source.contentUrl) {
      window.open(sign.source.contentUrl, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const filtered = useMemo(() => {
    return initialSigns.filter((s) => {
      if (search) {
        const q = search.toLowerCase()
        const matches =
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.source.dioceseName.toLowerCase().includes(q) ||
          s.source.creatorName.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
        if (!matches) return false
      }
      if (typeFilter && s.contentType !== typeFilter) return false
      return true
    })
  }, [initialSigns, search, typeFilter])

  return (
    <div className="container py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold md:text-4xl">Federation Street Signs</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Discover products, events, services, and content from across the Angel OS federation.
          Every street sign credits and connects to the source Enterprise.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} listing{total !== 1 ? 's' : ''} across the network
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        <div className="relative mx-auto max-w-xl">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings, creators, enterprises..."
            className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {CONTENT_TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          {initialSigns.length === 0 ? (
            <>
              <h3 className="mb-1 text-lg font-semibold">No street signs yet</h3>
              <p className="text-sm text-muted-foreground">
                The federation marketplace is growing. Content will appear here as Enterprises share
                their offerings.
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-1 text-lg font-semibold">No matches found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((sign) => (
            <button
              key={sign.id}
              onClick={() => handleClick(sign)}
              className="group cursor-pointer rounded-lg border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Thumbnail */}
              {sign.thumbnail ? (
                <div className="h-40 w-full overflow-hidden rounded-t-lg">
                  <img
                    src={sign.thumbnail}
                    alt={sign.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-t-lg bg-muted/30">
                  <svg
                    className="h-8 w-8 text-muted-foreground/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}

              <div className="p-4">
                {/* Content type badge */}
                <span
                  className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    CONTENT_TYPE_STYLES[sign.contentType] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {CONTENT_TYPE_LABELS[sign.contentType] || sign.contentType}
                </span>

                {/* Title */}
                <h3 className="mb-1 line-clamp-2 text-sm font-semibold group-hover:text-primary">
                  {sign.title}
                </h3>

                {/* Source */}
                <p className="mb-2 text-xs text-muted-foreground">
                  {sign.source.creatorName
                    ? `${sign.source.creatorName} · ${sign.source.dioceseName}`
                    : sign.source.dioceseName}
                </p>

                {/* Price */}
                {sign.price != null && sign.price > 0 && (
                  <p className="mb-2 text-sm font-semibold text-primary">
                    {formatPrice(sign.price, sign.currency)}
                  </p>
                )}

                {/* Tags */}
                {sign.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sign.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
