import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { fetchUserSpaces } from '@/utilities/fetchUserSpaces'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { DashboardSidebar } from './DashboardSidebar'
import { DashboardHeader } from './DashboardHeader'
import { DashboardLEOSidebar } from './DashboardLEOSidebar'
import { checkSetupRequired } from './setup/actions'
import { DashboardProvider } from '@/providers/DashboardContext'
import type { DashboardSpace } from '@/providers/DashboardContext'
import { ChatProvider } from '@/components/ChatControl/ChatProvider'
import type { ChatSpace } from '@/components/ChatControl/types'
import type { Media } from '@/payload-types'
import { LeoNavigationBridge } from './LeoNavigationBridge'
import { TenantCookieSync } from '@/components/TenantCookieSync'

/**
 * Dashboard layout — Rev 5 (tenant branding + space context).
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

  // Resolve tenant (cached, React.cache deduped)
  const { tenant } = await resolveTenantFromHeaders()

  // Server-side: resolve auth + space context
  const headersList = await headers()

  // Serialize tenant branding for sidebar
  const tenantBranding = tenant
    ? {
        siteName: tenant.branding?.siteName || tenant.name || 'Angel OS',
        logoUrl:
          typeof tenant.branding?.logo === 'object' &&
          tenant.branding?.logo !== null &&
          'url' in (tenant.branding.logo as object)
            ? ((tenant.branding.logo as Media).url ?? null)
            : null,
        primaryColor: tenant.branding?.primaryColor || null,
      }
    : null

  // Server-side auth: extract user roles for dynamic nav
  let isAdmin = false
  let isBusinessOwner = false
  let userName = ''
  let userInitials = ''
  let userEmail = ''
  let userId: number | string | undefined

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      userId = user.id
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
    } else {
      redirect(`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/dashboard`)}`)
    }
  } catch {
    // Auth system unavailable — redirect to login
    redirect(`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/dashboard`)}`)
  }

  // Fetch all spaces the user belongs to for dashboard context
  let userSpaces: DashboardSpace[] = []
  let defaultSpaceId: string | undefined
  if (userId && tenant?.id) {
    const serialized = await fetchUserSpaces(userId, tenant.id)
    userSpaces = serialized.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      visibility: s.visibility as DashboardSpace['visibility'],
      isSystem: s.isSystem,
    }))
    defaultSpaceId =
      userSpaces.find((s) => !s.isSystem)?.id ??
      (await fetchDefaultSpaceId(tenant.id)) ??
      undefined
  } else if (tenant?.id) {
    const fallbackId = await fetchDefaultSpaceId(tenant.id)
    defaultSpaceId = fallbackId ?? undefined
  }

  // Fetch user's tenant memberships for tenant chooser
  interface TenantInfo {
    id: number | string
    name: string
    slug: string
    domain: string
    logoUrl: string | null
    primaryColor: string | null
  }
  let userTenants: TenantInfo[] = []

  if (userId) {
    try {
      const payload = await getPayload({ config })
      const memberships = await payload.find({
        collection: 'tenant-memberships',
        where: {
          user: { equals: userId },
          status: { equals: 'active' },
        },
        depth: 2,
        limit: 50,
      })

      userTenants = (memberships.docs || [])
        .map((m: any) => {
          const t = m.tenant
          if (!t || typeof t !== 'object') return null
          return {
            id: t.id,
            name: t.branding?.siteName || t.name || 'Unknown',
            slug: t.slug || '',
            domain: t.domain || '',
            logoUrl:
              typeof t.branding?.logo === 'object' && t.branding?.logo?.url
                ? t.branding.logo.url
                : null,
            primaryColor: t.branding?.primaryColor || null,
          }
        })
        .filter(Boolean) as TenantInfo[]
    } catch {
      // Failed to fetch tenant memberships — non-critical
    }
  }

  // Ensure DM space exists for this tenant (non-blocking, auto-provision)
  let dmSpaceId: string | undefined
  if (tenant?.id) {
    dmSpaceId = await ensureDMSpace(tenant.id)
  }

  // Check if the Leo Wizard is complete — controls "Enterprise Setup" nav link
  const setupRequired = await checkSetupRequired().catch(() => false)
  const wizardComplete = !setupRequired

  // Map DashboardSpace[] to ChatSpace[] for ChatProvider
  const chatSpaces: ChatSpace[] = userSpaces.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    visibility: s.visibility,
    isSystem: s.isSystem,
    enabledApplets: (s as any).enabledApplets,
  }))

  return (
    <DashboardProvider initialSpaces={userSpaces} defaultSpaceId={defaultSpaceId}>
      <ChatProvider
        tenantId={tenant?.id ? String(tenant.id) : ''}
        dmSpaceId={dmSpaceId}
        defaultSpaceId={defaultSpaceId}
        spaces={chatSpaces}
        userId={userId ? String(userId) : ''}
      >
        {/* Sync payload-tenant cookie to current tenant for REST API scoping */}
        {tenant?.id && <TenantCookieSync tenantId={String(tenant.id)} />}
        {/* LEO Navigation Bridge — auto-navigates when LEO tools mutate data */}
        <LeoNavigationBridge />

        <div className="flex h-screen bg-background overflow-hidden">
          {/* ─── Sidebar Navigation (left) ─── */}
          <DashboardSidebar
            prefix={prefix}
            isAdmin={isAdmin}
            isBusinessOwner={isBusinessOwner}
            userName={userName}
            userEmail={userEmail}
            userInitials={userInitials}
            tenantBranding={tenantBranding}
            userTenants={userTenants}
            currentTenantId={tenant?.id}
            wizardComplete={wizardComplete}
          />

          {/* ─── Main Content (center) ─── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Dashboard Header Bar — title + user info */}
            <DashboardHeader prefix={prefix} userName={userName} userInitials={userInitials} />

            {/* Page Content — reduced padding on mobile */}
            <main className="flex-1 overflow-y-auto p-3 md:p-6">{children}</main>
          </div>

          {/* ─── LEO Chat Sidebar (right, toggle) ─── */}
          <DashboardLEOSidebar spaceId={defaultSpaceId} dmSpaceId={dmSpaceId} tenantId={tenant?.id ? String(tenant.id) : undefined} userId={userId ? String(userId) : undefined} />
        </div>
      </ChatProvider>
    </DashboardProvider>
  )
}
