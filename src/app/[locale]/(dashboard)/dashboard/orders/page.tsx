import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { isOrderPaid } from '@/utilities/orderPaid'
import { WorkspaceSubNav } from '../_components/WorkspaceSubNav'

export const dynamic = 'force-dynamic'

/**
 * Store Orders Dashboard — /dashboard/orders
 *
 * Displays the tenant's actual storefront orders directly (Holon-free).
 */
export default async function DashboardOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const prefix = locale === 'en' ? '' : `/${locale}`
  const payload = await getPayload({ config: configPromise })
  const { tenantFilter, tenant } = await resolveTenantFromHeaders()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orders: any[] = []
  try {
    const result = await payload.find({
      collection: 'orders' as any,
      where: tenantFilter,
      limit: 100,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    orders = result.docs as any[]
  } catch {
    orders = []
  }

  const paidOrders = orders.filter((o) => isOrderPaid(o.status || ''))
  const grossCents = paidOrders.reduce((sum, o) => sum + Number(o.amount ?? o.total ?? 0), 0)

  const formatMoney = (cents: number, currency = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: String(currency || 'USD').toUpperCase(),
      }).format(cents / 100)
    } catch {
      return `$${(cents / 100).toFixed(2)}`
    }
  }

  const statusTone: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    fulfilled: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    processing: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    refunded: 'bg-muted text-muted-foreground',
  }

  return (
    <div>
      <WorkspaceSubNav
        tabs={[
          { label: 'Products', href: `${prefix}/dashboard/products` },
          { label: 'Orders', href: `${prefix}/dashboard/orders`, active: true },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Storefront sales and fulfillment for {tenant?.branding?.siteName || tenant?.name || 'your site'}.
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/admin/settings?tab=payments`}
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Payment Settings
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Orders</p>
          <p className="mt-1 text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Paid Orders</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {paidOrders.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Gross Revenue</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(grossCents)}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">No store orders yet</h3>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            When customers check out from your shop, their orders will appear right here.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`${prefix}/dashboard/products`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Manage Products
            </Link>
            <Link
              href={`${prefix}/dashboard/admin/settings?tab=payments`}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Check Payment Setup
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => {
                const email =
                  order.customerEmail ||
                  (typeof order.orderedBy === 'object' ? order.orderedBy?.email : '') ||
                  (typeof order.customer === 'object' ? order.customer?.email : '') ||
                  'Guest'
                const itemCount = Array.isArray(order.items)
                  ? order.items.reduce((n: number, it: { quantity?: number }) => n + (it?.quantity || 1), 0)
                  : 0
                const cents = Number(order.amount ?? order.total ?? 0)
                const status = String(order.status || 'pending')
                return (
                  <tr key={String(order.id)} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">
                      #{String(order.id).slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {itemCount} item{itemCount === 1 ? '' : 's'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(cents, order.currency || 'USD')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          statusTone[status] || statusTone.pending
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/collections/orders/${order.id}?returnTo=/dashboard/orders&returnLabel=Orders`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
