import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { fetchUserSpaces } from '@/utilities/fetchUserSpaces'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { DashboardSidebar } from './DashboardSidebar'
import { DashboardHeader } from './DashboardHeader'
import { DashboardLEOSidebar } from './DashboardLEOSidebar'
import { checkSetupRequired } from './setup/actions'
import { DashboardProvider } from '@/providers/DashboardContext'
import type { DashboardSpace, DashboardUserRole } from '@/providers/DashboardContext'
import { ChatProvider } from '@/components/ChatControl/ChatProvider'
import type { ChatSpace } from '@/components/ChatControl/types'
import type { Media } from '@/payload-types'
import { LeoNavigationBridge } from './LeoNavigationBridge'
import { TenantCookieSync } from '@/components/TenantCookieSync'

/**
 * Dashboard layout — Rev 6 (anonymous access + tenant branding + space context).
 *
 * Desktop: full-screen dashboard with collapsible sidebar (left), main content (center),
 *          LEO chat sidebar (right, toggle).
 * Mobile: sidebar becomes hamburger overlay, header has left padding for hamburger button,
 *         content uses reduced padding, LEO sidebar becomes full-screen overlay.
 *
 * NO brochure chrome (no Header, Footer, FloatingBubble).
 * This runs inside (dashboard) route group which provides its own HTML shell.
 *
 * Auth is OPTIONAL — anonymous users can view public dashboard pages
 * (Home, Bridge, CIC, Federation). Auth-gated pages redirect themselves.
 * LEO sidebar is hidden for anonymous users.
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
  // Auth is OPTIONAL — anonymous users see public dashboard pages
  let isAuthenticated = false
  let isAdmin = false
  let isBusinessOwner = false
  let userName = ''
  let userInitials = ''
  let userEmail = ''
  let userId: number | string | undefined
  let platformRoles: string[] = []

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      isAuthenticated = true
      userId = user.id
      platformRoles = ((user as any).roles as string[]) || []
      isAdmin = checkRole(ADMIN_ROLES, user)
      isBusinessOwner = isAdmin || Boolean(platformRoles.some((r: string) => r !== 'customer'))
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
    // No redirect — anonymous users can view public dashboard pages
  } catch {
    // Auth system unavailable — continue as anonymous
  }

  // ── Parallel data fetching ─────────────────────────────────────
  // These queries are independent (only depend on auth result above).
  // Running in parallel saves 3 sequential DB round-trips per dashboard load.
  interface TenantInfo {
    id: number | string
    name: string
    slug: string
    domain: string
    logoUrl: string | null
    primaryColor: string | null
  }

  // super_admins have all-tenant access (userHasAccessToAllTenants is gated to
  // super_admin) — so their chooser is sourced from ALL tenants, not just the
  // tenant-memberships rows. This is what surfaces the Angel OS root/platform
  // portal (which has no membership row) and any tenant the user can reach but
  // hasn't been explicitly enrolled in.
  const isSuperAdmin = platformRoles.includes('super_admin')

  const [spacesResult, membershipsResult, dmResult, setupResult, allTenantsResult] =
    await Promise.allSettled([
      // 1. Fetch user spaces
      userId && tenant?.id
        ? fetchUserSpaces(userId, tenant.id)
        : Promise.resolve(null),
      // 2. Fetch tenant memberships (chooser source for non-super-admins; also
      //    used for current-tenant role/permission context for everyone)
      userId
        ? getPayload({ config }).then((pl) =>
            pl.find({
              collection: 'tenant-memberships',
              where: { user: { equals: userId }, status: { equals: 'active' } },
              depth: 2,
              limit: 50,
            }),
          )
        : Promise.resolve(null),
      // 3. Ensure DM space (authenticated only)
      isAuthenticated && tenant?.id
        ? ensureDMSpace(tenant.id)
        : Promise.resolve(undefined),
      // 4. Check wizard completion
      checkSetupRequired().catch(() => false),
      // 5. All tenants (super_admin only) — chooser source incl. platform root
      isSuperAdmin
        ? getPayload({ config }).then((pl) =>
            pl.find({
              collection: 'tenants',
              depth: 2,
              limit: 100,
              sort: 'name',
              overrideAccess: true,
            }),
          )
        : Promise.resolve(null),
    ])

  // Process spaces result
  let userSpaces: DashboardSpace[] = []
  let defaultSpaceId: string | undefined
  const spacesData = spacesResult.status === 'fulfilled' ? spacesResult.value : null
  if (spacesData) {
    userSpaces = spacesData.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      visibility: s.visibility as DashboardSpace['visibility'],
      isSystem: s.isSystem,
    }))
    defaultSpaceId =
      userSpaces.find((s) => !s.isSystem)?.id ??
      (await fetchDefaultSpaceId(tenant!.id)) ??
      undefined
  } else if (tenant?.id) {
    defaultSpaceId = (await fetchDefaultSpaceId(tenant.id)) ?? undefined
  }

  // Map a hydrated tenant object → TenantInfo for the chooser
  const toTenantInfo = (t: any): TenantInfo | null => {
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
  }

  // Build the tenant chooser list.
  // super_admins: ALL tenants (includes the platform root, which has no membership row).
  // Everyone else: the tenants they hold an active membership in.
  let userTenants: TenantInfo[] = []
  let userRoleData: DashboardUserRole | null = null
  const membershipsData = membershipsResult.status === 'fulfilled' ? membershipsResult.value : null
  const allTenantsData =
    allTenantsResult.status === 'fulfilled' ? allTenantsResult.value : null

  if (isSuperAdmin && allTenantsData && 'docs' in allTenantsData) {
    userTenants = (allTenantsData.docs || []).map(toTenantInfo).filter(Boolean) as TenantInfo[]
  } else if (membershipsData && 'docs' in membershipsData) {
    userTenants = (membershipsData.docs || [])
      .map((m: any) => toTenantInfo(m.tenant))
      .filter(Boolean) as TenantInfo[]
  }

  // Current-tenant role/permission context comes from tenant-memberships for everyone.
  if (membershipsData && 'docs' in membershipsData) {
    // Extract current tenant membership for role/permission context
    if (tenant?.id) {
      const currentMembership = (membershipsData.docs || []).find((m: any) => {
        const t = m.tenant
        const tId = typeof t === 'object' ? t?.id : t
        return String(tId) === String(tenant.id)
      }) as any
      if (currentMembership) {
        userRoleData = {
          platformRoles,
          tenantRole: currentMembership.role || null,
          tenantPermissions: currentMembership.permissions || [],
          membershipId: currentMembership.id ? String(currentMembership.id) : null,
        }
      }
    }
  }

  // Elevate isBusinessOwner if user has tenant_admin or tenant_manager role
  // on the current portal — even if their platform role is just 'customer'
  if (userRoleData?.tenantRole === 'tenant_admin' || userRoleData?.tenantRole === 'tenant_manager') {
    isBusinessOwner = true
  }

  // Process DM space + wizard results
  const dmSpaceId = dmResult.status === 'fulfilled' ? dmResult.value : undefined
  const setupRequired = setupResult.status === 'fulfilled' ? setupResult.value : false
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
    <DashboardProvider initialSpaces={userSpaces} defaultSpaceId={defaultSpaceId} userRole={userRoleData}>
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
            isAuthenticated={isAuthenticated}
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
            <DashboardHeader prefix={prefix} userName={userName} userInitials={userInitials} isAuthenticated={isAuthenticated} />

            {/* Page Content — reduced padding on mobile */}
            <main className="flex-1 overflow-y-auto p-3 md:p-6">{children}</main>
          </div>

          {/* ─── LEO Chat Sidebar (right, toggle) — hidden for anonymous ─── */}
          {isAuthenticated && (
            <DashboardLEOSidebar spaceId={defaultSpaceId} dmSpaceId={dmSpaceId} tenantId={tenant?.id ? String(tenant.id) : undefined} userId={userId ? String(userId) : undefined} />
          )}
        </div>
      </ChatProvider>
    </DashboardProvider>
  )
}
