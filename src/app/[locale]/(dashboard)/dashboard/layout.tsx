import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveActiveTenant } from '@/utilities/resolveActiveTenant'
import type { User } from '@/payload-types'
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
import { DashboardWidgetProvider, DismissedWidgetsTray } from '@/components/dashboard/widgets'
import { autoActivatePendingMembership } from '@/utilities/autoActivatePendingMembership'
import { ensureTenantMembership } from '@/utilities/ensureTenantMembership'

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

  // Server-side: resolve auth + space context
  const headersList = await headers()

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
  let dashboardPrefs: { collapsed?: string[]; dismissed?: string[]; order?: string[] } | null = null
  // The resolved user authorizes the active-endeavor override below — anonymous
  // stays null, which keeps tenant resolution strictly host-based.
  let authUser: User | null = null

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      authUser = user as User
      isAuthenticated = true
      userId = user.id
      platformRoles = ((user as any).roles as string[]) || []
      dashboardPrefs = ((user as any).dashboardPrefs as typeof dashboardPrefs) || null
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

  // Resolve tenant — host by default, or the user's active endeavor if they've
  // switched portals in-app (validated against membership; anon → host only).
  const { tenant } = await resolveActiveTenant(authUser)

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
    isGuardianAngel?: boolean
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
              where: {
                user: { equals: userId },
                status: { in: ['active', 'pending'] },
              },
              depth: 2,
              limit: 50,
              // Show a user their OWN portals. Without overrideAccess this find runs
              // with no user context, so the depth-2 tenant hydration is access-denied
              // and each m.tenant comes back as a bare ID — toTenantInfo then drops it
              // and a non-super-admin's chooser ends up EMPTY (they can't switch to
              // their own guardian angel). Super-admins never hit this (their branch
              // already uses overrideAccess). We already authed the user above.
              overrideAccess: true,
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
      isGuardianAngel: Boolean(t.isGuardianAngel),
    }
  }

  // Build the tenant chooser list.
  // super_admins: ALL tenants (includes the platform root, which has no membership row).
  // Everyone else: the tenants they hold an active OR pending membership in —
  //   pending is included so invited users can navigate to the portal and accept.
  //   Role/permission context is separately gated to active-only (see below).
  let userTenants: TenantInfo[] = []
  let userRoleData: DashboardUserRole | null = null
  const membershipsData = membershipsResult.status === 'fulfilled' ? membershipsResult.value : null
  const allTenantsData =
    allTenantsResult.status === 'fulfilled' ? allTenantsResult.value : null

  if (isSuperAdmin && allTenantsData && 'docs' in allTenantsData) {
    userTenants = (allTenantsData.docs || []).map(toTenantInfo).filter(Boolean) as TenantInfo[]
  } else if (membershipsData && 'docs' in membershipsData) {
    const seen = new Set<string>()
    userTenants = (membershipsData.docs || [])
      .map((m: any) => toTenantInfo(m.tenant))
      .filter((t): t is TenantInfo => {
        if (!t) return false
        const key = String(t.id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }

  // Current-tenant role/permission context comes from tenant-memberships for everyone.
  if (membershipsData && 'docs' in membershipsData) {
    // Extract current tenant membership for role/permission context
    if (tenant?.id) {
      const currentMembership = (membershipsData.docs || []).find((m: any) => {
        const t = m.tenant
        const tId = typeof t === 'object' ? t?.id : t
        return String(tId) === String(tenant.id) && m.status === 'active'
      }) as any
      if (currentMembership) {
        userRoleData = {
          platformRoles,
          tenantRole: currentMembership.role || null,
          tenantPermissions: currentMembership.permissions || [],
          membershipId: currentMembership.id ? String(currentMembership.id) : null,
        }
      } else if (userId && tenant?.id) {
        // No active membership — check for a pending one and auto-activate it.
        // Navigation to the portal IS acceptance; fire-and-forget so it never
        // blocks the layout render.
        const pendingMembership = (membershipsData?.docs || []).find((m: any) => {
          const tId = typeof m.tenant === 'object' ? m.tenant?.id : m.tenant
          return String(tId) === String(tenant.id) && m.status === 'pending'
        }) as any
        if (pendingMembership) {
          void autoActivatePendingMembership(pendingMembership.id, userId, tenant.id)
        } else {
          // Open-join: no membership row of ANY status for this tenant.
          // Reaching the portal enrolls the user as an active tenant_member so
          // they can see the tenant's non-private spaces. Fire-and-forget;
          // idempotent (re-checks before creating). The membershipsData query
          // above only loads active|pending, so a re-check inside the utility
          // guards against left/banned rows we didn't fetch here.
          void ensureTenantMembership(userId, tenant.id)
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
            portalPlan={(tenant as { portalPlan?: string } | null)?.portalPlan || 'free'}
            features={(tenant as { features?: { works?: boolean | null; pageComments?: boolean | null } } | null)?.features}
            wizardComplete={wizardComplete}
          />

          {/* ─── Main Content (center) ─── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Dashboard Header Bar — title + user info */}
            <DashboardHeader prefix={prefix} userName={userName} userInitials={userInitials} isAuthenticated={isAuthenticated} />

            {/* Page Content — reduced padding on mobile. The widget provider lets
                any dashboard page wrap cards in <DashboardWidget> (collapse/dismiss);
                the tray restores hidden ones (per-user prefs, server-synced). */}
            <main className="flex-1 overflow-y-auto p-3 md:p-6">
              <DashboardWidgetProvider initialPrefs={dashboardPrefs}>
                <DismissedWidgetsTray className="mb-3" />
                {children}
              </DashboardWidgetProvider>
            </main>
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
