'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/utilities/useMediaQuery'
import { useClickOutside } from '@/hooks/useClickOutside'
import { Backdrop } from '@/components/Backdrop'

/**
 * DashboardSidebar — Rev 4 responsive sidebar with categorized navigation.
 *
 * Desktop: collapsible sidebar (w-60 / w-16) pinned to left.
 * Mobile: hidden by default, opens as full-screen overlay via hamburger button.
 *
 * Client component for interactivity (collapse toggle, active state tracking).
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
  userName: string
  userEmail: string
  userInitials: string
  tenantBranding?: TenantBranding | null
  userTenants?: TenantInfo[]
  currentTenantId?: number | string
  /** When false, shows "Diocese Setup" nav link in OVERVIEW. Hidden once wizard completes. */
  wizardComplete?: boolean
}

export function DashboardSidebar({
  prefix,
  isAdmin,
  isBusinessOwner,
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

  // On mobile, render nothing in the flow — the overlay is position:fixed
  // The hamburger button is rendered by the dashboard layout header
  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button — positioned in the header area */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-background border border-border shadow-sm active:bg-muted md:hidden"
          aria-label="Open navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Backdrop */}
        <Backdrop isOpen={isMobileOpen} onClick={() => setIsMobileOpen(false)} zIndex="z-50" opacity="bg-black/40" />

        {/* Sidebar overlay */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
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

          {/* Navigation — always expanded on mobile overlay */}
          <MobileNavContent
            prefix={prefix}
            isAdmin={isAdmin}
            isBusinessOwner={isBusinessOwner}
            pathname={pathname}
            wizardComplete={wizardComplete}
          />

          {/* User footer */}
          {userName && (
            <div className="shrink-0 border-t border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </>
    )
  }

  // ─── Desktop sidebar ───
  return (
    <aside
      className={`flex h-screen flex-col border-r border-border bg-muted/30 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / Brand — Tenant Branding / Tenant Chooser */}
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
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
            isCollapsed ? 'mx-auto mt-1' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {/* OVERVIEW – visible to all */}
        <NavSection label="OVERVIEW" collapsed={isCollapsed}>
          <NavLink href={`${prefix}/`} icon={<HomeIcon />} collapsed={isCollapsed} active={false}>
            Home
          </NavLink>
          <NavLink href={`${prefix}/dashboard`} icon={<GridIcon />} collapsed={isCollapsed} active={pathname === `${prefix}/dashboard` || pathname === '/dashboard'}>
            Dashboard
          </NavLink>
          {isAdmin && (
            <NavLink href={`${prefix}/admin`} icon={<GearIcon />} collapsed={isCollapsed} active={false}>
              Payload Admin
            </NavLink>
          )}
          <NavLink
            href={`${prefix}/dashboard/spaces`}
            icon={<BotIcon />}
            collapsed={isCollapsed}
            active={pathname.includes('/dashboard/spaces')}
          >
            Spaces
          </NavLink>
          <NavLink
            href={`${prefix}/dashboard/docs`}
            icon={<BookOpenIcon />}
            collapsed={isCollapsed}
            active={pathname.includes('/dashboard/docs')}
          >
            Documentation
          </NavLink>
          {!wizardComplete && (
            <NavLink
              href={`${prefix}/dashboard/setup`}
              icon={<WandIcon />}
              collapsed={isCollapsed}
              active={pathname.includes('/dashboard/setup')}
              badge={!isCollapsed ? 'Setup' : undefined}
              badgeColor="bg-primary"
            >
              Diocese Setup
            </NavLink>
          )}
        </NavSection>

        {/* BUSINESS OPERATIONS */}
        {isBusinessOwner && (
          <NavSection label="BUSINESS OPS" collapsed={isCollapsed}>
            <NavLink href={`${prefix}/dashboard/products`} icon={<CubeIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/products')}>
              Products
            </NavLink>
            <NavLink href={`${prefix}/dashboard/orders`} icon={<ClipboardIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/orders')}>
              Orders
            </NavLink>
            <NavLink
              href={`${prefix}/dashboard/events`}
              icon={<CalendarEventIcon />}
              collapsed={isCollapsed}
              active={pathname.includes('/dashboard/events')}
            >
              Events
            </NavLink>
            <NavLink
              href={`${prefix}/dashboard/appointments`}
              icon={<CalendarIcon />}
              collapsed={isCollapsed}
              active={pathname.includes('/dashboard/appointments')}
            >
              Appointments
            </NavLink>
            <NavLink
              href={`${prefix}/dashboard/holon`}
              icon={<HolonIcon />}
              collapsed={isCollapsed}
              active={pathname.includes('/dashboard/holon')}
            >
              Holon Node
            </NavLink>
          </NavSection>
        )}

        {/* COMMUNICATION — consolidated into LEO & Spaces in OVERVIEW */}

        {/* PRODUCTIVITY */}
        {isBusinessOwner && (
          <NavSection label="PRODUCTIVITY" collapsed={isCollapsed}>
            <NavLink href={`${prefix}/dashboard/projects`} icon={<FolderIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/projects')}>
              Projects
            </NavLink>
            <NavLink href={`${prefix}/dashboard/availability`} icon={<ClockIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/availability')}>
              Availability
            </NavLink>
          </NavSection>
        )}

        {/* CONTENT */}
        {isBusinessOwner && (
          <NavSection label="CONTENT" collapsed={isCollapsed}>
            <NavLink href={`${prefix}/dashboard/pages`} icon={<FileIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/pages')}>
              Pages
            </NavLink>
            <NavLink href={`${prefix}/dashboard/posts`} icon={<ArticleIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/posts')}>
              Posts
            </NavLink>
            <NavLink href={`${prefix}/dashboard/media`} icon={<ImageIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/media')}>
              Media
            </NavLink>
          </NavSection>
        )}

        {/* ADMIN */}
        {isAdmin && (
          <NavSection label="ADMIN" collapsed={isCollapsed}>
            <NavLink
              href={`${prefix}/dashboard/admin`}
              icon={<ShieldIcon />}
              collapsed={isCollapsed}
              active={pathname.includes('/dashboard/admin')}
              className="text-emerald-600 dark:text-emerald-400"
            >
              Tenant Admin
            </NavLink>
            <NavLink href={`${prefix}/dashboard/admin/provision`} icon={<PlusIcon />} collapsed={isCollapsed} active={false}>
              Provision
            </NavLink>
            <NavLink href={`${prefix}/dashboard/admin/suitcase`} icon={<PackageIcon />} collapsed={isCollapsed} active={false}>
              Suitcase
            </NavLink>
            <NavLink href={`${prefix}/dashboard/admin/payments`} icon={<CreditCardIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/admin/payments')}>
              Payments
            </NavLink>
            <NavLink href={`${prefix}/dashboard/admin/invitations`} icon={<MailIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/admin/invitations')}>
              Invitations
            </NavLink>
            <NavLink href={`${prefix}/dashboard/admin/ai-settings`} icon={<SparkleIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/admin/ai-settings')}>
              AI Settings
            </NavLink>
            <NavLink href={`${prefix}/dashboard/admin/error-logs`} icon={<AlertIcon />} collapsed={isCollapsed} active={pathname.includes('/dashboard/admin/error-logs')}>
              Error Logs
            </NavLink>
          </NavSection>
        )}
      </div>

      {/* User footer */}
      {userName && (
        <div className="shrink-0 border-t border-border px-2 py-3">
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
        </div>
      )}
    </aside>
  )
}

// ─── NavSection ──────────────────────────────────────────────────

function NavSection({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      {!collapsed && (
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      {collapsed && <div className="mb-1 mx-auto h-px w-8 bg-border" />}
      <div className="space-y-0.5">{children}</div>
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

// ─── MobileNavContent — expanded nav items for mobile overlay ────

function MobileNavContent({
  prefix,
  isAdmin,
  isBusinessOwner,
  pathname,
  wizardComplete = true,
}: {
  prefix: string
  isAdmin: boolean
  isBusinessOwner: boolean
  pathname: string
  wizardComplete?: boolean
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      <NavSection label="OVERVIEW" collapsed={false}>
        <NavLink href={`${prefix}/`} icon={<HomeIcon />} collapsed={false} active={false}>
          Home
        </NavLink>
        <NavLink href={`${prefix}/dashboard`} icon={<GridIcon />} collapsed={false} active={pathname === `${prefix}/dashboard` || pathname === '/dashboard'}>
          Dashboard
        </NavLink>
        {isAdmin && (
          <NavLink href={`${prefix}/admin`} icon={<GearIcon />} collapsed={false} active={false}>
            Payload Admin
          </NavLink>
        )}
        <NavLink
          href={`${prefix}/dashboard/spaces`}
          icon={<BotIcon />}
          collapsed={false}
          active={pathname.includes('/dashboard/spaces')}
        >
          Spaces
        </NavLink>
        <NavLink
          href={`${prefix}/dashboard/docs`}
          icon={<BookOpenIcon />}
          collapsed={false}
          active={pathname.includes('/dashboard/docs')}
        >
          Documentation
        </NavLink>
        {!wizardComplete && (
          <NavLink
            href={`${prefix}/dashboard/setup`}
            icon={<WandIcon />}
            collapsed={false}
            active={pathname.includes('/dashboard/setup')}
            badge="Setup"
            badgeColor="bg-primary"
          >
            Diocese Setup
          </NavLink>
        )}
      </NavSection>

      {isBusinessOwner && (
        <NavSection label="BUSINESS OPS" collapsed={false}>
          <NavLink href={`${prefix}/dashboard/products`} icon={<CubeIcon />} collapsed={false} active={pathname.includes('/dashboard/products')}>
            Products
          </NavLink>
          <NavLink href={`${prefix}/dashboard/orders`} icon={<ClipboardIcon />} collapsed={false} active={pathname.includes('/dashboard/orders')}>
            Orders
          </NavLink>
          <NavLink href={`${prefix}/dashboard/events`} icon={<CalendarEventIcon />} collapsed={false} active={pathname.includes('/dashboard/events')}>
            Events
          </NavLink>
          <NavLink href={`${prefix}/dashboard/appointments`} icon={<CalendarIcon />} collapsed={false} active={pathname.includes('/dashboard/appointments')}>
            Appointments
          </NavLink>
          <NavLink href={`${prefix}/dashboard/holon`} icon={<HolonIcon />} collapsed={false} active={pathname.includes('/dashboard/holon')}>
            Holon Node
          </NavLink>
        </NavSection>
      )}

      {/* COMMUNICATION — consolidated into LEO & Spaces in OVERVIEW */}

      {isBusinessOwner && (
        <NavSection label="PRODUCTIVITY" collapsed={false}>
          <NavLink href={`${prefix}/dashboard/projects`} icon={<FolderIcon />} collapsed={false} active={pathname.includes('/dashboard/projects')}>
            Projects
          </NavLink>
          <NavLink href={`${prefix}/dashboard/availability`} icon={<ClockIcon />} collapsed={false} active={pathname.includes('/dashboard/availability')}>
            Availability
          </NavLink>
        </NavSection>
      )}

      {isBusinessOwner && (
        <NavSection label="CONTENT" collapsed={false}>
          <NavLink href={`${prefix}/dashboard/pages`} icon={<FileIcon />} collapsed={false} active={pathname.includes('/dashboard/pages')}>
            Pages
          </NavLink>
          <NavLink href={`${prefix}/dashboard/posts`} icon={<ArticleIcon />} collapsed={false} active={pathname.includes('/dashboard/posts')}>
            Posts
          </NavLink>
          <NavLink href={`${prefix}/dashboard/media`} icon={<ImageIcon />} collapsed={false} active={pathname.includes('/dashboard/media')}>
            Media
          </NavLink>
        </NavSection>
      )}

      {isAdmin && (
        <NavSection label="ADMIN" collapsed={false}>
          <NavLink
            href={`${prefix}/dashboard/admin`}
            icon={<ShieldIcon />}
            collapsed={false}
            active={pathname.includes('/dashboard/admin')}
            className="text-emerald-600 dark:text-emerald-400"
          >
            Tenant Admin
          </NavLink>
          <NavLink href={`${prefix}/dashboard/admin/provision`} icon={<PlusIcon />} collapsed={false} active={false}>
            Provision
          </NavLink>
          <NavLink href={`${prefix}/dashboard/admin/suitcase`} icon={<PackageIcon />} collapsed={false} active={false}>
            Suitcase
          </NavLink>
          <NavLink href={`${prefix}/dashboard/admin/payments`} icon={<CreditCardIcon />} collapsed={false} active={pathname.includes('/dashboard/admin/payments')}>
            Payments
          </NavLink>
          <NavLink href={`${prefix}/dashboard/admin/invitations`} icon={<MailIcon />} collapsed={false} active={pathname.includes('/dashboard/admin/invitations')}>
            Invitations
          </NavLink>
          <NavLink href={`${prefix}/dashboard/admin/ai-settings`} icon={<SparkleIcon />} collapsed={false} active={pathname.includes('/dashboard/admin/ai-settings')}>
            AI Settings
          </NavLink>
          <NavLink href={`${prefix}/dashboard/admin/error-logs`} icon={<AlertIcon />} collapsed={false} active={pathname.includes('/dashboard/admin/error-logs')}>
            Error Logs
          </NavLink>
        </NavSection>
      )}
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function BotIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function CubeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CalendarEventIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11v4m0 0l-2-2m2 2l2-2" />
    </svg>
  )
}

function SpacesIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ArticleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  )
}

function PackageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
}

function HolonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} strokeDasharray="4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v3m0 12v3M3 12h3m12 0h3" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function WandIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 10l2-2m-2 0l-2-2m2 2v4" />
    </svg>
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

    // Derive base domain from current hostname so switching works across
    // all environments without hardcoding (dev, stage, prod, qa, etc.).
    //   angelos.local:3000          → celersoft.angelos.local:3000
    //   spacesangels.com            → celersoft.spacesangels.com
    //   celersoft.spacesangels.com  → lucas-productions.spacesangels.com
    const currentHost = window.location.hostname
    const hostParts = currentHost.split('.')
    // Strip the leading subdomain if we're already on a tenant domain
    const baseDomain = hostParts.length >= 3 ? hostParts.slice(1).join('.') : currentHost
    const tenantHost = `${tenant.slug}.${baseDomain}`

    // Preserve the locale prefix from the current path
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

/** Renders the tenant logo or a branded initial letter */
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
