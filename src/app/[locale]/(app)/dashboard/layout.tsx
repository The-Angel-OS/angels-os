import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'

/**
 * Dashboard layout – Rev 2 categorized sidebar with role-gated sections.
 *
 * Role visibility:
 *  - Everyone (logged in): OVERVIEW (Dashboard, LEO), COMMUNICATION
 *  - admin/super_admin/archangel: + BUSINESS OPS, PRODUCTIVITY, CONTENT, ADMIN
 *  - customer: minimal nav (overview + communication only)
 *
 * Links to Payload admin for collections that don't have custom dashboard pages yet.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`

  // Server-side auth: extract user roles for dynamic nav
  let isAdmin = false
  let isBusinessOwner = false
  let userName = ''
  let userInitials = ''

  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      const roles = (user as any).roles as string[] | undefined
      isAdmin = Boolean(
        roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
      )
      // Business owners = anyone who isn't just a customer
      isBusinessOwner = isAdmin || Boolean(roles?.some((r: string) => r !== 'customer'))
      userName = (user as any).name || (user as any).email || ''
      userInitials = userName
        .split(/[\s@]/)
        .filter(Boolean)
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    }
  } catch {
    // Not authenticated
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* ─── Categorized Sidebar ─── */}
        <aside className="flex h-screen w-60 flex-col border-r border-border bg-muted/30">
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {/* OVERVIEW – visible to all */}
            <NavSection label="OVERVIEW">
              <NavLink href={`${prefix}/dashboard`} icon={<GridIcon />}>
                Dashboard
              </NavLink>
              {isAdmin && (
                <NavLink href={`${prefix}/admin`} icon={<GearIcon />}>
                  Payload Admin
                </NavLink>
              )}
              <NavLink
                href={`${prefix}/dashboard`}
                icon={<StarIcon />}
                badge="Core"
                badgeColor="bg-emerald-600"
              >
                Angel OS
              </NavLink>
              <NavLink
                href={`${prefix}/dashboard/leo`}
                icon={<MonitorIcon />}
                badge="Active"
                badgeColor="bg-blue-600"
              >
                LEO Assistant
              </NavLink>
            </NavSection>

            {/* BUSINESS OPERATIONS – admin & business owners */}
            {isBusinessOwner && (
              <NavSection label="BUSINESS OPS">
                <NavLink href={`${prefix}/shop`} icon={<CubeIcon />}>
                  Products
                </NavLink>
                <NavLink href={`${prefix}/admin/collections/orders`} icon={<ClipboardIcon />}>
                  Orders
                </NavLink>
                <NavLink href={`${prefix}/admin/collections/bookings`} icon={<CalendarIcon />}>
                  Bookings
                </NavLink>
              </NavSection>
            )}

            {/* COMMUNICATION – visible to all */}
            <NavSection label="COMMUNICATION">
              <NavLink href={`${prefix}/dashboard/spaces`} icon={<MailIcon />}>
                Messages
              </NavLink>
            </NavSection>

            {/* PRODUCTIVITY – admin & business owners */}
            {isBusinessOwner && (
              <NavSection label="PRODUCTIVITY">
                <NavLink href={`${prefix}/admin/collections/projects`} icon={<FolderIcon />}>
                  Projects
                </NavLink>
                <NavLink href={`${prefix}/admin/collections/availability`} icon={<ClockIcon />}>
                  Availability
                </NavLink>
              </NavSection>
            )}

            {/* CONTENT – admin & business owners */}
            {isBusinessOwner && (
              <NavSection label="CONTENT">
                <NavLink href={`${prefix}/admin/collections/pages`} icon={<FileIcon />}>
                  Pages
                </NavLink>
                <NavLink href={`${prefix}/posts`} icon={<ArticleIcon />}>
                  Posts
                </NavLink>
                <NavLink href={`${prefix}/admin/collections/media`} icon={<ImageIcon />}>
                  Media
                </NavLink>
                <NavLink href={`${prefix}/admin/collections/categories`} icon={<TagIcon />}>
                  Categories
                </NavLink>
              </NavSection>
            )}

            {/* ADMIN – super_admin / admin / archangel only */}
            {isAdmin && (
              <NavSection label="ADMIN">
                <NavLink
                  href={`${prefix}/dashboard/admin`}
                  icon={<ShieldIcon />}
                  className="text-emerald-600 dark:text-emerald-400"
                >
                  Tenant Admin
                </NavLink>
                <NavLink href={`${prefix}/dashboard/admin/provision`} icon={<PlusIcon />}>
                  Provision
                </NavLink>
                <NavLink href={`${prefix}/dashboard/admin/suitcase`} icon={<PackageIcon />}>
                  Suitcase
                </NavLink>
              </NavSection>
            )}
          </div>

          {/* User footer with initials avatar */}
          {userName && (
            <div className="border-t border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {userInitials}
                </div>
                <span className="truncate text-sm">{userName}</span>
              </div>
            </div>
          )}
        </aside>

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

// ─── Sidebar sub-components ──────────────────────────────────────

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function NavLink({
  href,
  icon,
  children,
  badge,
  badgeColor,
  className,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  badge?: string
  badgeColor?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${className || ''}`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {badge && (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${badgeColor || 'bg-muted'}`}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

// ─── Inline SVG Icons (no external dependencies) ─────────────────

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

function StarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function MonitorIcon() {
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

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

function TagIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
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
