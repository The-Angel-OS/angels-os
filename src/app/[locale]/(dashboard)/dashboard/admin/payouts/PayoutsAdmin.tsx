'use client'

import React from 'react'
import Link from 'next/link'

interface PayoutsAdminProps {
  stripeAccountId: string | null
  onboardingComplete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  recentOrders: Array<{
    id: string
    total: number
    status: string
    createdAt: string
    customerEmail: string
  }>
  tenantName: string
}

export function PayoutsAdmin({
  stripeAccountId,
  onboardingComplete,
  chargesEnabled,
  payoutsEnabled,
  recentOrders,
  tenantName,
}: PayoutsAdminProps) {
  const paidOrders = recentOrders.filter((o) => o.status === 'paid' || o.status === 'fulfilled')
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Payouts &amp; Revenue</h1>
        <p className="text-muted-foreground">
          Manage your Stripe Connect account and track revenue for {tenantName}.
        </p>
      </div>

      {/* Stripe Connect Status */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Stripe Connect Status</h2>

        {!stripeAccountId ? (
          <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="mb-1 font-semibold">Stripe Connect Not Set Up</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account to start receiving payments. Go to{' '}
              <Link href="/dashboard/admin/payments" className="text-primary underline">
                Payments Settings
              </Link>{' '}
              to begin onboarding.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard
              label="Account ID"
              value={stripeAccountId.slice(0, 16) + '...'}
              status="info"
            />
            <StatusCard
              label="Onboarding"
              value={onboardingComplete ? 'Complete' : 'Incomplete'}
              status={onboardingComplete ? 'success' : 'warning'}
            />
            <StatusCard
              label="Charges"
              value={chargesEnabled ? 'Enabled' : 'Disabled'}
              status={chargesEnabled ? 'success' : 'error'}
            />
            <StatusCard
              label="Payouts"
              value={payoutsEnabled ? 'Enabled' : 'Disabled'}
              status={payoutsEnabled ? 'success' : 'error'}
            />
          </div>
        )}

        {stripeAccountId && (
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://connect.stripe.com/express_login"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5349d6]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-7.076-2.19l-.893 5.575C4.746 22.901 7.614 24 11.174 24c2.6 0 4.719-.63 6.209-1.828 1.614-1.283 2.427-3.178 2.427-5.554 0-4.103-2.494-5.793-5.834-7.468z"/>
              </svg>
              Open Stripe Dashboard
            </a>
            <Link
              href="/dashboard/admin/payments"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Payment Settings
            </Link>
          </div>
        )}
      </div>

      {/* Revenue Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold">
            ${(totalRevenue / 100).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            From {paidOrders.length} paid order{paidOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Seller Earnings (60%)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            ${((totalRevenue * 0.6) / 100).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            After Ultimate Fair Split
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Justice Fund (5%)</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            ${((totalRevenue * 0.05) / 100).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supporting the community
          </p>
        </div>
      </div>

      {/* Split Breakdown */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Ultimate Fair Split Breakdown</h2>
        <div className="space-y-3">
          <SplitRow label="Seller" percentage={60} color="bg-emerald-500" />
          <SplitRow label="Platform (Angel OS)" percentage={20} color="bg-blue-500" />
          <SplitRow label="Guardian Angel" percentage={15} color="bg-purple-500" />
          <SplitRow label="Justice Fund" percentage={5} color="bg-amber-500" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Every transaction is split according to the Angel OS Constitution. The seller always receives 60%.
        </p>
      </div>

      {/* Recent Orders */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-muted-foreground">No orders yet. Revenue will appear here once customers make purchases.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Order ID</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50">
                    <td className="py-3 pr-4">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        #{order.id.slice(-8).toUpperCase()}
                      </code>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {order.customerEmail || 'Unknown'}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      ${(order.total / 100).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusCard({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: 'success' | 'warning' | 'error' | 'info'
}) {
  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColors[status]}`} />
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  )
}

function SplitRow({
  label,
  percentage,
  color,
}: {
  label: string
  percentage: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="w-10 text-right text-sm font-medium">{percentage}%</span>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    fulfilled: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  )
}
