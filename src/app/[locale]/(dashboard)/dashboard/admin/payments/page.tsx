import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PaymentsAdmin } from './PaymentsAdmin'
import { getJusticeFundGrowth, getRevenueTimeSeries } from '@/utilities/chartData'
import { SplitDonutChart, JusticeFundChart, RevenueChart } from '@/components/charts/DashboardCharts'

export default async function DashboardPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any = null

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = tenants.docs?.[0]
    tenantId = tenant?.id
  }
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = defaults.docs?.[0]
    tenantId = tenant?.id
  }

  // Fetch Justice Fund stats
  let justiceFundTotal = 0
  let justiceFundCount = 0
  try {
    const jfTransactions = await payload.find({
      collection: 'justice-fund-transactions',
      where: {
        ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
        status: { equals: 'completed' },
      },
      limit: 0,
      overrideAccess: true,
    })
    justiceFundCount = jfTransactions.totalDocs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    justiceFundTotal = jfTransactions.docs.reduce((sum: number, doc: any) => sum + (doc.amountCents || 0), 0)
  } catch {
    // Collection may not be populated yet
  }

  const stripeConnect = (tenant as any)?.stripeConnect || {}

  // Fetch recent transactions
  interface RecentTx {
    id: number | string
    amount: number
    currency: string
    status: string
    paymentMethod: string | null
    customerEmail: string | null
    createdAt: string
  }
  let recentTransactions: RecentTx[] = []
  try {
    const txResult = await payload.find({
      collection: 'transactions' as any,
      limit: 10,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    recentTransactions = txResult.docs.map((doc: any) => ({
      id: doc.id,
      amount: doc.amount || 0,
      currency: doc.currency || 'USD',
      status: doc.status || 'unknown',
      paymentMethod: doc.paymentMethod || null,
      customerEmail: doc.customerEmail || null,
      createdAt: doc.createdAt,
    }))
  } catch {
    // Transactions collection may not exist yet
  }

  // Fetch chart data
  const [jfGrowth, revData] = await Promise.all([
    getJusticeFundGrowth(payload, 30).catch(() => []),
    getRevenueTimeSeries(payload, 30).catch(() => []),
  ])

  return (
    <div className="space-y-8">
      <PaymentsAdmin
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
