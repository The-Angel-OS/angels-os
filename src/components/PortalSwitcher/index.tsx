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
export function PortalSwitcher({
  portals,
  currentTenantId,
  compact = false,
  targetPath,
}: {
  portals: PortalInfo[]
  currentTenantId?: number | string
  /** Compact mode for header (just icon + dropdown) */
  compact?: boolean
  /** Path to navigate to on switch (default: /dashboard) */
  targetPath?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
      const port = window.location.port ? `:${window.location.port}` : ''
      const currentHost = window.location.hostname
      const hostParts = currentHost.split('.')
      const baseDomain = hostParts.length >= 3 ? hostParts.slice(1).join('.') : currentHost
      const tenantHost = `${portal.slug}.${baseDomain}`
      const localeMatch = window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)
      const localePrefix = localeMatch ? `/${localeMatch[1]}` : ''
      const path = targetPath || '/dashboard'
      window.location.href = `${protocol}//${tenantHost}${port}${localePrefix}${path}`
    },
    [targetPath],
  )

  if (portals.length < 2) return null

  const currentPortal = portals.find((p) => String(p.id) === String(currentTenantId))

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
        {compact && <ChevronIcon open={open} />}
      </button>

      {open && (
        <div className={`absolute ${compact ? 'right-0' : 'left-0'} top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background py-1 shadow-lg`}>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Switch portal
          </div>
          {portals.map((p) => (
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
