'use client'

import React, { useCallback, useRef, useState } from 'react'

export interface PortalInfo {
  id: number | string
  name: string
  slug: string
  domain: string
  logoUrl: string | null
  primaryColor: string | null
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
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Lazy "Edit this page" resolution — only fires the first time the menu opens.
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editResolved, setEditResolved] = useState(false)
  React.useEffect(() => {
    if (!open || !showEditLink || editResolved) return
    setEditResolved(true)
    const path = window.location.pathname
    const tid = currentTenantId != null ? `&tenantId=${encodeURIComponent(String(currentTenantId))}` : ''
    fetch(`/api/edit-ops/resolve?path=${encodeURIComponent(path)}${tid}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.editable && d.adminUrl) setEditTarget({ adminUrl: d.adminUrl, label: d.label || 'Edit this page' })
      })
      .catch(() => {})
  }, [open, showEditLink, editResolved, currentTenantId])

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
      const path = targetPath || '/dashboard'
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
      window.location.href = `${protocol}//${tenantHost}${portSuffix}${localePrefix}${path}`
    },
    [targetPath],
  )

  // Render when there are portals to switch between, OR when an editor could get
  // an "Edit this page" link here (resolved lazily on open).
  if (portals.length < 2 && !showEditLink) return null

  const currentPortal = portals.find((p) => String(p.id) === String(currentTenantId))
  const hasPortalList = portals.length >= 2

  return (
    <div className="relative" ref={ref}>
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

      {open && (
        <div className={`absolute ${compact ? 'right-0' : 'left-0'} top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background py-1 shadow-lg`}>
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
          {hasPortalList && portals.map((p) => (
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
          ))}
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
