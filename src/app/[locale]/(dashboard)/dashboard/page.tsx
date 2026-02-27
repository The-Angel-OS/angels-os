import { headers } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { WelcomeBanner, type UserRole } from '@/components/WelcomeBanner'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
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

    // Resolve current tenant from middleware header
    const tenantSlug = headersList.get('x-tenant-id')
    const host = headersList.get('host') ?? ''
    const currentTenant =
      (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
      (await fetchTenantByDomain(host))

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
        (currentTenant as any).branding?.siteName ||
        (currentTenant as any).name ||
        'Angel OS'
      tenantStatus = (currentTenant as any).status || 'active'
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
  } catch {
    // Not authenticated or DB not ready — show defaults
  }

  // Unseeded = no spaces AND no products (tenants may exist from initial migration)
  const isSeeded = stats.spaces > 0 || stats.products > 0

  return (
    <div className="space-y-8">
      {/* Welcome Banner — role-based onboarding, dismissible */}
      <WelcomeBanner isSeeded={isSeeded} userRole={userRole} userName={userName} />

      {/* Platform Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">{tenantName}</h1>
        <div className="mt-2 inline-flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              tenantStatus === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-sm text-muted-foreground">
            Platform {tenantStatus === 'active' ? 'Active' : 'Provisioning'}
          </span>
        </div>
      </div>

      {/* Stat Cards – top row, tenant-scoped for non-super-admins */}
      <div className={`grid grid-cols-2 gap-4 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {isSuperAdmin && (
          <StatCard count={stats.tenants} label="Active Tenants" color="text-purple-500" />
        )}
        <StatCard count={stats.spaces} label="Collaboration Spaces" color="text-blue-500" />
        <StatCard count={stats.users} label="Platform Users" color="text-emerald-500" />
        <StatCard count={stats.products} label="Products Listed" color="text-orange-500" />
      </div>

      {/* Bootstrap Fee Status */}
      {feeStatus && (
        <BootstrapFeeCard feeStatus={feeStatus} platformLiability={platformLiability} isSuperAdmin={isSuperAdmin} />
      )}

      {/* Charts — Revenue + Order Volume side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart data={revenueData} />
        <OrderVolumeChart data={orderData} />
      </div>

      {/* Admin-only charts — Federation + Justice Fund */}
      {isAdmin && (federationData.length > 0 || justiceFundData.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <FederationActivityChart data={federationData} />
          <JusticeFundChart data={justiceFundData} />
        </div>
      )}

      {/* Quick Access – 3 primary cards like Rev 2 */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAccessCard
            href={`${prefix}/dashboard/spaces`}
            icon={<ChatIcon />}
            iconColor="text-emerald-500"
            title="Spaces"
            subtitle="AI Chat + Collaboration"
          />
          <QuickAccessCard
            href={`${prefix}/dashboard/events`}
            icon={<CalendarIcon />}
            iconColor="text-blue-500"
            title="Events"
            subtitle="Meetups & Workshops"
          />
          <QuickAccessCard
            href={`${prefix}/shop`}
            icon={<CubeIcon />}
            iconColor="text-purple-500"
            title="Products"
            subtitle="E-commerce Catalog"
          />
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat count={stats.posts} label="Posts" href={`${prefix}/posts`} />
        <MiniStat
          count={stats.bookings}
          label="Bookings"
          href={`${prefix}/admin/collections/bookings`}
        />
        <MiniStat
          count={stats.projects}
          label="Projects"
          href={`${prefix}/admin/collections/projects`}
        />
      </div>

      {/* Admin Panel link – Rev 2 style centered button */}
      {isAdmin && (
        <div className="flex justify-center">
          <Link
            href={`${prefix}/dashboard/admin`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
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

// ─── Sub-components ──────────────────────────────────────────────

function StatCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-5 text-center">
      <p className={`text-3xl font-bold ${color}`}>{count}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function QuickAccessCard({
  href,
  icon,
  iconColor,
  title,
  subtitle,
}: {
  href: string
  icon: React.ReactNode
  iconColor: string
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center rounded-lg border border-border p-6 text-center transition-colors hover:bg-muted/50"
    >
      <span className={iconColor}>{icon}</span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </Link>
  )
}

function MiniStat({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border p-4 text-center transition-colors hover:bg-muted/50"
    >
      <p className="text-xl font-semibold">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
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
