'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * DashboardSidebar — Rev 3 collapsible sidebar with categorized navigation.
 *
 * Inspired by v0.dev angel-os dashboard but adapted for angels-os (Payload CMS).
 * Client component for interactivity (collapse toggle, active state tracking).
 */

interface DashboardSidebarProps {
  prefix: string
  isAdmin: boolean
  isBusinessOwner: boolean
  userName: string
  userEmail: string
  userInitials: string
}

export function DashboardSidebar({
  prefix,
  isAdmin,
  isBusinessOwner,
  userName,
  userEmail,
  userInitials,
}: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname() || ''

  return (
    <aside
      className={`flex h-screen flex-col border-r border-border bg-muted/30 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        {!isCollapsed && (
          <Link href={`${prefix}/dashboard`} className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              A
            </span>
            <span className="text-sm font-semibold">Angel OS</span>
          </Link>
        )}
        {isCollapsed && (
          <Link href={`${prefix}/dashboard`} className="mx-auto">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              A
            </span>
          </Link>
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
          <NavLink href={`${prefix}/dashboard`} icon={<GridIcon />} collapsed={isCollapsed} active={pathname === `${prefix}/dashboard` || pathname === '/dashboard'}>
            Dashboard
          </NavLink>
          {isAdmin && (
            <NavLink href={`${prefix}/admin`} icon={<GearIcon />} collapsed={isCollapsed} active={false}>
              Payload Admin
            </NavLink>
          )}
          <NavLink
            href={`${prefix}/dashboard/leo`}
            icon={<BotIcon />}
            collapsed={isCollapsed}
            active={pathname.includes('/dashboard/leo')}
            badge="Active"
            badgeColor="bg-blue-600"
          >
            LEO Assistant
          </NavLink>
        </NavSection>

        {/* BUSINESS OPERATIONS */}
        {isBusinessOwner && (
          <NavSection label="BUSINESS OPS" collapsed={isCollapsed}>
            <NavLink href={`${prefix}/shop`} icon={<CubeIcon />} collapsed={isCollapsed} active={false}>
              Products
            </NavLink>
            <NavLink href={`${prefix}/admin/collections/orders`} icon={<ClipboardIcon />} collapsed={isCollapsed} active={false}>
              Orders
            </NavLink>
            <NavLink href={`${prefix}/admin/collections/bookings`} icon={<CalendarIcon />} collapsed={isCollapsed} active={false}>
              Bookings
            </NavLink>
          </NavSection>
        )}

        {/* COMMUNICATION – visible to all */}
        <NavSection label="COMMUNICATION" collapsed={isCollapsed}>
          <NavLink
            href={`${prefix}/dashboard/spaces`}
            icon={<SpacesIcon />}
            collapsed={isCollapsed}
            active={pathname.includes('/dashboard/spaces')}
          >
            Spaces
          </NavLink>
        </NavSection>

        {/* PRODUCTIVITY */}
        {isBusinessOwner && (
          <NavSection label="PRODUCTIVITY" collapsed={isCollapsed}>
            <NavLink href={`${prefix}/admin/collections/projects`} icon={<FolderIcon />} collapsed={isCollapsed} active={false}>
              Projects
            </NavLink>
            <NavLink href={`${prefix}/admin/collections/availability`} icon={<ClockIcon />} collapsed={isCollapsed} active={false}>
              Availability
            </NavLink>
          </NavSection>
        )}

        {/* CONTENT */}
        {isBusinessOwner && (
          <NavSection label="CONTENT" collapsed={isCollapsed}>
            <NavLink href={`${prefix}/admin/collections/pages`} icon={<FileIcon />} collapsed={isCollapsed} active={false}>
              Pages
            </NavLink>
            <NavLink href={`${prefix}/posts`} icon={<ArticleIcon />} collapsed={isCollapsed} active={false}>
              Posts
            </NavLink>
            <NavLink href={`${prefix}/admin/collections/media`} icon={<ImageIcon />} collapsed={isCollapsed} active={false}>
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
