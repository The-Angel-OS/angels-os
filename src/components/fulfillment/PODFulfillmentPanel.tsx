'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { SanitizedPODStatus } from '@/lib/fulfillment/types'

interface PODFulfillmentPanelProps {
  tenantId: number | string
  tenantName?: string
  compact?: boolean
}

export function PODFulfillmentPanel({
  tenantId,
  tenantName = 'your storefront',
  compact = false,
}: PODFulfillmentPanelProps) {
  const [status, setStatus] = useState<SanitizedPODStatus | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Printful Private Token + Printify inputs
  const [printfulToken, setPrintfulToken] = useState('')
  const [printifyToken, setPrintifyToken] = useState('')
  const [printifyShopId, setPrintifyShopId] = useState('')

  // Operational preferences
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [packingSlipMessage, setPackingSlipMessage] = useState('')
  const [packingSlipPhone, setPackingSlipPhone] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/fulfillment-ops/pod/status?tenantId=${encodeURIComponent(String(tenantId))}`,
        { credentials: 'include' },
      )
      const json = (await res.json()) as {
        ok?: boolean
        status?: SanitizedPODStatus
        webhookUrl?: string
        error?: string
      }
      if (json.ok && json.status) {
        setStatus(json.status)
        setWebhookUrl(json.webhookUrl || '')
        setAutoConfirm(json.status.autoConfirmOrders)
        setPackingSlipMessage(json.status.packingSlipMessage || '')
        setPackingSlipPhone(json.status.packingSlipPhone || '')
      }
    } catch {
      /* non-fatal initial load */
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const startPrintfulOAuth = async () => {
    setBusy('printful-oauth')
    setFeedback(null)
    try {
      const res = await fetch('/api/fulfillment-ops/pod/printful/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId, mode: 'oauth' }),
      })
      const json = (await res.json()) as { authorizeUrl?: string; error?: string }
      if (!res.ok || !json.authorizeUrl) {
        setFeedback({ type: 'error', text: json.error || 'Could not start Printful OAuth.' })
      } else {
        window.location.href = json.authorizeUrl
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'OAuth error' })
    } finally {
      setBusy(null)
    }
  }

  const connectPrintfulToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!printfulToken.trim()) return
    setBusy('printful-token')
    setFeedback(null)
    try {
      const res = await fetch('/api/fulfillment-ops/pod/printful/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId, mode: 'private_token', apiToken: printfulToken.trim() }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        status?: SanitizedPODStatus
        webhookUrl?: string
        error?: string
      }
      if (!res.ok || !json.ok || !json.status) {
        setFeedback({ type: 'error', text: json.error || 'Invalid Printful API token.' })
      } else {
        setPrintfulToken('')
        setStatus(json.status)
        if (json.webhookUrl) setWebhookUrl(json.webhookUrl)
        setFeedback({
          type: 'success',
          text: `Connected Printful store: ${json.status.printful.storeName || 'Active'}.`,
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Connect failed' })
    } finally {
      setBusy(null)
    }
  }

  const connectPrintify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!printifyToken.trim()) return
    setBusy('printify')
    setFeedback(null)
    try {
      const res = await fetch('/api/fulfillment-ops/pod/printify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          apiToken: printifyToken.trim(),
          ...(printifyShopId.trim() ? { shopId: printifyShopId.trim() } : {}),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        status?: SanitizedPODStatus
        webhookUrl?: string
        error?: string
      }
      if (!res.ok || !json.ok || !json.status) {
        setFeedback({ type: 'error', text: json.error || 'Could not connect Printify.' })
      } else {
        setPrintifyToken('')
        setStatus(json.status)
        if (json.webhookUrl) setWebhookUrl(json.webhookUrl)
        setFeedback({
          type: 'success',
          text: `Connected Printify shop: ${json.status.printify.shopTitle || 'Active'}.`,
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Connect failed' })
    } finally {
      setBusy(null)
    }
  }

  const syncMerchCatalog = async () => {
    setBusy('sync')
    setFeedback(null)
    try {
      const res = await fetch('/api/fulfillment-ops/pod/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        created?: number
        updated?: number
        total?: number
        status?: SanitizedPODStatus
        error?: string
      }
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'error', text: json.error || 'Catalog sync failed.' })
      } else {
        if (json.status) setStatus(json.status)
        setFeedback({
          type: 'success',
          text: `Synced ${json.total ?? 0} merch product(s): ${json.created ?? 0} created as draft, ${json.updated ?? 0} updated.`,
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Sync failed' })
    } finally {
      setBusy(null)
    }
  }

  const savePreferences = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('prefs')
    setFeedback(null)
    try {
      const res = await fetch('/api/fulfillment-ops/pod/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          autoConfirmOrders: autoConfirm,
          packingSlipMessage,
          packingSlipPhone,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; status?: SanitizedPODStatus; error?: string }
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'error', text: json.error || 'Could not save POD preferences.' })
      } else {
        if (json.status) setStatus(json.status)
        setFeedback({ type: 'success', text: 'Print-on-Demand fulfillment settings saved.' })
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnect = async (provider: 'printful' | 'printify') => {
    setBusy(`disconnect-${provider}`)
    setFeedback(null)
    try {
      const res = await fetch('/api/fulfillment-ops/pod/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId, provider }),
      })
      const json = (await res.json()) as { ok?: boolean; status?: SanitizedPODStatus; error?: string }
      if (json.ok && json.status) {
        setStatus(json.status)
        setFeedback({ type: 'success', text: `Disconnected ${provider}.` })
      } else {
        setFeedback({ type: 'error', text: json.error || 'Disconnect failed.' })
      }
    } finally {
      setBusy(null)
    }
  }

  const printfulConnected = status?.printful.connected === true
  const printifyConnected = status?.printify.connected === true
  const anyConnected = printfulConnected || printifyConnected

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Print-on-Demand Merch (Creator-Owned Printful &amp; Printify)
            </h3>
            {anyConnected ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Connected ({status?.activeProvider === 'printify' ? 'Printify' : 'Printful'})
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect your own Printful (primary) or Printify account for {tenantName}. Paid shop orders route automatically with zero inventory or platform float.
          </p>
        </div>

        {anyConnected && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={syncMerchCatalog}
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === 'sync' ? 'Syncing Catalog...' : 'Sync Merch Catalog'}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground">Checking Print-on-Demand connection...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Printful Primary Card */}
          <div className="rounded-lg border border-border bg-background/70 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Printful (Primary)</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                    v2 / OAuth
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {printfulConnected
                    ? `Store: ${status?.printful.storeName || 'Printful Store'}${status?.printful.storeId ? ` (#${status.printful.storeId})` : ''}`
                    : '1-click OAuth 2.0 or Private API Token from Printful Developers.'}
                </p>
              </div>
              {printfulConnected && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleDisconnect('printful')}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  Disconnect
                </button>
              )}
            </div>

            {!printfulConnected && (
              <div className="space-y-3">
                {status?.oauthAvailable && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={startPrintfulOAuth}
                    className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy === 'printful-oauth' ? 'Redirecting...' : 'Connect Printful (1-Click OAuth 2.0)'}
                  </button>
                )}

                <details open={!status?.oauthAvailable} className="rounded-md border border-border/80 p-3">
                  <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                    Connect with Printful Private Token
                  </summary>
                  <form onSubmit={connectPrintfulToken} className="mt-2.5 flex gap-2">
                    <input
                      type="password"
                      value={printfulToken}
                      onChange={(e) => setPrintfulToken(e.target.value)}
                      placeholder="Printful Private Token..."
                      className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={busy !== null || !printfulToken.trim()}
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {busy === 'printful-token' ? 'Saving...' : 'Connect'}
                    </button>
                  </form>
                </details>
              </div>
            )}
          </div>

          {/* Printify Secondary Card */}
          <div className="rounded-lg border border-border bg-background/70 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Printify (Secondary)</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    API v1
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {printifyConnected
                    ? `Shop: ${status?.printify.shopTitle || 'Printify Shop'}${status?.printify.shopId ? ` (#${status.printify.shopId})` : ''}`
                    : 'Optional lower-cost multi-printer network via Printify Personal Access Token.'}
                </p>
              </div>
              {printifyConnected && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleDisconnect('printify')}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  Disconnect
                </button>
              )}
            </div>

            {!printifyConnected && (
              <details open={!compact && !printfulConnected} className="rounded-md border border-border/80 p-3">
                <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                  Connect Printify API Token
                </summary>
                <form onSubmit={connectPrintify} className="mt-2.5 space-y-2">
                  <input
                    type="password"
                    value={printifyToken}
                    onChange={(e) => setPrintifyToken(e.target.value)}
                    placeholder="Printify API Token..."
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={printifyShopId}
                      onChange={(e) => setPrintifyShopId(e.target.value)}
                      placeholder="Shop ID (optional, auto-discovers first)"
                      className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={busy !== null || !printifyToken.trim()}
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {busy === 'printify' ? 'Saving...' : 'Connect'}
                    </button>
                  </div>
                </form>
              </details>
            )}
          </div>
        </div>
      )}

      {anyConnected && !compact && (
        <form onSubmit={savePreferences} className="rounded-lg border border-border/80 bg-background/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Last catalog sync:{' '}
              <strong className="text-foreground">
                {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}
              </strong>{' '}
              ({status?.syncedProductCount ?? 0} synced products)
            </span>
          </div>

          <label className="flex items-start gap-2.5 text-xs">
            <input
              type="checkbox"
              checked={autoConfirm}
              onChange={(e) => setAutoConfirm(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span>
              <strong className="text-foreground">Auto-confirm paid orders to print immediately</strong>
              <span className="block text-muted-foreground">
                When unchecked, orders submit as Printful drafts so you can inspect shipping addresses before billing your Printful card.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Custom Packing Slip Message
              </label>
              <input
                type="text"
                value={packingSlipMessage}
                onChange={(e) => setPackingSlipMessage(e.target.value)}
                placeholder="Thank you for supporting the channel!"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Packing Slip Support Phone (Optional)
              </label>
              <input
                type="text"
                value={packingSlipPhone}
                onChange={(e) => setPackingSlipPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          {webhookUrl && (
            <div className="text-[11px] text-muted-foreground">
              Tracking Webhook URL:{' '}
              <code className="break-all rounded bg-muted px-1.5 py-0.5 text-[10px]">
                {webhookUrl}
              </code>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy !== null}
              className="rounded-md border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {busy === 'prefs' ? 'Saving...' : 'Save Fulfillment Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
