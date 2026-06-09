'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/utilities/useMediaQuery'
import { useClickOutside } from '@/hooks/useClickOutside'
import { Backdrop } from '@/components/Backdrop'
import { useDashboard } from '@/providers/DashboardContext'
import { NAV_SECTIONS } from './nav-config'
import type { NavVisibilityContext, NavSectionConfig, NavItemConfig } from './nav-config'
import { NAV_ICONS } from './nav-icons'

/**
 * DashboardSidebar — Rev 5, data-driven.
 *
 * Desktop: collapsible sidebar (w-60 / w-16) pinned to left.
 * Mobile: hidden by default, opens as full-screen overlay via hamburger button.
 *
 * Single NavContent component renders both mobile and desktop — no duplication.
 */

interface TenantBranding {
  siteName: string
  logoUrl: string | null
  primaryColor: string | null
}

interface TenantInfo {
  id: number | string
  name: string
  slug: string
  domain: string
  logoUrl: string | null
  primaryColor: string | null
}

interface DashboardSidebarProps {
  prefix: string
  isAdmin: boolean
  isBusinessOwner: boolean
  isAuthenticated?: boolean
  userName: string
  userEmail: string
  userInitials: string
  tenantBranding?: TenantBranding | null
  userTenants?: TenantInfo[]
  currentTenantId?: number | string
  wizardComplete?: boolean
}

export function DashboardSidebar({
  prefix,
  isAdmin: isAdminProp,
  isBusinessOwner: isBusinessOwnerProp,
  isAuthenticated = true,
  userName,
  userEmail,
  userInitials,
  tenantBranding,
  userTenants,
  currentTenantId,
  wizardComplete = true,
}: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const isMobile = useIsMobile()
  const pathname = usePathname() || ''

  // Read role state from context (always available — DashboardProvider wraps this)
  const dashboard = useDashboard()
  const isAdmin = dashboard.isAdmin || isAdminProp
  const isBusinessOwner = dashboard.isBusinessOwner || isBusinessOwnerProp

  // Build visibility context for nav items
  const visCtx: NavVisibilityContext = useMemo(
    () => ({
      isAuthenticated,
      isAdmin,
      isBusinessOwner,
      wizardComplete,
      permissions: dashboard.userRole?.tenantPermissions || [],
      tenantRole: dashboard.userRole?.tenantRole || null,
    }),
    [isAuthenticated, isAdmin, isBusinessOwner, wizardComplete, dashboard.userRole],
  )

  // ─── Collapsible section state ──────────────────────────────────
  // Sections default to open. Collapsible sections can be toggled.
  // The section containing the active route auto-expands.
  const [sectionState, setSectionState] = useState<Record<string, boolean>>({})

  const toggleSection = useCallback((key: string) => {
    setSectionState((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Auto-expand section containing current route (only on navigation)
  useEffect(() => {
    for (const section of NAV_SECTIONS) {
      if (section.collapsible) {
        const hasActiveItem = section.items.some((item) => item.isActive(pathname, prefix))
        if (hasActiveItem) {
          setSectionState((prev) => {
            if (prev[section.key] === false) return { ...prev, [section.key]: true }
            return prev
          })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on navigation
  }, [pathname, prefix])

  // Close mobile nav on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isMobile, isMobileOpen])

  // ─── Mobile layout ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-background border border-border shadow-sm active:bg-muted md:hidden"
          aria-label="Open navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Backdrop isOpen={isMobileOpen} onClick={() => setIsMobileOpen(false)} zIndex="z-50" opacity="bg-black/40" />

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
        >
          {/* Logo / Brand — with close button */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
            {userTenants && userTenants.length > 1 ? (
              <TenantChooser tenants={userTenants} currentTenantId={currentTenantId} branding={tenantBranding} collapsed={false} />
            ) : (
              <Link href={`${prefix}/dashboard`} className="flex items-center gap-2">
                <TenantLogo branding={tenantBranding} />
                <span className="text-sm font-semibold truncate">{tenantBranding?.siteName || 'Angel OS'}</span>
              </Link>
            )}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close navigation"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Shared nav content — always expanded on mobile */}
          <NavContent
            prefix={prefix}
            pathname={pathname}
            collapsed={false}
            visCtx={visCtx}
            sectionState={sectionState}
            onToggleSection={toggleSection}
          />

          {/* User footer */}
          {userName && (
            <Link
              href={`${prefix}/dashboard/account`}
              className="block shrink-0 border-t border-border px-3 py-3 transition-colors hover:bg-muted/50"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </div>
            </Link>
          )}
        </aside>
      </>
    )
  }

  // ─── Desktop layout ─────────────────────────────────────────────
  return (
    <aside
      className={`flex h-screen flex-col border-r border-border bg-muted/30 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / Brand — Tenant Chooser */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        {!isCollapsed ? (
          userTenants && userTenants.length > 1 ? (
            <TenantChooser tenants={userTenants} currentTenantId={currentTenantId} branding={tenantBranding} collapsed={false} />
          ) : (
            <Link href={`${prefix}/dashboard`} className="flex items-center gap-2 min-w-0">
              <TenantLogo branding={tenantBranding} />
              <span className="text-sm font-semibold truncate">{tenantBranding?.siteName || 'Angel OS'}</span>
            </Link>
          )
        ) : (
          userTenants && userTenants.length > 1 ? (
            <TenantChooser tenants={userTenants} currentTenantId={currentTenantId} branding={tenantBranding} collapsed={true} />
          ) : (
            <Link href={`${prefix}/dashboard`} className="mx-auto">
              <TenantLogo branding={tenantBranding} />
            </Link>
          )
        )}
        {/* Collapse toggle moved to the bottom-left row below — keeping it here
            put it under the TenantChooser's z-50 dropdown in full-screen, making
            it unclickable. */}
      </div>

      {/* Shared nav content */}
      <NavContent
        prefix={prefix}
        pathname={pathname}
        collapsed={isCollapsed}
        visCtx={visCtx}
        sectionState={sectionState}
        onToggleSection={toggleSection}
      />

      {/* Collapse toggle — bottom-left, clear of the TenantChooser dropdown */}
      <div className="shrink-0 border-t border-border px-2 py-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex h-7 items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
            isCollapsed ? 'w-full justify-center' : 'w-full'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            )}
          </svg>
          {!isCollapsed && <span className="text-xs font-medium">Collapse</span>}
        </button>
      </div>

      {/* User footer */}
      {userName && (
        <Link
          href={`${prefix}/dashboard/account`}
          className="block shrink-0 border-t border-border px-2 py-3 transition-colors hover:bg-muted/50"
          title="Account settings"
        >
          <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
              {userInitials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
            )}
          </div>
        </Link>
      )}
    </aside>
  )
}

// ─── NavContent — single renderer for mobile + desktop ──────────

function NavContent({
  prefix,
  pathname,
  collapsed,
  visCtx,
  sectionState,
  onToggleSection,
}: {
  prefix: string
  pathname: string
  collapsed: boolean
  visCtx: NavVisibilityContext
  sectionState: Record<string, boolean>
  onToggleSection: (key: string) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      {NAV_SECTIONS.filter((s) => s.visible(visCtx)).map((section) => {
        const visibleItems = section.items.filter((item) => item.visible(visCtx))
        if (visibleItems.length === 0) return null

        const isOpen = sectionState[section.key] !== false // default open

        return (
          <NavSection
            key={section.key}
            label={section.label}
            collapsed={collapsed}
            collapsible={section.collapsible}
            isOpen={isOpen}
            onToggle={() => onToggleSection(section.key)}
          >
            {visibleItems.map((item) => {
              const IconComponent = NAV_ICONS[item.icon]
              return (
                <NavLink
                  key={item.key}
                  href={item.href(prefix)}
                  icon={IconComponent ? <IconComponent /> : null}
                  collapsed={collapsed}
                  active={item.isActive(pathname, prefix)}
                  badge={!collapsed ? item.badge?.text : undefined}
                  badgeColor={item.badge?.color}
                  className={item.className}
                >
                  {item.label}
                </NavLink>
              )
            })}
          </NavSection>
        )
      })}
    </div>
  )
}

// ─── NavSection ──────────────────────────────────────────────────

function NavSection({
  label,
  collapsed,
  collapsible,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  collapsed: boolean
  collapsible: boolean
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      {!collapsed && (
        collapsible ? (
          <button
            onClick={onToggle}
            className="mb-1 flex w-full items-center px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex-1 text-left">{label}</span>
            <svg
              className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        )
      )}
      {collapsed && <div className="mb-1 mx-auto h-px w-8 bg-border" />}
      {(isOpen || !collapsible) && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

// ─── NavLink ─────────────────────────────────────────────────────

function NavLink({
  href,
  icon,
  children,
  collapsed,
  active,
  badge,
  badgeColor,
  className = '',
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  collapsed: boolean
  active: boolean
  badge?: string
  badgeColor?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      } ${collapsed ? 'justify-center px-1.5' : ''} ${className}`}
      title={collapsed ? String(children) : undefined}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{children}</span>
          {badge && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${badgeColor || 'bg-muted'}`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

// ─── Tenant Chooser ─────────────────────────────────────────────

function TenantChooser({
  tenants,
  currentTenantId,
  branding,
  collapsed,
}: {
  tenants: TenantInfo[]
  currentTenantId?: number | string
  branding?: TenantBranding | null
  collapsed: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeDropdown = useCallback(() => setOpen(false), [])
  useClickOutside(ref, closeDropdown, open)

  const handleSwitch = (tenant: TenantInfo) => {
    setOpen(false)
    const protocol = window.location.protocol
    const port = window.location.port ? `:${window.location.port}` : ''
    const currentHost = window.location.hostname
    const hostParts = currentHost.split('.')
    const baseDomain = hostParts.length >= 3 ? hostParts.slice(1).join('.') : currentHost
    const tenantHost = `${tenant.slug}.${baseDomain}`
    const localeMatch = window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)
    const localePrefix = localeMatch ? `/${localeMatch[1]}` : ''
    window.location.href = `${protocol}//${tenantHost}${port}${localePrefix}/dashboard`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50"
      >
        <TenantLogo branding={branding} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left text-sm font-semibold">
              {branding?.siteName || 'Angel OS'}
            </span>
            <svg
              className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background py-1 shadow-lg">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Switch tenant
          </div>
          {tenants.map((t) => (
            <button
              key={String(t.id)}
              onClick={() => handleSwitch(t)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                String(t.id) === String(currentTenantId)
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t.logoUrl ? (
                <img src={t.logoUrl} alt={t.name} className="h-5 w-5 shrink-0 rounded object-cover" />
              ) : (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground"
                  style={t.primaryColor ? { backgroundColor: t.primaryColor } : undefined}
                >
                  {t.name[0]?.toUpperCase() || '?'}
                </span>
              )}
              <span className="truncate">{t.name}</span>
              {String(t.id) === String(currentTenantId) && (
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

// ─── Tenant Logo ────────────────────────────────────────────────

function TenantLogo({ branding }: { branding?: TenantBranding | null }) {
  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.siteName}
        className="h-7 w-7 shrink-0 rounded-md object-cover"
      />
    )
  }

  const initial = (branding?.siteName || 'A')[0].toUpperCase()

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
      style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}
    >
      {initial}
    </span>
  )
}
