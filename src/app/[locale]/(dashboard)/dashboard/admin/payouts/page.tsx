import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PayoutsAdmin } from './PayoutsAdmin'
import { getTenantPaymentSettings, isPayPalConfigured } from '@/lib/payments/config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()
  const paymentSettings = tenantId ? await getTenantPaymentSettings(payload, tenantId) : {}
  const sq = paymentSettings?.square

  let recentOrders: Array<{
    id: string
    total: number
    status: string
    createdAt: string
    customerEmail: string
  }> = []

  try {
    const ordersResult = await payload.find({
      collection: 'orders',
      where: tenantFilter,
      limit: 20,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    recentOrders = ordersResult.docs.map((doc: any) => ({
      id: String(doc.id),
      total: doc.total || 0,
      status: doc.status || 'unknown',
      createdAt: doc.createdAt || '',
      customerEmail:
        (typeof doc.orderedBy === 'object' ? doc.orderedBy?.email : '') || '',
    }))
  } catch {
    // Orders collection may not be populated yet
  }

  return (
    <PayoutsAdmin
      squareConnected={Boolean(sq?.connected)}
      squareMerchantId={sq?.merchantId || null}
      squareMerchantName={sq?.merchantName || null}
      squareEnvironment={sq?.environment || 'production'}
      paypalConfigured={isPayPalConfigured()}
      recentOrders={recentOrders}
      tenantName={tenant?.name || 'Your Enterprise'}
    />
  )
}
