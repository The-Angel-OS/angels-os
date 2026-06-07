'use client'

import React, { useMemo, useState } from 'react'
import { FederationCard, type FederationHolon } from '@/components/FederationCard'

const HOLON_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Manufacturers', value: 'manufacturer' },
  { label: 'Retailers', value: 'retailer' },
  { label: 'Creators', value: 'creator' },
  { label: 'Communities', value: 'community' },
  { label: 'Guardian Angels', value: 'guardian-angel' },
]

interface FederationDiscoverProps {
  initialHolons: FederationHolon[]
  /** Number of Endeavors (ministries/works) listed. */
  total: number
  /** Number of Enterprises (federated nodes / Dioceses) on the network. */
  enterprises?: number
}

export function FederationDiscover({ initialHolons, total, enterprises = 1 }: FederationDiscoverProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  // Extract unique regions for filter dropdown
  const regions = useMemo(() => {
    const stateSet = new Set<string>()
    initialHolons.forEach((h) => {
      if (h.region.state) stateSet.add(h.region.state)
    })
    return Array.from(stateSet).sort()
  }, [initialHolons])

  // Client-side filtering
  const filtered = useMemo(() => {
    return initialHolons.filter((h) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase()
        const matches =
          h.name.toLowerCase().includes(q) ||
          h.tagline.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.capabilities.some((c) => c.skill.toLowerCase().includes(q))
        if (!matches) return false
      }

      // Holon type filter
      if (typeFilter && !h.holonTypes.includes(typeFilter)) {
        return false
      }

      // Region filter
      if (regionFilter && h.region.state !== regionFilter) {
        return false
      }

      return true
    })
  }, [initialHolons, search, typeFilter, regionFilter])

  return (
    <div className="container py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold md:text-4xl">Discovery — Explore the Federation</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Browse Endeavors across the Angel OS federation. Find partners, discover services, and grow
          together through constitutional commerce.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} Endeavor{total !== 1 ? 's' : ''} · {enterprises} Enterprise{enterprises !== 1 ? 's' : ''} on the Network
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4">
        {/* Search */}
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
            placeholder="Search endeavors, capabilities, descriptions..."
            className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Holon type pills + Region dropdown */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex flex-wrap gap-2">
            {HOLON_FILTERS.map((f) => (
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

          {regions.length > 0 && (
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            >
              <option value="">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {initialHolons.length === 0 ? (
            <>
              <h3 className="mb-1 text-lg font-semibold">No Enterprises yet</h3>
              <p className="text-sm text-muted-foreground">
                The federation network is growing. Be the first to make your Enterprise visible!
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-1 text-lg font-semibold">No matches found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters to find what you&apos;re looking for.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((holon) => (
            <FederationCard key={holon.id} holon={holon} />
          ))}
        </div>
      )}
    </div>
  )
}
