import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { DashboardSidebar } from './DashboardSidebar'
import { DashboardLEOSidebar } from './DashboardLEOSidebar'

/**
 * Dashboard layout — Rev 4 (mobile-responsive).
 *
 * Desktop: full-screen dashboard with collapsible sidebar (left), main content (center),
 *          LEO chat sidebar (right, toggle).
 * Mobile: sidebar becomes hamburger overlay, header has left padding for hamburger button,
 *         content uses reduced padding, LEO sidebar becomes full-screen overlay.
 *
 * NO brochure chrome (no Header, Footer, FloatingBubble).
 * This runs inside (dashboard) route group which provides its own HTML shell.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`

  // Server-side: resolve tenant + default space for LEO sidebar
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const host = headersList.get('host') ?? ''
  const tenant =
    (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
    (await fetchTenantByDomain(host))
  const defaultSpaceId = tenant?.id ? await fetchDefaultSpaceId(tenant.id) : undefined

  // Server-side auth: extract user roles for dynamic nav
  let isAdmin = false
  let isBusinessOwner = false
  let userName = ''
  let userInitials = ''
  let userEmail = ''

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      const roles = (user as any).roles as string[] | undefined
      isAdmin = Boolean(
        roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
      )
      isBusinessOwner = isAdmin || Boolean(roles?.some((r: string) => r !== 'customer'))
      userName = (user as any).name || (user as any).email || ''
      userEmail = (user as any).email || ''
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ─── Sidebar Navigation (left) ─── */}
      <DashboardSidebar
        prefix={prefix}
        isAdmin={isAdmin}
        isBusinessOwner={isBusinessOwner}
        userName={userName}
        userEmail={userEmail}
        userInitials={userInitials}
      />

      {/* ─── Main Content (center) ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Dashboard Header Bar — left padding on mobile for hamburger button */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background pl-14 pr-4 md:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-foreground">Angel OS Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {userName && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {userName}
              </span>
            )}
          </div>
        </header>

        {/* Page Content — reduced padding on mobile */}
        <main className="flex-1 overflow-y-auto p-3 md:p-6">{children}</main>
      </div>

      {/* ─── LEO Chat Sidebar (right, toggle) ─── */}
      <DashboardLEOSidebar spaceId={defaultSpaceId} />
    </div>
  )
}
