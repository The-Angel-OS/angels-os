'use client'

import React, { useState } from 'react'

/**
 * PaymentsAdmin — Stripe Connect management dashboard.
 *
 * Shows connection status, onboarding flow, and Justice Fund stats.
 * The 60/20/15/5 Ultimate Fair split is displayed for transparency.
 */

interface RecentTransaction {
  id: number | string
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  customerEmail: string | null
  createdAt: string
}

interface PaymentsAdminProps {
  tenantId: number
  tenantName: string
  stripeAccountId: string | null
  onboardingComplete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  connectedAt: string | null
  justiceFundTotalCents: number
  justiceFundTransactionCount: number
  recentTransactions?: RecentTransaction[]
}

export function PaymentsAdmin({
  tenantId,
  tenantName,
  stripeAccountId,
  onboardingComplete,
  chargesEnabled,
  payoutsEnabled,
  connectedAt,
  justiceFundTotalCents,
  justiceFundTransactionCount,
  recentTransactions = [],
}: PaymentsAdminProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  const isConnected = stripeAccountId && onboardingComplete && chargesEnabled

  const handleConnectStripe = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      if (data.alreadyConnected) {
        // Refresh to show updated status
        window.location.reload()
        return
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      }
    } catch {
      setError('Failed to connect to Stripe. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/connect/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })

      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to refresh status')
      }
    } catch {
      setError('Failed to refresh status')
    } finally {
      setLoading(false)
    }
  }

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-1">
          Manage your payment processing and view the Ultimate Fair split.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          {error.includes('platform-profile') || error.includes('platform profile') ? (
            <a
              href="https://dashboard.stripe.com/settings/connect/platform-profile"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 underline hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
            >
              Open Stripe Platform Profile →
            </a>
          ) : null}
        </div>
      )}

      {/* Stripe Connect Status */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stripe Connect</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isConnected
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {isConnected ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Account ID</p>
                <p className="font-mono">{stripeAccountId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Connected</p>
                <p>{connectedAt ? new Date(connectedAt).toLocaleDateString() : 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Charges</p>
                <p>{chargesEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payouts</p>
                <p>{payoutsEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  setDashboardLoading(true)
                  setError(null)
                  try {
                    const res = await fetch('/api/stripe/connect/dashboard-link', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tenantId }),
                    })
                    const data = await res.json()
                    if (res.ok && data.url) {
                      window.open(data.url, '_blank')
                    } else {
                      setError(data.error || 'Could not generate dashboard link')
                    }
                  } catch {
                    setError('Failed to open Stripe Dashboard')
                  } finally {
                    setDashboardLoading(false)
                  }
                }}
                disabled={dashboardLoading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {dashboardLoading ? 'Opening...' : 'Open Stripe Dashboard'}
              </button>
              <button
                onClick={handleRefreshStatus}
                disabled={loading}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                {loading ? 'Refreshing...' : 'Refresh status'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account to receive payments. Money flows through the Ultimate Fair
              split: you receive 60% of every transaction automatically.
            </p>
            {stripeAccountId && !onboardingComplete && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Onboarding started but not completed. Click below to continue.
              </p>
            )}
            <button
              onClick={handleConnectStripe}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                'Setting up...'
              ) : stripeAccountId ? (
                'Continue Stripe Setup'
              ) : (
                'Connect Stripe Account'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Ultimate Fair Split */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Ultimate Fair Split</h2>
        <p className="text-sm text-muted-foreground">
          Every transaction is transparently split to ensure fairness.
        </p>
        <div className="space-y-3">
          {[
            { label: 'Provider (You)', pct: 60, color: 'bg-emerald-500' },
            { label: 'Platform Partner', pct: 20, color: 'bg-blue-500' },
            { label: 'Operations & Hosting', pct: 15, color: 'bg-purple-500' },
            { label: 'Justice Fund', pct: 5, color: 'bg-amber-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-24 text-right text-sm font-medium">{item.pct}%</div>
              <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
              <div className="w-48 text-sm text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Justice Fund */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Justice Fund</h2>
        <p className="text-sm text-muted-foreground">
          5% of every transaction goes to the Justice Fund — supporting community programs, guild
          development, and equity initiatives.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Total Allocated</p>
            <p className="text-2xl font-bold">{formatCents(justiceFundTotalCents)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold">{justiceFundTransactionCount}</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Recent Transactions</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions yet. When customers make purchases, they'll appear here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{formatCents(tx.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.status === 'succeeded'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : tx.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : tx.status === 'failed'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tx.customerEmail || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {tx.paymentMethod || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
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
