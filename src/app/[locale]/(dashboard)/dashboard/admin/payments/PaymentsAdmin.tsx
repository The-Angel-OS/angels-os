'use client'

import React, { useEffect, useState } from 'react'

interface RecentTransaction {
  id: number | string
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  customerEmail: string | null
  createdAt: string
}

interface ProviderBadge {
  id: 'square' | 'paypal'
  label: string
  environment: 'sandbox' | 'production'
}

interface RailHealthInfo {
  configured: boolean
  healthy: boolean
  environment: string
  detectedEnvironmentMismatch?: string
  merchantOrAppName?: string
  locationId?: string
  webhookConfigured: boolean
  errors: string[]
  warnings: string[]
}

interface DiagnosticsReport {
  ready: boolean
  leftoverStripeEnvVars?: string[]
  expectedWebhookUrls?: {
    square: string
    paypal: string
    squareOAuthRedirect: string
  }
  rails?: {
    square?: RailHealthInfo
    paypal?: RailHealthInfo
  }
}

interface PaymentsAdminProps {
  tenantId: number
  tenantName: string
  squareConnected: boolean
  squareMerchantId: string | null
  squareMerchantName: string | null
  squareLocationId: string | null
  squareEnvironment: 'sandbox' | 'production'
  squareConnectedAt: string | null
  availableProviders: ProviderBadge[]
  isSuperAdmin: boolean
  justiceFundTotalCents: number
  justiceFundTransactionCount: number
  recentTransactions?: RecentTransaction[]
  /** The CONFIGURED platform rate as a percent, e.g. 5. Never hardcode it here. */
  platformFeePercent: number
}

export function PaymentsAdmin({
  tenantId,
  tenantName,
  squareConnected,
  squareMerchantId,
  squareMerchantName,
  squareLocationId,
  squareEnvironment,
  squareConnectedAt,
  availableProviders,
  isSuperAdmin,
  justiceFundTotalCents,
  justiceFundTransactionCount,
  recentTransactions = [],
  platformFeePercent,
}: PaymentsAdminProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diag, setDiag] = useState<DiagnosticsReport | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookOutput, setWebhookOutput] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('square') === 'connected') {
      setNotice('Square merchant account connected successfully.')
    }
    const sqErr = params.get('square_error')
    if (sqErr) {
      setError(`Square authorization did not complete (${sqErr}).`)
    }
  }, [])

  const handleConnectSquare = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/payment-ops/square/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId }),
      })
      const data = (await res.json()) as { authUrl?: string; error?: string }
      if (!res.ok || !data.authUrl) {
        setError(data.error || 'Could not start Square OAuth connection.')
        return
      }
      window.location.href = data.authUrl
    } catch {
      setError('Failed to reach Square connection endpoint.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectSquare = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/payment-ops/square/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error || 'Failed to disconnect Square.')
        return
      }
      window.location.reload()
    } catch {
      setError('Failed to disconnect Square.')
    } finally {
      setLoading(false)
    }
  }

  const runLiveDiagnostics = async () => {
    setDiagLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/payment-ops/setup?tenantId=${tenantId}`, {
        credentials: 'include',
      })
      const data = (await res.json()) as DiagnosticsReport & { error?: string }
      if (!res.ok) {
        setError(data.error || 'Failed to run payment diagnostics.')
        return
      }
      setDiag(data)
    } catch {
      setError('Failed to reach payment diagnostics.')
    } finally {
      setDiagLoading(false)
    }
  }

  const handleBootstrapWebhooks = async () => {
    setWebhookLoading(true)
    setError(null)
    setWebhookOutput(null)
    try {
      const res = await fetch('/api/payment-ops/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'bootstrap-webhooks' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Webhook registration failed.')
        return
      }
      setWebhookOutput(JSON.stringify(data.results, null, 2))
      void runLiveDiagnostics()
    } catch {
      setError('Failed to register webhooks.')
    } finally {
      setWebhookLoading(false)
    }
  }

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  const squarePlatformActive = availableProviders.some((p) => p.id === 'square')
  const paypalPlatformActive = availableProviders.some((p) => p.id === 'paypal')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-1">
          Dual-rail checkout via Square &amp; PayPal for {tenantName} — plus your transparent platform split.
        </p>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Active Checkout Rails */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Active Payment Rails</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Square (Cards, Apple Pay, Google Pay)</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  squarePlatformActive || squareConnected
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {squarePlatformActive || squareConnected ? 'Active' : 'Not Configured'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Primary card processor supporting direct multi-tenant payouts via Square OAuth.
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">PayPal / Venmo</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  paypalPlatformActive
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {paypalPlatformActive ? 'Active' : 'Not Configured'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Companion wallet rail supporting PayPal Checkout, Venmo, Pay Later, and recurring billing.
            </p>
          </div>
        </div>
      </div>

      {/* Multi-Tenant Square OAuth Connect */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Square Merchant Payouts (Direct Split)</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              squareConnected
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                squareConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {squareConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {squareConnected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Merchant</p>
                <p className="font-medium">{squareMerchantName || squareMerchantId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Merchant ID</p>
                <p className="font-mono text-xs">{squareMerchantId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Location ID</p>
                <p className="font-mono text-xs">{squareLocationId || 'Auto'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment / Connected</p>
                <p className="capitalize">
                  {squareEnvironment}
                  {squareConnectedAt ? ` · ${new Date(squareConnectedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://squareup.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open Square Dashboard
              </a>
              <button
                type="button"
                onClick={handleDisconnectSquare}
                disabled={loading}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {loading ? 'Disconnecting...' : 'Disconnect Square'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your own Square account so card sales, booking deposits, and donations go straight to your Square balance automatically, less the {platformFeePercent.toFixed(2)}% platform share. Until connected, platform rails handle payments on your behalf.
            </p>
            <button
              type="button"
              onClick={handleConnectSquare}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Starting Square OAuth...' : 'Connect Square Account'}
            </button>
          </div>
        )}
      </div>

      {/* Super-Admin Live Diagnostics */}
      {isSuperAdmin && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Platform Payment Diagnostics</h2>
              <p className="text-xs text-muted-foreground">
                Verify Square &amp; PayPal credentials live, detect Sandbox/Production mismatches, and register webhooks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runLiveDiagnostics}
                disabled={diagLoading}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {diagLoading ? 'Checking...' : 'Run Live Rail Health Check'}
              </button>
              <button
                type="button"
                onClick={handleBootstrapWebhooks}
                disabled={webhookLoading}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {webhookLoading ? 'Registering...' : 'Auto-Register Webhooks'}
              </button>
            </div>
          </div>

          {diag && (
            <div className="space-y-3 text-sm">
              {diag.leftoverStripeEnvVars && diag.leftoverStripeEnvVars.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  Leftover Stripe env vars detected on this node: {diag.leftoverStripeEnvVars.join(', ')}. You can safely remove them using <code>node scripts/setup-payments.mjs</code>.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {(['square', 'paypal'] as const).map((key) => {
                  const r = diag.rails?.[key]
                  if (!r) return null
                  return (
                    <div key={key} className="rounded-md border border-border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase">{key}</span>
                        <span
                          className={`text-xs font-medium ${
                            r.healthy ? 'text-emerald-600' : r.configured ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {r.healthy ? 'Healthy' : r.configured ? 'Error' : 'Unconfigured'} ({r.environment})
                        </span>
                      </div>
                      {r.merchantOrAppName && (
                        <p className="text-xs text-muted-foreground">Account: {r.merchantOrAppName}</p>
                      )}
                      {r.locationId && (
                        <p className="text-xs text-muted-foreground">Location: {r.locationId}</p>
                      )}
                      {r.detectedEnvironmentMismatch && (
                        <p className="text-xs font-medium text-red-600">
                          Mismatch: keys belong to {r.detectedEnvironmentMismatch}, not {r.environment}!
                        </p>
                      )}
                      {r.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">{e}</p>
                      ))}
                      {r.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600">{w}</p>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {webhookOutput && (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{webhookOutput}</pre>
          )}
        </div>
      )}

      {/* How payments split */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">How payments split</h2>
        <p className="text-sm text-muted-foreground">
          You keep {(100 - platformFeePercent).toFixed(2)}% of every payment. The platform keeps{' '}
          {platformFeePercent.toFixed(2)}% of money it helps you move — nothing when nothing sells.
        </p>
        <div className="space-y-3">
          {[
            { label: 'You (the provider)', pct: 100 - platformFeePercent, color: 'bg-emerald-500' },
            { label: 'Platform — hosting, AI, support', pct: platformFeePercent, color: 'bg-blue-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-24 text-right text-sm font-medium">{item.pct.toFixed(2)}%</div>
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
            No transactions yet. When customers make purchases, they&apos;ll appear here.
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
