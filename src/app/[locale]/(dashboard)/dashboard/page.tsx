import { headers } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { WelcomeBanner, type UserRole } from '@/components/WelcomeBanner'
import OnboardingGuide from '@/components/OnboardingGuide'
import { FederationPulse } from '@/components/dashboard/widgets/FederationPulse'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getBootstrapFeeStatus, getTotalBootstrapLiability } from '@/utilities/bootstrapFees'
import {
  getRevenueTimeSeries,
  getOrderVolume,
  getFederationActivity,
  getJusticeFundGrowth,
} from '@/utilities/chartData'
import {
  RevenueChart,
  OrderVolumeChart,
  FederationActivityChart,
  JusticeFundChart,
} from '@/components/charts/DashboardCharts'
import { LCARSStatCard } from '@/components/dashboard/LCARSStatCard'
import { LCARSQuickAction } from '@/components/dashboard/LCARSQuickAction'
import { BridgeOfficerStatus } from '@/components/dashboard/BridgeOfficerStatus'

/**
 * Dashboard Overview – Rev 2 style stat cards + quick access.
 * Server component: fetches real counts from Payload Local API.
 * Shows WelcomeBanner when database is unseeded (0 spaces + 0 products).
 * Stats scoped to current tenant for non-super-admins.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  // Fetch tenant-scoped stats server-side
  let stats = {
    tenants: 0,
    spaces: 0,
    users: 0,
    products: 0,
    posts: 0,
    bookings: 0,
    projects: 0,
  }
  let tenantName = 'Angel OS'
  let tenantStatus = 'active'
  let isSuperAdmin = false
  let isAdmin = false
  let userRole: UserRole = 'user'
  let userName: string | undefined
  // Chart data
  let revenueData: Awaited<ReturnType<typeof getRevenueTimeSeries>> = []
  let orderData: Awaited<ReturnType<typeof getOrderVolume>> = []
  let federationData: Awaited<ReturnType<typeof getFederationActivity>> = []
  let justiceFundData: Awaited<ReturnType<typeof getJusticeFundGrowth>> = []

  // Growth stats (admin only)
  let growthStats = { pendingInvites: 0, activeMembers: 0, federationPeers: 0 }

  // Recent activity (admin only)
  let recentActivity: Array<{ action: string; detail?: string; createdAt: string; allowed?: boolean }> = []
  // Content drafts count
  let draftCount = 0
  // Node-level "is this a fresh DB?" signal — independent of the CURRENT tenant.
  // A provisioned node (real tenants or spaces anywhere) must never be offered the
  // destructive global seed, even if the tenant you're viewing happens to be empty.
  let nodeHasData = false

  let feeStatus: {
    tier: string
    freeTransactionsUsed: number
    freeTransactionLimit: number
    freeGmvCents: number
    freeGmvLimitCents: number
    bootstrapFeePercent: number
    totalFeesCollectedCents: number
    refundPromised: boolean
    refundStatus: string
    freeTransactionsRemaining: number
  } | null = null
  let platformLiability: {
    totalLiabilityCents: number
    tenantsInBootstrap: number
    tenantsInFree: number
    tenantsGraduated: number
  } | null = null

  try {
    const payload = await getPayload({ config })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    // Resolve current tenant (cached, React.cache deduped)
    const { tenant: currentTenant } = await resolveTenantFromHeaders()

    // Node-level data signal (not tenant-scoped) — drives whether the destructive
    // seed banner may appear at all. Cheap counts; fail-safe to "has data".
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
      nodeHasData = true // can't verify → don't offer a destructive seed
    }

    if (user) {
      const roles = (user as any).roles as string[] | undefined
      isSuperAdmin = Boolean(roles?.includes('super_admin'))
      isAdmin = Boolean(
        isSuperAdmin || roles?.includes('admin') || roles?.includes('archangel'),
      )
      userRole = isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : 'user'
      userName = (user as any).name || undefined

      // New users with no tenant memberships → redirect to endeavor creation
      if (!isSuperAdmin) {
        const memberships = await payload.find({
          collection: 'tenant-memberships',
          where: {
            user: { equals: user.id },
            status: { equals: 'active' },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (memberships.totalDocs === 0) {
          redirect(`${prefix}/dashboard/new-endeavor`)
        }
      }
    }

    // Use current tenant for header display
    if (currentTenant) {
      tenantName =
        currentTenant.branding?.siteName ||
        currentTenant.name ||
        'Angel OS'
      tenantStatus = currentTenant.status || 'active'
    }

    // Tenant-scoped filter: super_admins see everything, others see their tenant only
    const tenantFilter: Where | undefined =
      isSuperAdmin || !currentTenant
        ? undefined
        : { tenant: { equals: currentTenant.id } }

    // Parallel count queries – catch individually so one failure doesn't kill all
    const [tenants, spaces, users, products, posts, bookings, projects] = await Promise.all([
      // Tenants count only visible to super_admins
      isSuperAdmin
        ? payload.count({ collection: 'tenants', overrideAccess: true })
        : Promise.resolve({ totalDocs: 0 }),
      payload.count({
        collection: 'spaces',
        where: tenantFilter,
        overrideAccess: true,
      }),
      payload.count({
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
        .count({ collection: 'projects', where: tenantFilter, overrideAccess: true })
        .catch(() => ({ totalDocs: 0 })),
    ])

    stats = {
      tenants: tenants.totalDocs,
      spaces: spaces.totalDocs,
      users: users.totalDocs,
      products: products.totalDocs,
      posts: posts.totalDocs,
      bookings: bookings.totalDocs,
      projects: projects.totalDocs,
    }

    // Fetch fee status, liability, and chart data in parallel (all non-critical)
    const [feeResult, liabilityResult, revData, ordData, fedData, jfData] = await Promise.all([
      currentTenant?.id
        ? getBootstrapFeeStatus(currentTenant.id as number).catch(() => null)
        : Promise.resolve(null),
      isSuperAdmin
        ? getTotalBootstrapLiability().catch(() => null)
        : Promise.resolve(null),
      getRevenueTimeSeries(payload, 30, tenantFilter).catch(() => []),
      getOrderVolume(payload, 30, tenantFilter).catch(() => []),
      isAdmin ? getFederationActivity(payload, 14).catch(() => []) : Promise.resolve([]),
      isAdmin ? getJusticeFundGrowth(payload, 30).catch(() => []) : Promise.resolve([]),
    ])
    feeStatus = feeResult
    platformLiability = liabilityResult
    revenueData = revData
    orderData = ordData
    federationData = fedData
    justiceFundData = jfData

    // Growth stats for admins
    if (isAdmin && currentTenant) {
      const [pendingResult, membersResult, peersResult] = await Promise.all([
        payload.count({
          collection: 'tenant-memberships',
          where: {
            and: [
              { tenant: { equals: currentTenant.id } },
              { status: { equals: 'pending' } },
            ],
          },
          overrideAccess: true,
        }).catch(() => ({ totalDocs: 0 })),
        payload.count({
          collection: 'tenant-memberships',
          where: {
            and: [
              { tenant: { equals: currentTenant.id } },
              { status: { equals: 'active' } },
            ],
          },
          overrideAccess: true,
        }).catch(() => ({ totalDocs: 0 })),
        payload.count({
          collection: 'federation-audit-log',
          where: { action: { equals: 'ping_received' } },
          overrideAccess: true,
        }).catch(() => ({ totalDocs: 0 })),
      ])
      growthStats = {
        pendingInvites: pendingResult.totalDocs,
        activeMembers: membersResult.totalDocs,
        federationPeers: peersResult.totalDocs,
      }
    }

    // Recent activity feed + draft counts (parallel, non-critical)
    const [activityResult, draftPagesResult, draftPostsResult] = await Promise.all([
      isAdmin
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
  } catch {
    // Not authenticated or DB not ready — show defaults
  }

  // "Seeded" = the current tenant has content OR the NODE is already provisioned
  // (real tenants/spaces anywhere). The node-level signal prevents the misleading
  // "database hasn't been seeded yet" banner — and its destructive Seed button —
  // from showing on a live federated node just because the current tenant is empty.
  const isSeeded = stats.spaces > 0 || stats.products > 0 || nodeHasData

  // Stardate display: YYYY.DDD format
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
  const stardate = `${now.getFullYear()}.${String(dayOfYear).padStart(3, '0')}`

  return (
    <div className="space-y-6">
      {/* Onboarding Guide — framework-managed widget (collapse/hide/restore) */}
      <OnboardingGuide role={userRole} prefix={prefix} />

      {/* The Network — community pulse: you're part of a living federation */}
      <FederationPulse />

      {/* Welcome Banner — role-based onboarding, dismissible */}
      <WelcomeBanner isSeeded={isSeeded} userRole={userRole} userName={userName} />

      {/* LCARS Command Center Header */}
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-3 rounded-full flex-shrink-0"
          style={{ background: 'var(--lcars-amber)' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1
                className="text-lg font-mono font-bold uppercase tracking-wider"
                style={{ color: 'var(--lcars-amber)' }}
              >
                {tenantName} — Command Center
              </h1>
              <div className="flex items-center gap-1.5">
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
                  {tenantStatus === 'active' ? 'Systems Online' : 'Provisioning'}
                </span>
              </div>
            </div>
            <span
              className="text-xs font-mono hidden sm:block"
              style={{ color: 'var(--lcars-text-muted)' }}
            >
              STARDATE {stardate}
            </span>
          </div>
          {/* LCARS decorative bars */}
          <div className="flex gap-1 mt-1">
            <div className="h-0.5 flex-1 rounded-full" style={{ background: 'rgba(245, 166, 35, 0.3)' }} />
            <div className="h-0.5 w-12 rounded-full" style={{ background: 'rgba(153, 204, 255, 0.3)' }} />
            <div className="h-0.5 w-6 rounded-full" style={{ background: 'rgba(204, 153, 204, 0.3)' }} />
          </div>
        </div>
      </div>

      {/* Stat Cards – LCARS styled, tenant-scoped */}
      <div className={`grid grid-cols-2 gap-4 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {isSuperAdmin && (
          <LCARSStatCard
            label="Federation Tenants"
            value={stats.tenants}
            icon={<NetworkIcon />}
            accentColor="var(--lcars-lavender)"
            delay={0}
          />
        )}
        <LCARSStatCard
          label="Comm Channels"
          value={stats.spaces}
          icon={<ChatIcon />}
          accentColor="var(--lcars-blue)"
          href={`${prefix}/dashboard/spaces`}
          delay={100}
        />
        <LCARSStatCard
          label="Crew Manifest"
          value={stats.users}
          icon={<UsersIcon />}
          accentColor="var(--lcars-green)"
          delay={200}
        />
        <LCARSStatCard
          label="Cargo Bay"
          value={stats.products}
          icon={<CubeIcon />}
          accentColor="var(--lcars-orange)"
          href={`${prefix}/shop`}
          delay={300}
        />
        {draftCount > 0 && (
          <LCARSStatCard
            label="Drafts"
            value={draftCount}
            icon={<DraftIcon />}
            accentColor="var(--lcars-peach, #ffab91)"
            href="/admin/collections/pages"
            delay={350}
          />
        )}
      </div>

      {/* Bootstrap Fee Status */}
      {feeStatus && (
        <BootstrapFeeCard feeStatus={feeStatus} platformLiability={platformLiability} isSuperAdmin={isSuperAdmin} />
      )}

      {/* Charts — LCARS panel wrapper */}
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
          Sensor Readings — 30 Day Window
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart data={revenueData} />
          <OrderVolumeChart data={orderData} />
        </div>
      </div>

      {/* Admin-only charts — Federation + Justice Fund */}
      {isAdmin && (federationData.length > 0 || justiceFundData.length > 0) && (
        <div
          className="rounded-lg border p-4"
          style={{
            background: 'rgba(17, 17, 34, 0.3)',
            borderColor: 'rgba(153, 204, 255, 0.08)',
          }}
        >
          <p
            className="text-xs font-mono uppercase tracking-wider mb-3"
            style={{ color: 'var(--lcars-blue)' }}
          >
            Federation Telemetry
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FederationActivityChart data={federationData} />
            <JusticeFundChart data={justiceFundData} />
          </div>
        </div>
      )}

      {/* Bridge Officer Status + Growth Stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <BridgeOfficerStatus />

        {/* Growth Stats — LCARS styled */}
        {isAdmin && (growthStats.pendingInvites > 0 || growthStats.activeMembers > 0 || growthStats.federationPeers > 0) && (
          <div
            className="rounded-lg border p-4"
            style={{
              background: 'rgba(17, 17, 34, 0.6)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(245, 166, 35, 0.1)',
            }}
          >
            <p
              className="text-xs font-mono uppercase tracking-wider mb-3"
              style={{ color: 'var(--lcars-amber)' }}
            >
              Network Growth
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p
                  className="text-2xl font-mono font-bold tabular-nums"
                  style={{ color: 'var(--lcars-amber)', textShadow: '0 0 12px rgba(245, 166, 35, 0.25)' }}
                >
                  {growthStats.pendingInvites}
                </p>
                <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
                  Pending Hails
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-2xl font-mono font-bold tabular-nums"
                  style={{ color: 'var(--lcars-green)', textShadow: '0 0 12px rgba(76, 175, 80, 0.25)' }}
                >
                  {growthStats.activeMembers}
                </p>
                <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
                  Active Crew
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-2xl font-mono font-bold tabular-nums"
                  style={{ color: 'var(--lcars-blue)', textShadow: '0 0 12px rgba(153, 204, 255, 0.25)' }}
                >
                  {growthStats.federationPeers}
                </p>
                <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
                  Federation Peers
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Feed — Ship's Log (admin only) */}
      {isAdmin && recentActivity.length > 0 && (
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
            Ship&apos;s Log — Recent Activity
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

      {/* Quick Access — LCARS Console Actions */}
      <div>
        <p
          className="text-xs font-mono uppercase tracking-wider mb-3"
          style={{ color: 'var(--lcars-text-muted)' }}
        >
          Console Actions
        </p>
        <div className={`grid gap-3 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'} sm:grid-cols-2`}>
          <LCARSQuickAction
            href={`${prefix}/dashboard/spaces`}
            icon={<ChatIcon />}
            label="Comms"
            description="AI Chat + Collaboration"
            accentColor="var(--lcars-green)"
          />
          <LCARSQuickAction
            href={`${prefix}/dashboard/events`}
            icon={<CalendarIcon />}
            label="Ops Log"
            description="Meetups & Workshops"
            accentColor="var(--lcars-blue)"
          />
          <LCARSQuickAction
            href={`${prefix}/shop`}
            icon={<CubeIcon />}
            label="Cargo Bay"
            description="E-commerce Catalog"
            accentColor="var(--lcars-lavender)"
          />
          <LCARSQuickAction
            href={`${prefix}/federation/discover`}
            icon={<NetworkIcon />}
            label="Long Range Sensors"
            description="Federation Network"
            accentColor="var(--lcars-purple)"
          />
          {isAdmin && (
            <LCARSQuickAction
              href={`${prefix}/dashboard/admin/invitations`}
              icon={<UsersIcon />}
              label="Crew Manifest"
              description="Grow your community"
              accentColor="var(--lcars-amber)"
            />
          )}
        </div>
      </div>

      {/* Secondary Stats Row — LCARS mini cards */}
      <div className="grid grid-cols-3 gap-3">
        <LCARSStatCard
          label="Ship's Log"
          value={stats.posts}
          icon={<PostsIcon />}
          accentColor="var(--lcars-peach)"
          href={`${prefix}/posts`}
          delay={400}
        />
        <LCARSStatCard
          label="Bookings"
          value={stats.bookings}
          icon={<CalendarIcon />}
          accentColor="var(--lcars-blue)"
          href={`${prefix}/admin/collections/bookings`}
          delay={500}
        />
        <LCARSStatCard
          label="Projects"
          value={stats.projects}
          icon={<CubeIcon />}
          accentColor="var(--lcars-lavender)"
          href={`${prefix}/admin/collections/projects`}
          delay={600}
        />
      </div>

      {/* Admin Panel link — LCARS styled */}
      {isAdmin && (
        <div className="flex justify-center">
          <Link
            href={`${prefix}/dashboard/admin`}
            className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-mono uppercase tracking-wider transition-all hover:scale-[1.02]"
            style={{
              borderColor: 'rgba(245, 166, 35, 0.2)',
              color: 'var(--lcars-amber)',
              background: 'rgba(17, 17, 34, 0.5)',
            }}
          >
            <GearIcon />
            Admin Panel
            <ChevronRightIcon />
          </Link>
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
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function PostsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
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

// ─── Bootstrap Fee Card ─────────────────────────────────────────

function BootstrapFeeCard({
  feeStatus,
  platformLiability,
  isSuperAdmin,
}: {
  feeStatus: {
    tier: string
    freeTransactionsUsed: number
    freeTransactionLimit: number
    freeGmvCents: number
    freeGmvLimitCents: number
    bootstrapFeePercent: number
    totalFeesCollectedCents: number
    refundPromised: boolean
    refundStatus: string
    freeTransactionsRemaining: number
  }
  platformLiability: {
    totalLiabilityCents: number
    tenantsInBootstrap: number
    tenantsInFree: number
    tenantsGraduated: number
  } | null
  isSuperAdmin: boolean
}) {
  const tierConfig = {
    free: {
      color: 'border-emerald-200 dark:border-emerald-800',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      dot: 'bg-emerald-500',
      label: 'Free Tier',
      description: `${feeStatus.freeTransactionsRemaining} free transactions remaining`,
    },
    bootstrap: {
      color: 'border-amber-200 dark:border-amber-800',
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      dot: 'bg-amber-500',
      label: 'Bootstrap Phase',
      description: `${feeStatus.bootstrapFeePercent}% fee — full refund promised`,
    },
    standard: {
      color: 'border-blue-200 dark:border-blue-800',
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      dot: 'bg-blue-500',
      label: 'Standard',
      description: 'UltimateFairSplit active (60/20/15/5)',
    },
  }

  const tier = tierConfig[feeStatus.tier as keyof typeof tierConfig] || tierConfig.free

  return (
    <div className={`rounded-lg border ${tier.color} ${tier.bg} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-block h-3 w-3 rounded-full ${tier.dot}`} />
          <div>
            <h3 className="font-semibold">{tier.label}</h3>
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          </div>
        </div>

        {feeStatus.tier === 'free' && (
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {feeStatus.freeTransactionsUsed}/{feeStatus.freeTransactionLimit}
            </p>
            <p className="text-xs text-muted-foreground">transactions used</p>
          </div>
        )}

        {feeStatus.tier === 'bootstrap' && (
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ${(feeStatus.totalFeesCollectedCents / 100).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              collected — {feeStatus.refundPromised ? 'refund committed' : 'refund waived'}
            </p>
          </div>
        )}
      </div>

      {/* Free tier progress bar */}
      {feeStatus.tier === 'free' && feeStatus.freeTransactionLimit > 0 && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-emerald-200/50 dark:bg-emerald-800/30">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, (feeStatus.freeTransactionsUsed / feeStatus.freeTransactionLimit) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ${(feeStatus.freeGmvCents / 100).toFixed(0)} / ${(feeStatus.freeGmvLimitCents / 100).toFixed(0)} GMV
          </p>
        </div>
      )}

      {/* Super admin: platform-wide liability */}
      {isSuperAdmin && platformLiability && (
        <div className="mt-4 grid grid-cols-4 gap-3 border-t border-current/10 pt-3">
          <div className="text-center">
            <p className="text-lg font-bold">${(platformLiability.totalLiabilityCents / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Refund Liability</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{platformLiability.tenantsInFree}</p>
            <p className="text-xs text-muted-foreground">Free Tier</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{platformLiability.tenantsInBootstrap}</p>
            <p className="text-xs text-muted-foreground">Bootstrap</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{platformLiability.tenantsGraduated}</p>
            <p className="text-xs text-muted-foreground">Graduated</p>
          </div>
        </div>
      )}
    </div>
  )
}
