import { setRequestLocale } from 'next-intl/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getTenantPaymentSettings } from '@/lib/payments/config'
import { getAvailableProviders } from '@/lib/payments/registry'
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
  const reqHeaders = await nextHeaders()
  const { user } = await payload.auth({ headers: reqHeaders }).catch(() => ({ user: null }))
  const isSuperAdmin = (((user as { roles?: string[] } | null)?.roles) || []).includes('super_admin')

  const { getPlatformFeeBps } = await import('@/utilities/platformFee')
  const platformFeePercent = (await getPlatformFeeBps(payload)) / 100
  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()

  const [paymentSettings, availableRails, jfResult, txResult, jfGrowth, revData] = await Promise.all([
    tenantId ? getTenantPaymentSettings(payload, tenantId) : Promise.resolve({}),
    getAvailableProviders(payload, tenantId ?? undefined),
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

  const sq = paymentSettings?.square
  const justiceFundCount = jfResult?.totalDocs ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const justiceFundTotal = (jfResult?.docs ?? []).reduce((sum: number, doc: any) => sum + (doc.amountCents || 0), 0)

  const recentTransactions = (txResult?.docs ?? []).map((doc: any) => ({
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
        tenantId={Number(tenantId) || 0}
        tenantName={tenant?.name || 'Unknown'}
        squareConnected={Boolean(sq?.connected)}
        squareMerchantId={sq?.merchantId || null}
        squareMerchantName={sq?.merchantName || null}
        squareLocationId={sq?.locationId || null}
        squareEnvironment={sq?.environment || 'production'}
        squareConnectedAt={sq?.connectedAt || null}
        availableProviders={availableRails.providers.map((p) => ({
          id: p.id,
          label: p.label,
          environment: p.environment,
        }))}
        isSuperAdmin={isSuperAdmin}
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
