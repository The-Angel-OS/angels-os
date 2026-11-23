'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'

export interface PortalCardItem {
  id: string
  slug: string
  name: string
  domain: string
  tagline?: string | null
  status: 'active' | 'inactive' | 'provisioning' | string
  type: string
  plan: string
  planLabel: string
  isGuardianAngel: boolean
  relationship: 'owner' | 'platform_admin'
  siteUrl: string
  dashboardUrl: string
  settingsUrl: string
  adminUrl?: string
  createdAt?: string | null
}

interface UserPortalsClientProps {
  heading?: string | null
  subheading?: string | null
  portals: PortalCardItem[]
  columns?: '2' | '3' | '4' | string | null
  showQuota?: boolean | null
  showFilters?: boolean | null
  showCreateCard?: boolean | null
  quota?: { used: number; quota: number } | null
  isSuperAdmin?: boolean
  isAuthenticated?: boolean
}

type FilterKey = 'all' | 'active' | 'creator_business' | 'guardian_angel' | 'owned' | 'platform_admin'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  provisioning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  inactive: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
}

const PLAN_STYLES: Record<string, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  creator: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  site: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  business: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  agency: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  demo: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
}

const TYPE_LABELS: Record<string, string> = {
  platform: 'Platform Root',
  business: 'Business',
  creator: 'Creator',
  tenant: 'Portal',
  ministry: 'Ministry',
  guardian_angel: 'Guardian Angel',
  personal_portal: 'Personal Portal',
  circle: 'Circle',
}

export function UserPortalsClient({
  heading = 'Your Portals',
  subheading,
  portals,
  columns = '3',
  showQuota = true,
  showFilters = true,
  showCreateCard = true,
  quota,
  isSuperAdmin = false,
  isAuthenticated = false,
}: UserPortalsClientProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const hasOwned = portals.some((p) => p.relationship === 'owner')
  const hasAdminOnly = portals.some((p) => p.relationship === 'platform_admin')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return portals.filter((p) => {
      if (filter === 'active' && p.status !== 'active') return false
      if (filter === 'guardian_angel' && !p.isGuardianAngel && p.type !== 'guardian_angel') {
        return false
      }
      if (filter === 'creator_business' && (p.isGuardianAngel || p.type === 'guardian_angel')) {
        return false
      }
      if (filter === 'owned' && p.relationship !== 'owner') return false
      if (filter === 'platform_admin' && p.relationship !== 'platform_admin') return false

      if (q) {
        const hay = `${p.name} ${p.slug} ${p.domain} ${p.tagline || ''} ${p.type}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [portals, search, filter])

  const gridClass =
    columns === '2'
      ? 'grid-cols-1 md:grid-cols-2'
      : columns === '4'
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  const filterButtons: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: `All (${portals.length})` },
    { key: 'active', label: 'Active' },
    { key: 'creator_business', label: 'Business & Creator' },
    { key: 'guardian_angel', label: 'Guardian Angel' },
    ...(isSuperAdmin && hasOwned && hasAdminOnly
      ? [
          { key: 'owned' as const, label: 'Owned by You' },
          { key: 'platform_admin' as const, label: 'Admin View' },
        ]
      : []),
  ]

  if (!isAuthenticated) {
    return (
      <section className="container my-8">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">{heading || 'Your Portals'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to view and launch your Angel OS creator portals.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Start a Free Portal
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="container my-8" aria-label={heading || 'Your Portals'}>
      <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
        {/* Header Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {heading || 'Your Portals'}
              </h2>
              <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {portals.length} {portals.length === 1 ? 'portal' : 'portals'}
              </span>
              {showQuota && quota && (
                <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {quota.used} of {quota.quota} owned on plan
                </span>
              )}
            </div>
            {subheading ? (
              <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Pick up where you left off across your active sites, creator storefronts, and workspaces.
              </p>
            )}
          </div>

          {showCreateCard && (
            <Link
              href="/start"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              + Launch New Portal
            </Link>
          )}
        </div>

        {/* Search & Filter Toolbar */}
        {showFilters && portals.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {filterButtons.map((btn) => {
                const active = filter === btn.key
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => setFilter(btn.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {btn.label}
                  </button>
                )
              })}
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter portals by name or domain..."
                aria-label="Filter portals"
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Portal Cards Grid */}
        {filtered.length === 0 && !showCreateCard ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No portals match your current filter.
          </div>
        ) : (
          <div className={`mt-6 grid gap-4 ${gridClass}`}>
            {filtered.map((portal) => {
              const statusStyle =
                STATUS_STYLES[portal.status] || 'bg-muted text-muted-foreground border-border'
              const planStyle =
                PLAN_STYLES[portal.plan] || 'bg-muted text-muted-foreground border-border'
              const typeLabel =
                portal.isGuardianAngel
                  ? 'Guardian Angel'
                  : TYPE_LABELS[portal.type] || portal.type || 'Portal'

              return (
                <div
                  key={portal.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-background p-4 shadow-xs transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div>
                    {/* Status / Plan / Role Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusStyle}`}
                      >
                        {portal.status || 'active'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${planStyle}`}
                      >
                        {portal.planLabel}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {typeLabel}
                      </span>
                      {portal.relationship === 'platform_admin' ? (
                        <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                          Admin View
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                          Owner
                        </span>
                      )}
                    </div>

                    {/* Portal Identity */}
                    <div className="mt-3">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {portal.name}
                      </h3>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {portal.domain}
                      </p>
                      {portal.tagline && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                          {portal.tagline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                    <Link
                      href={portal.dashboardUrl}
                      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Dashboard &rarr;
                    </Link>
                    <a
                      href={portal.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                    >
                      Visit Site &#8599;
                    </a>
                    <Link
                      href={portal.settingsUrl}
                      className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      Settings
                    </Link>
                    {isSuperAdmin && portal.adminUrl && (
                      <Link
                        href={portal.adminUrl}
                        className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Admin
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}

            {showCreateCard && (
              <Link
                href="/start"
                className="flex min-h-[168px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-center transition hover:border-primary/60 hover:bg-muted/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  +
                </span>
                <span className="mt-3 text-sm font-semibold text-foreground">
                  Launch New Portal
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Claim a handle and generate your site in 60 seconds
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
