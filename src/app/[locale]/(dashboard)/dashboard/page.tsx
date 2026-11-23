import { headers } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { WelcomeBanner, type UserRole } from '@/components/WelcomeBanner'
import { FirstRunDriver } from '@/components/dashboard/FirstRunDriver'
import { PresenceRoster } from '@/components/dashboard/widgets/PresenceRoster'
import { resolveActiveTenant } from '@/utilities/resolveActiveTenant'
import type { User } from '@/payload-types'
import {
  getRevenueTimeSeries,
  getOrderVolume,
} from '@/utilities/chartData'
import {
  RevenueChart,
  OrderVolumeChart,
} from '@/components/charts/DashboardCharts'
import { LCARSStatCard } from '@/components/dashboard/LCARSStatCard'
import { LCARSQuickAction } from '@/components/dashboard/LCARSQuickAction'
import { EarnReadinessCard } from '@/components/dashboard/EarnReadinessCard'
import { getEarnReadiness, type EarnReadiness } from '@/utilities/earnReadiness'

/**
 * Creator Studio Overview — /dashboard
 *
 * Streamlined creator dashboard with LCARS visual accents, free of legacy
 * Starfleet/federation/holon terminology. Surfaces tenant-scoped counts,
 * monetization readiness, 30-day revenue/order charts, and quick actions.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  let stats = {
    tenants: 0,
    spaces: 0,
    users: 0,
    products: 0,
    posts: 0,
    bookings: 0,
    orders: 0,
    openTickets: 0,
  }
  let tenantName = 'Creator Studio'
  let tenantStatus = 'active'
  let isSuperAdmin = false
  let isAdmin = false
  let isPortalManager = false
  let userRole: UserRole = 'user'
  let userName: string | undefined
  let showFirstRun = false
  let revenueData: Awaited<ReturnType<typeof getRevenueTimeSeries>> = []
  let orderData: Awaited<ReturnType<typeof getOrderVolume>> = []
  let earnReadiness: EarnReadiness | null = null
  let recentActivity: Array<{ action: string; detail?: string; createdAt: string; allowed?: boolean }> = []
  let draftCount = 0
  let visitCount7d = 0
  let nodeHasData = false
  let isPlatformView = false

  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    const authUser = user ? (user as User) : null

    const { tenant: currentTenant } = await resolveActiveTenant(authUser)

    try {
      const [realTenants, anySpaces] = await Promise.all([
        payload.count({
          collection: 'tenants',
          where: { and: [{ slug: { not_equals: 'default' } }, { type: { not_equals: 'platform' } }] },
          overrideAccess: true,
        }),
        payload.count({ collection: 'spaces', overrideAccess: true }),
      ])
      nodeHasData = realTenants.totalDocs > 0 || anySpaces.totalDocs > 0
    } catch {
      nodeHasData = true
    }

    if (user) {
      const roles = (user as any).roles as string[] | undefined
      isSuperAdmin = Boolean(roles?.includes('super_admin'))
      isAdmin = Boolean(
        isSuperAdmin || roles?.includes('admin') || roles?.includes('archangel'),
      )
      isPortalManager = isAdmin
      userRole = isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : 'user'
      userName = (user as any).name || undefined

      if (!isSuperAdmin) {
        const memberships = await payload.find({
          collection: 'tenant-memberships',
          where: {
            user: { equals: user.id },
            status: { equals: 'active' },
          },
          limit: 50,
          depth: 1,
          overrideAccess: true,
        })
        if (memberships.totalDocs === 0) {
          redirect(`${prefix}/dashboard/admin/provision`)
        }

        if (currentTenant?.id) {
          const currentMembership = (memberships.docs || []).find((m: any) => {
            const tId = typeof m.tenant === 'object' ? m.tenant?.id : m.tenant
            return String(tId) === String(currentTenant.id)
          }) as { role?: string } | undefined
          if (
            currentMembership?.role === 'tenant_admin' ||
            currentMembership?.role === 'tenant_manager'
          ) {
            isPortalManager = true
          }
        }

        const ownsRealEndeavor = (memberships.docs || []).some((m: any) => {
          const t = m.tenant
          return m.role === 'tenant_admin' && t && typeof t === 'object' && !t.isGuardianAngel
        })
        showFirstRun = !ownsRealEndeavor
      }
    }

    if (currentTenant) {
      tenantName =
        currentTenant.branding?.siteName ||
        currentTenant.name ||
        'Creator Studio'
      tenantStatus = currentTenant.status || 'active'
    }

    isPlatformView = !currentTenant || (currentTenant as { type?: string }).type === 'platform'
    const tenantFilter: Where | undefined =
      isPlatformView && isSuperAdmin
        ? undefined
        : currentTenant
          ? { tenant: { equals: currentTenant.id } }
          : undefined

    const [tenants, spaces, users, products, posts, bookings, orders, openTickets] = await Promise.all([
      isSuperAdmin && isPlatformView
        ? payload.count({ collection: 'tenants', overrideAccess: true })
        : Promise.resolve({ totalDocs: 0 }),
      payload.count({
        collection: 'spaces',
        where: tenantFilter,
        overrideAccess: true,
      }),
      tenantFilter
        ? payload.count({
            collection: 'tenant-memberships',
            where: { and: [tenantFilter, { status: { equals: 'active' } }] },
            overrideAccess: true,
          })
        : payload.count({
            collection: 'users',
            where: { isSystemUser: { not_equals: true } },
            overrideAccess: true,
          }),
      payload
        .count({ collection: 'products', where: tenantFilter, overrideAccess: true })
        .catch(() => ({ totalDocs: 0 })),
      payload.count({
        collection: 'posts',
        where: tenantFilter,
        overrideAccess: true,
      }),
      payload
        .count({ collection: 'bookings', where: tenantFilter, overrideAccess: true })
        .catch(() => ({ totalDocs: 0 })),
      payload
        .count({ collection: 'orders' as any, where: tenantFilter, overrideAccess: true })
        .catch(() => ({ totalDocs: 0 })),
      payload
        .count({
          collection: 'tickets',
          where: {
            and: [
              ...(tenantFilter ? [tenantFilter] : []),
              { status: { in: ['submitted', 'reviewing', 'approved'] } },
            ],
          },
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 })),
    ])

    stats = {
      tenants: tenants.totalDocs,
      spaces: spaces.totalDocs,
      users: users.totalDocs,
      products: products.totalDocs,
      posts: posts.totalDocs,
      bookings: bookings.totalDocs,
      orders: orders.totalDocs,
      openTickets: openTickets.totalDocs,
    }

    if (isPortalManager) {
      const [revData, ordData] = await Promise.all([
        getRevenueTimeSeries(payload, 30, tenantFilter).catch(() => []),
        getOrderVolume(payload, 30, tenantFilter).catch(() => []),
      ])
      revenueData = revData
      orderData = ordData
    }

    if (isPortalManager && currentTenant) {
      earnReadiness = await getEarnReadiness(payload, { tenantId: currentTenant.id }).catch(() => null)
    }

    const [activityResult, draftPagesResult, draftPostsResult] = await Promise.all([
      isSuperAdmin
        ? payload.find({
            collection: 'federation-audit-log',
            sort: '-createdAt',
            limit: 6,
            depth: 0,
            overrideAccess: true,
          }).catch(() => ({ docs: [] }))
        : Promise.resolve({ docs: [] }),
      payload.count({
        collection: 'pages',
        where: { ...(tenantFilter ?? {}), _status: { equals: 'draft' } },
        overrideAccess: true,
      }).catch(() => ({ totalDocs: 0 })),
      payload.count({
        collection: 'posts',
        where: { ...(tenantFilter ?? {}), _status: { equals: 'draft' } },
        overrideAccess: true,
      }).catch(() => ({ totalDocs: 0 })),
    ])
    recentActivity = (activityResult.docs || []).map((d: any) => ({
      action: d.action || 'unknown',
      detail: d.detail || d.sourceFederationId || '',
      createdAt: d.createdAt || '',
      allowed: d.allowed,
    }))
    draftCount = draftPagesResult.totalDocs + draftPostsResult.totalDocs

    if (currentTenant?.id) {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const visits = await payload
        .count({
          collection: 'site-visits',
          where: {
            and: [
              { tenant: { equals: currentTenant.id } },
              { createdAt: { greater_than_equal: since } },
              { isBot: { not_equals: true } },
            ],
          } as Where,
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 }))
      visitCount7d = visits.totalDocs
    }
  } catch {
    // Not authenticated or DB not ready — show defaults
  }

  const isSeeded = stats.spaces > 0 || stats.products > 0 || nodeHasData

  return (
    <div className="space-y-6">
      {/* Live presence roster */}
      <PresenceRoster />

      {/* First-run prompt for users who haven't launched their own site yet */}
      {showFirstRun && <FirstRunDriver userName={userName} />}

      {/* Welcome Banner — only on an unseeded node */}
      {!isSeeded && <WelcomeBanner isSeeded={isSeeded} userRole={userRole} userName={userName} />}

      {/* Ready to Earn — monetization readiness gate */}
      {earnReadiness && <EarnReadinessCard readiness={earnReadiness} />}

      {/* Studio Header — LCARS accent bar */}
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-2.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--lcars-amber)' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1
                className="text-lg font-mono font-bold uppercase tracking-wider truncate"
                style={{ color: 'var(--lcars-amber)' }}
              >
                {tenantName}
              </h1>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: tenantStatus === 'active' ? 'var(--lcars-green)' : 'var(--lcars-amber)',
                    animation: 'lcars-heartbeat 2s ease-in-out infinite',
                  }}
                />
                <span
                  className="text-[10px] font-mono uppercase"
                  style={{ color: 'var(--lcars-text-muted)' }}
                >
                  {tenantStatus === 'active' ? 'Live' : 'Provisioning'}
                </span>
              </div>
            </div>
            <span
              className="text-xs font-mono uppercase tracking-wider hidden sm:block"
              style={{ color: 'var(--lcars-text-muted)' }}
            >
              Creator Studio
            </span>
          </div>
          {/* LCARS decorative accent bar */}
          <div className="flex gap-1 mt-1">
            <div className="h-0.5 flex-1 rounded-full" style={{ background: 'rgba(245, 166, 35, 0.3)' }} />
            <div className="h-0.5 w-12 rounded-full" style={{ background: 'rgba(153, 204, 255, 0.3)' }} />
            <div className="h-0.5 w-6 rounded-full" style={{ background: 'rgba(204, 153, 204, 0.3)' }} />
          </div>
        </div>
      </div>

      {/* Stat Cards — tenant-scoped */}
      <div className={`grid grid-cols-2 gap-4 ${isSuperAdmin && isPlatformView ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {isSuperAdmin && isPlatformView && (
          <LCARSStatCard
            label="Active Portals"
            value={stats.tenants}
            icon={<NetworkIcon />}
            accentColor="var(--lcars-lavender)"
            delay={0}
          />
        )}
        <LCARSStatCard
          label="Site Visits (7d)"
          value={visitCount7d}
          icon={<ActivityIcon />}
          accentColor="var(--lcars-blue)"
          href={isSuperAdmin ? `${prefix}/dashboard/admin/site-log` : undefined}
          delay={50}
        />
        <LCARSStatCard
          label="Members"
          value={stats.users}
          icon={<UsersIcon />}
          accentColor="var(--lcars-green)"
          href={isPortalManager ? `${prefix}/dashboard/admin/team` : undefined}
          delay={100}
        />
        <LCARSStatCard
          label="Posts & Videos"
          value={stats.posts}
          icon={<PostsIcon />}
          accentColor="var(--lcars-peach)"
          href={isPortalManager ? `${prefix}/dashboard/posts` : `${prefix}/posts`}
          delay={150}
        />
        <LCARSStatCard
          label="Spaces"
          value={stats.spaces}
          icon={<ChatIcon />}
          accentColor="var(--lcars-blue)"
          href={`${prefix}/dashboard/spaces`}
          delay={200}
        />
        <LCARSStatCard
          label="Products"
          value={stats.products}
          icon={<CubeIcon />}
          accentColor="var(--lcars-orange)"
          href={isPortalManager ? `${prefix}/dashboard/products` : `${prefix}/shop`}
          delay={250}
        />
        <LCARSStatCard
          label="Orders"
          value={stats.orders}
          icon={<CubeIcon />}
          accentColor="var(--lcars-lavender)"
          href={isPortalManager ? `${prefix}/dashboard/orders` : `${prefix}/dashboard/my-orders`}
          delay={300}
        />
        <LCARSStatCard
          label="Bookings"
          value={stats.bookings}
          icon={<CalendarIcon />}
          accentColor="var(--lcars-blue)"
          href={isPortalManager ? `${prefix}/dashboard/admin/bookings` : undefined}
          delay={325}
        />
        {isPortalManager && (
          <LCARSStatCard
            label="Open Tickets"
            value={stats.openTickets}
            icon={<SupportIcon />}
            accentColor={stats.openTickets > 0 ? 'var(--lcars-amber)' : 'var(--lcars-green)'}
            href={`${prefix}/dashboard/tickets`}
            delay={340}
          />
        )}
        {draftCount > 0 && isPortalManager && (
          <LCARSStatCard
            label="Drafts"
            value={draftCount}
            icon={<DraftIcon />}
            accentColor="var(--lcars-peach, #ffab91)"
            href={`${prefix}/dashboard/posts?status=draft`}
            delay={350}
          />
        )}
      </div>

      {/* Revenue & Order Volume — 30-day charts for portal managers */}
      {isPortalManager && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: 'rgba(17, 17, 34, 0.3)',
            borderColor: 'rgba(245, 166, 35, 0.08)',
          }}
        >
          <p
            className="text-xs font-mono uppercase tracking-wider mb-3"
            style={{ color: 'var(--lcars-text-muted)' }}
          >
            Revenue &amp; Orders — Last 30 Days
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <RevenueChart data={revenueData} />
            <OrderVolumeChart data={orderData} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <p
          className="text-xs font-mono uppercase tracking-wider mb-3"
          style={{ color: 'var(--lcars-text-muted)' }}
        >
          Quick Actions
        </p>
        <div className={`grid gap-3 sm:grid-cols-2 ${isPortalManager ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4'}`}>
          <LCARSQuickAction
            href={`${prefix}/dashboard/spaces`}
            icon={<ChatIcon />}
            label="Spaces & LEO"
            description="Community chat & AI assistant"
            accentColor="var(--lcars-green)"
          />
          {isPortalManager ? (
            <>
              <LCARSQuickAction
                href={`${prefix}/dashboard/posts`}
                icon={<PostsIcon />}
                label="Posts & Videos"
                description="Publish articles & media"
                accentColor="var(--lcars-blue)"
              />
              <LCARSQuickAction
                href={`${prefix}/dashboard/memberships`}
                icon={<UsersIcon />}
                label="Memberships"
                description="Supporter tiers & subscribers"
                accentColor="var(--lcars-amber)"
              />
              <LCARSQuickAction
                href={`${prefix}/dashboard/products`}
                icon={<CubeIcon />}
                label="Shop & Orders"
                description="Products & storefront sales"
                accentColor="var(--lcars-lavender)"
              />
              <LCARSQuickAction
                href={`${prefix}/dashboard/tickets`}
                icon={<SupportIcon />}
                label="Support Desk"
                description="Incident queue & tickets"
                accentColor="var(--lcars-amber)"
              />
              <LCARSQuickAction
                href={`${prefix}/dashboard/admin/settings`}
                icon={<GearIcon />}
                label="Settings"
                description="Branding, domains & payouts"
                accentColor="var(--lcars-purple)"
              />
            </>
          ) : (
            <>
              <LCARSQuickAction
                href={`${prefix}/posts`}
                icon={<PostsIcon />}
                label="Posts"
                description="Read latest updates"
                accentColor="var(--lcars-blue)"
              />
              <LCARSQuickAction
                href={`${prefix}/help`}
                icon={<SupportIcon />}
                label="Help & Support"
                description="Submit & track tickets"
                accentColor="var(--lcars-amber)"
              />
              <LCARSQuickAction
                href={`${prefix}/dashboard/my-orders`}
                icon={<CubeIcon />}
                label="My Orders"
                description="Track your purchases"
                accentColor="var(--lcars-lavender)"
              />
            </>
          )}
        </div>
      </div>

      {/* Super-admin recent platform activity */}
      {isSuperAdmin && recentActivity.length > 0 && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: 'rgba(17, 17, 34, 0.4)',
            borderColor: 'rgba(245, 166, 35, 0.08)',
          }}
        >
          <p
            className="text-xs font-mono uppercase tracking-wider mb-3"
            style={{ color: 'var(--lcars-amber)' }}
          >
            Recent Platform Activity
          </p>
          <div className="space-y-2">
            {recentActivity.map((event, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-xs"
                style={{ padding: '6px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                  style={{
                    background: event.allowed === false ? 'var(--lcars-peach, #ff6b6b)' : 'var(--lcars-green, #4caf50)',
                  }}
                />
                <span className="font-mono uppercase tracking-wider" style={{ color: 'var(--lcars-amber)', minWidth: '120px' }}>
                  {event.action.replace(/_/g, ' ')}
                </span>
                {event.detail && (
                  <span className="text-muted-foreground truncate flex-1">{event.detail}</span>
                )}
                <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                  {formatActivityTime(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SVG Icons (inline, no dependencies) ─────────────────────────

function ChatIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

function CubeIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )
}

function NetworkIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

function PostsIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
      />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 12h4l3-8 4 16 3-8h4"
      />
    </svg>
  )
}

function DraftIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="3.5" strokeWidth={1.5} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M14.5 9.5l4-4M9.5 9.5l-4-4M14.5 14.5l4 4M9.5 14.5l-4 4"
      />
    </svg>
  )
}

/** Format a timestamp for the activity feed (e.g., "2h ago", "3d ago") */
function formatActivityTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'now'
    if (diffMin < 60) return `${diffMin}m`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d`
  } catch {
    return ''
  }
}
