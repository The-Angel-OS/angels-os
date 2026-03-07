import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PayoutsAdmin } from './PayoutsAdmin'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

export default async function DashboardPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant (cached)
  const { tenantFilter } = await resolveTenantFromHeaders()
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant: any = tenantSlug ? await fetchTenantBySlug(tenantSlug) : null

  const stripeConnect = (tenant as any)?.stripeConnect || {}

  // Fetch recent orders with payment info for this tenant
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
      stripeAccountId={stripeConnect.stripeAccountId || null}
      onboardingComplete={stripeConnect.stripeOnboardingComplete || false}
      chargesEnabled={stripeConnect.stripeChargesEnabled || false}
      payoutsEnabled={stripeConnect.stripePayoutsEnabled || false}
      recentOrders={recentOrders}
      tenantName={tenant?.name || 'Your Enterprise'}
    />
  )
}
