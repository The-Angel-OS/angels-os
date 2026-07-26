import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { PaymentsAdmin } from './PaymentsAdmin'
import { getJusticeFundGrowth, getRevenueTimeSeries } from '@/utilities/chartData'
import { SplitDonutChart, JusticeFundChart, RevenueChart } from '@/components/charts/DashboardCharts'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  // The rate shown to an owner must be the rate actually charged — read it, do
  // not restate it. This panel used to hardcode 60/20/15/5.
  const { getPlatformFeeBps } = await import('@/utilities/platformFee')
  const platformFeePercent = (await getPlatformFeeBps(payload)) / 100
  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()

  const stripeConnect = tenant?.stripeConnect || {}

  // Run all queries in parallel — catch individually so one failure doesn't kill all
  interface RecentTx {
    id: number | string
    amount: number
    currency: string
    status: string
    paymentMethod: string | null
    customerEmail: string | null
    createdAt: string
  }

  const [jfResult, txResult, jfGrowth, revData] = await Promise.all([
    payload.find({
      collection: 'justice-fund-transactions',
      where: { and: [tenantFilter, { status: { equals: 'completed' } }] },
      limit: 0,
      overrideAccess: true,
    }).catch(() => null),
    payload.find({
      collection: 'transactions' as any,
      where: tenantFilter,
      limit: 10,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    }).catch(() => null),
    getJusticeFundGrowth(payload, 30).catch(() => []),
    getRevenueTimeSeries(payload, 30).catch(() => []),
  ])

  const justiceFundCount = jfResult?.totalDocs ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const justiceFundTotal = (jfResult?.docs ?? []).reduce((sum: number, doc: any) => sum + (doc.amountCents || 0), 0)

  const recentTransactions: RecentTx[] = (txResult?.docs ?? []).map((doc: any) => ({
    id: doc.id,
    amount: doc.amount || 0,
    currency: doc.currency || 'USD',
    status: doc.status || 'unknown',
    paymentMethod: doc.paymentMethod || null,
    customerEmail: doc.customerEmail || null,
    createdAt: doc.createdAt,
  }))

  return (
    <div className="space-y-8">
      <PaymentsAdmin
        platformFeePercent={platformFeePercent}
        tenantId={tenantId || 0}
        tenantName={tenant?.name || 'Unknown'}
        stripeAccountId={stripeConnect.stripeAccountId || null}
        onboardingComplete={stripeConnect.stripeOnboardingComplete || false}
        chargesEnabled={stripeConnect.stripeChargesEnabled || false}
        payoutsEnabled={stripeConnect.stripePayoutsEnabled || false}
        connectedAt={stripeConnect.connectedAt || null}
        justiceFundTotalCents={justiceFundTotal}
        justiceFundTransactionCount={justiceFundCount}
        recentTransactions={recentTransactions}
      />

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <SplitDonutChart />
        <JusticeFundChart data={jfGrowth} />
      </div>
      <RevenueChart data={revData} />
    </div>
  )
}
