'use client'

import React, { useCallback, useRef, useState } from 'react'

export interface PortalInfo {
  id: number | string
  name: string
  slug: string
  domain: string
  logoUrl: string | null
  primaryColor: string | null
  /** true = a personal guardian-angel portal; false/undefined = an endeavor/business. */
  isGuardianAngel?: boolean
}

/**
 * Portal/tenant switcher — shows a dropdown of tenants the user can navigate to.
 * Used in both the Dashboard sidebar and the public Header.
 * Navigates via subdomain: {slug}.{baseDomain}/dashboard
 */
interface EditTarget {
  adminUrl: string
  label: string
}

export function PortalSwitcher({
  portals,
  currentTenantId,
  compact = false,
  targetPath,
  showEditLink = false,
  inline = false,
}: {
  portals: PortalInfo[]
  currentTenantId?: number | string
  /** Compact mode for header (just icon + dropdown) */
  compact?: boolean
  /** Path to navigate to on switch (default: /dashboard) */
  targetPath?: string
  /**
   * When true, the menu lazily resolves the current public page to its Payload
   * admin editor and surfaces an "Edit this page" link (for logged-in editors).
   * Resolution runs the first time the menu opens — zero cost until then.
   */
  showEditLink?: boolean
  /**
   * Render the LIST only, with no trigger and no absolute panel — for nesting
   * inside another menu (the account dropdown). A dropdown inside a dropdown
   * fights over click-outside and gets clipped by the parent's overflow; this
   * sidesteps both.
   */
  inline?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState('')
  // Most-recently-switched portal ids (localStorage), newest first — floats your
  // frequent portals to the top of a long list.
  const [recents, setRecents] = useState<string[]>([])
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('angelos.portalRecents')
      if (raw) setRecents(JSON.parse(raw) as string[])
    } catch {
      /* ignore */
    }
  }, [])

  // Lazy "Edit this page" resolution — fires the first time the menu opens, or
  // immediately when rendered INLINE inside another menu, where `open` never
  // becomes true. Missing that condition silently dropped "Edit this Page" from
  // the account menu, which is the one control Ken called critical.
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editResolved, setEditResolved] = useState(false)
  React.useEffect(() => {
    if ((!open && !inline) || !showEditLink || editResolved) return
    setEditResolved(true)
    const path = window.location.pathname
    const tid = currentTenantId != null ? `&tenantId=${encodeURIComponent(String(currentTenantId))}` : ''
    fetch(`/api/edit-ops/resolve?path=${encodeURIComponent(path)}${tid}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.editable && d.adminUrl) setEditTarget({ adminUrl: d.adminUrl, label: d.label || 'Edit this page' })
      })
      .catch(() => {})
  }, [open, inline, showEditLink, editResolved, currentTenantId])

  // Close on click outside
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSwitch = useCallback(
    (portal: PortalInfo) => {
      setOpen(false)
      const protocol = window.location.protocol
      const currentHost = window.location.hostname
      const localeMatch = window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)
      const localePrefix = localeMatch ? `/${localeMatch[1]}` : ''
      // Preserve the current DASHBOARD sub-page across the switch so you land on
      // the same view on the other portal (e.g. /dashboard/spaces → the new
      // portal's /dashboard/spaces), not the dashboard root. Dashboard routes are
      // structural (they exist on every portal), so this is safe cross-domain;
      // public/content paths (tenant-specific slugs) are NOT carried — they may
      // 404 on the target — so we fall back to targetPath/dashboard for those.
      // Query string is dropped on purpose: it often holds tenant-scoped ids.
      const rawPath = window.location.pathname
      const pathNoLocale = localePrefix && rawPath.startsWith(localePrefix)
        ? rawPath.slice(localePrefix.length) || '/'
        : rawPath
      const path = pathNoLocale.startsWith('/dashboard')
        ? pathNoLocale
        : (targetPath || '/dashboard')
      // On a real host, navigate to the portal's explicit canonical domain — the
      // {slug}.{base} construction doubled the host for a tenant whose slug equals
      // the base subdomain (slug "kendev" on *.kendev.co → kendev.kendev.co). On
      // localhost keep the slug construction (+ dev port) so dev stays local.
      const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1' || !currentHost.includes('.')
      // A stored domain seeded in local dev is `<slug>.angelos.local` (see
      // seed/use-case-tenants.ts DOMAIN_SUFFIX). On a real host that is a dead
      // link — IGNORE non-public domains and fall back to constructing
      // `{slug}.{currentBase}`, which yields the right real domain (the chooser
      // only ever runs on a real public host). Self-heals bad seed data on any DB.
      const domain = portal.domain?.trim()
      const isPublicDomain = !!domain && !domain.endsWith('.local') && !domain.includes('localhost')
      let tenantHost: string
      let portSuffix: string
      if (!isLocalHost && isPublicDomain) {
        tenantHost = domain!
        portSuffix = '' // a real external domain uses its own default port
      } else {
        const hostParts = currentHost.split('.')
        const baseDomain = hostParts.length >= 3 ? hostParts.slice(1).join('.') : currentHost
        tenantHost = `${portal.slug}.${baseDomain}`
        portSuffix = window.location.port ? `:${window.location.port}` : ''
      }
      // Remember this switch so it floats to the top next time (most-recent).
      try {
        const next = [String(portal.id), ...recents.filter((id) => id !== String(portal.id))].slice(0, 20)
        window.localStorage.setItem('angelos.portalRecents', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      window.location.href = `${protocol}//${tenantHost}${portSuffix}${localePrefix}${path}`
    },
    [targetPath, recents],
  )

  // Sorted (current → recent → rest) + name/slug filtered.
  const displayedPortals = React.useMemo(() => {
    const rank = (id: number | string) => {
      if (String(id) === String(currentTenantId)) return -1
      const i = recents.indexOf(String(id))
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    const sorted = [...portals].sort((a, b) => rank(a.id) - rank(b.id))
    const q = filter.trim().toLowerCase()
    return q
      ? sorted.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      : sorted
  }, [portals, recents, currentTenantId, filter])

  // Render when there are portals to switch between, OR when an editor could get
  // an "Edit this page" link here (resolved lazily on open).
  if (portals.length < 2 && !showEditLink) return null

  const currentPortal = portals.find((p) => String(p.id) === String(currentTenantId))
  const hasPortalList = portals.length >= 2

  // Group: personal guardian angel(s) vs endeavors/businesses.
  const guardianPortals = displayedPortals.filter((p) => p.isGuardianAngel)
  const endeavorPortals = displayedPortals.filter((p) => !p.isGuardianAngel)

  const renderPortalRow = (p: PortalInfo) => (
    <button
      key={String(p.id)}
      onClick={() => handleSwitch(p)}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
        String(p.id) === String(currentTenantId)
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {p.logoUrl ? (
        <img src={p.logoUrl} alt={p.name} className="h-5 w-5 shrink-0 rounded object-cover" />
      ) : (
        <PortalAvatar name={p.name} color={p.primaryColor} />
      )}
      <span className="truncate">{p.name}</span>
      {String(p.id) === String(currentTenantId) && (
        <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )

  return (
    <div className={inline ? '' : 'relative'} ref={ref}>
      {!inline && (
      <button
        onClick={() => setOpen(!open)}
        className={
          compact
            ? 'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            : 'flex w-full items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50'
        }
        title="Switch portal"
      >
        {currentPortal?.logoUrl ? (
          <img src={currentPortal.logoUrl} alt={currentPortal.name} className="h-5 w-5 shrink-0 rounded object-cover" />
        ) : (
          <PortalAvatar name={currentPortal?.name || 'Portal'} color={currentPortal?.primaryColor} />
        )}
        {!compact && (
          <>
            <span className="flex-1 truncate text-left text-sm font-semibold">
              {currentPortal?.name || 'Switch Portal'}
            </span>
            <ChevronIcon open={open} />
          </>
        )}
        {compact && (
          <>
            {/* Show the current portal name so the switcher is discoverable as
                "you're in X — click to switch" (hidden on narrow screens). */}
            <span className="hidden max-w-[140px] truncate text-left text-sm font-medium lg:inline">
              {currentPortal?.name || 'Switch portal'}
            </span>
            <ChevronIcon open={open} />
          </>
        )}
      </button>
      )}

      {(open || inline) && (
        <div
          className={
            inline
              ? 'w-full py-1'
              : `absolute ${compact ? 'right-0' : 'left-0'} top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background py-1 shadow-lg`
          }
        >
          {/* Editor shortcut: jump straight to this page's Payload editor. */}
          {editTarget && (
            <>
              <a
                href={editTarget.adminUrl}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="truncate">{editTarget.label}</span>
              </a>
              {hasPortalList && <div className="my-1 border-t border-border" />}
            </>
          )}
          {hasPortalList && (
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Switch portal
          </div>
          )}
          {/* Filter — shown once the list is long enough to warrant it. */}
          {hasPortalList && portals.length > 6 && (
            <div className="px-2 pb-1">
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter portals…"
                className="w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          )}
          {hasPortalList && displayedPortals.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No portals match “{filter}”.</div>
          )}
          {hasPortalList && guardianPortals.length > 0 && (
            <>
              <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {guardianPortals.length === 1 ? 'Your guardian angel' : 'Guardian angels'}
              </div>
              {guardianPortals.map(renderPortalRow)}
            </>
          )}
          {hasPortalList && endeavorPortals.length > 0 && (
            <>
              <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Endeavors
              </div>
              {endeavorPortals.map(renderPortalRow)}
            </>
          )}
          {/* Single-portal editor whose current page has no editor — keep the
              menu from rendering empty. */}
          {!hasPortalList && !editTarget && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {showEditLink && !editResolved ? 'Checking…' : 'No editor for this page'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PortalAvatar({ name, color }: { name: string; color?: string | null }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground"
      style={color ? { backgroundColor: color } : undefined}
    >
      {name[0]?.toUpperCase() || '?'}
    </span>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
