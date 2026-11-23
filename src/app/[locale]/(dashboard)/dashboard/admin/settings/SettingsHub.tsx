'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import EndeavorSetup, {
  ImageField,
  type MediaValue,
} from '@/app/[locale]/(dashboard)/dashboard/endeavor/EndeavorSetup'
import { PaymentsAdmin } from '@/app/[locale]/(dashboard)/dashboard/admin/payments/PaymentsAdmin'
import { PayoutsAdmin } from '@/app/[locale]/(dashboard)/dashboard/admin/payouts/PayoutsAdmin'
import { ConnectorsAdmin } from '@/app/[locale]/(dashboard)/dashboard/account/integrations/ConnectorsAdmin'
import { PlanPanel } from '@/app/[locale]/(dashboard)/dashboard/plan/PlanPanel'
import {
  RevenueChart,
  PlatformFeeChart,
  type TimeSeriesPoint,
} from '@/components/charts/DashboardCharts'
import { HEADING_FONTS, BODY_FONTS } from '@/config/brandingOptions'
import type { PortalPlan } from '@/utilities/portalPlan'
import { savePortalBrandingAndGeneral, saveLeoAndAiSettings } from './actions'

// ---------------------------------------------------------------------------
// Types & Tab Resolution
// ---------------------------------------------------------------------------

export type TabId = 'branding' | 'domains' | 'payments' | 'leo' | 'plan' | 'advanced'

const TAB_ALIASES: Record<string, TabId> = {
  branding: 'branding',
  general: 'branding',
  domains: 'domains',
  navigation: 'domains',
  addresses: 'domains',
  payments: 'payments',
  payouts: 'payments',
  leo: 'leo',
  ai: 'leo',
  integrations: 'leo',
  connectors: 'leo',
  plan: 'plan',
  billing: 'plan',
  advanced: 'advanced',
  endeavor: 'advanced',
  developer: 'advanced',
}

function normalizeTab(raw: string | null | undefined): TabId {
  if (!raw) return 'branding'
  return TAB_ALIASES[raw.toLowerCase()] || 'branding'
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'branding', label: 'Branding & General' },
  { id: 'domains', label: 'Domain & Menu' },
  { id: 'payments', label: 'Payments & Payouts' },
  { id: 'leo', label: 'LEO & Integrations' },
  { id: 'plan', label: 'Plan & Billing' },
  { id: 'advanced', label: 'Advanced' },
]

interface BrandingData {
  siteName?: string
  tagline?: string
  logo?: { id: number | string; url: string } | null
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundColor?: string
  foregroundColor?: string
  borderColor?: string
  headingFont?: string
  bodyFont?: string
}

interface CommerceData {
  currency?: string
  taxRate?: number
}

interface StorefrontData {
  coverImage?: { id: number | string; url: string } | null
}

/** Every hostname this portal answers on. */
export interface DomainsData {
  slug: string
  domain: string
  aliases: { domain: string; isPrimary: boolean }[]
  canonical: string
}

export interface LeoProfileData {
  angelName: string
  displayName: string
  personality: string
  ragChunkCount: number
  ragVideoCount: number
  hasGoogleAiKey: boolean
  hasOpenRouterKey: boolean
  hasOpenAiKey: boolean
  hasNvidiaKey: boolean
  preferredImageProvider: string
}

export interface ConnectorSummary {
  id: string
  name: string
  type: string
  enabled: boolean
  status: string
  lastActivity: string | null
  errorMessage: string | null
  priority: number
  config: Record<string, unknown>
}

export interface PaymentsTabPayload {
  platformFeePercent: number
  tenantName: string
  squareConnected: boolean
  squareMerchantId: string | null
  squareMerchantName: string | null
  squareLocationId: string | null
  squareEnvironment: 'sandbox' | 'production'
  squareConnectedAt: string | null
  paypalConfigured: boolean
  availableProviders: Array<{
    id: 'square' | 'paypal'
    label: string
    environment: 'sandbox' | 'production'
  }>
  isSuperAdmin: boolean
  recentTransactions: Array<{
    id: number | string
    amount: number
    currency: string
    status: string
    paymentMethod: string | null
    customerEmail: string | null
    createdAt: string
  }>
  recentOrders: Array<{
    id: string
    total: number
    status: string
    createdAt: string
    customerEmail: string
  }>
  revenueData: TimeSeriesPoint[]
  platformFeeData: TimeSeriesPoint[]
}

export interface SettingsHubProps {
  tenantId: number
  isSuperAdmin: boolean
  portalPlan: PortalPlan
  branding: BrandingData
  commerce: CommerceData
  storefront?: StorefrontData
  domains?: DomainsData
  features?: { works?: boolean | null; pageComments?: boolean | null } | null
  leoProfile: LeoProfileData
  connectors: ConnectorSummary[]
  paymentsData: PaymentsTabPayload
}

const CURRENCIES = [
  { value: 'usd', label: 'USD ($)' },
  { value: 'cad', label: 'CAD (C$)' },
  { value: 'eur', label: 'EUR (€)' },
  { value: 'gbp', label: 'GBP (£)' },
  { value: 'aud', label: 'AUD (A$)' },
]

// ---------------------------------------------------------------------------
// Shared UI Helpers
// ---------------------------------------------------------------------------

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

function Toast({ message }: { message: { type: 'success' | 'error'; text: string } }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        message.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950'
          : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
      }`}
    >
      <p
        className={`text-sm ${
          message.type === 'success'
            ? 'text-emerald-800 dark:text-emerald-200'
            : 'text-red-800 dark:text-red-200'
        }`}
      >
        {message.text}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1: Branding & General
// ---------------------------------------------------------------------------

function BrandingTab({
  tenantId,
  branding,
  commerce,
  storefront,
  features,
}: {
  tenantId: number
  branding: BrandingData
  commerce: CommerceData
  storefront?: StorefrontData
  features?: { works?: boolean | null; pageComments?: boolean | null } | null
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    siteName: branding.siteName || '',
    tagline: branding.tagline || '',
    primaryColor: branding.primaryColor || '#10B981',
    secondaryColor: branding.secondaryColor || '#0078D4',
    accentColor: branding.accentColor || '#FF6B35',
    backgroundColor: branding.backgroundColor || '#FFFFFF',
    foregroundColor: branding.foregroundColor || '#1A1A1A',
    borderColor: branding.borderColor || '#E5E7EB',
    headingFont: branding.headingFont || 'inter',
    bodyFont: branding.bodyFont || 'inter',
    currency: commerce.currency || 'usd',
    taxRate: commerce.taxRate ?? 0,
    worksEnabled: features?.works ?? false,
    pageCommentsEnabled: features?.pageComments ?? false,
  })
  const [logo, setLogo] = useState<MediaValue>(branding.logo ?? null)
  const [coverImage, setCoverImage] = useState<MediaValue>(storefront?.coverImage ?? null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const res = await savePortalBrandingAndGeneral({
      siteName: form.siteName,
      tagline: form.tagline,
      logoId: logo ? Number(logo.id) : null,
      coverImageId: coverImage ? Number(coverImage.id) : null,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentColor: form.accentColor,
      backgroundColor: form.backgroundColor,
      foregroundColor: form.foregroundColor,
      borderColor: form.borderColor,
      headingFont: form.headingFont,
      bodyFont: form.bodyFont,
      currency: form.currency,
      taxRate: form.taxRate,
      worksEnabled: form.worksEnabled,
      pageCommentsEnabled: form.pageCommentsEnabled,
    })
    if (res.success) {
      setMessage({ type: 'success', text: 'Branding and general settings saved.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to save settings.' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-8">
      {message && <Toast message={message} />}

      {/* Site Identity (synced automatically to Site Profile) */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Site Identity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Single source of truth for your site header, hero banner, and public profile.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Site Name</label>
            <input
              type="text"
              value={form.siteName}
              onChange={(e) => updateField('siteName', e.target.value)}
              placeholder="My Channel or Store"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => updateField('tagline', e.target.value)}
              placeholder="What your site is all about"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <ImageField
              label="Logo"
              value={logo}
              onChange={setLogo}
              aspect="square"
              tenantId={tenantId}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Shown in your site header and dashboard sidebar. Synced to your directory badge unless overridden under Advanced.
            </p>
          </div>
          <div>
            <ImageField
              label="Cover Picture"
              value={coverImage}
              onChange={setCoverImage}
              aspect="banner"
              tenantId={tenantId}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Default wide banner behind your Shop, Posts &amp; Videos, and Events pages.
            </p>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Colors</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {([
            ['primaryColor', 'Primary'],
            ['secondaryColor', 'Secondary'],
            ['accentColor', 'Accent'],
            ['backgroundColor', 'Background'],
            ['foregroundColor', 'Foreground'],
            ['borderColor', 'Border'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={form[key]}
                onChange={(e) => updateField(key, e.target.value)}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              <div className="min-w-0 flex-1">
                <label className="block text-sm font-medium">{label}</label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Typography</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Heading Font</label>
            <select
              value={form.headingFont}
              onChange={(e) => updateField('headingFont', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {HEADING_FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Body Font</label>
            <select
              value={form.bodyFont}
              onChange={(e) => updateField('bodyFont', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {BODY_FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Commerce */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Commerce Defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.taxRate}
              onChange={(e) => updateField('taxRate', parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Optional Surfaces */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Optional Surfaces</h2>
        <p className="text-sm text-muted-foreground">
          Off by default. Turn on only the surfaces you actively publish.
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.worksEnabled}
            onChange={(e) => updateField('worksEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Works — long-form publishing (adds Works to your site header and sidebar)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.pageCommentsEnabled}
            onChange={(e) => updateField('pageCommentsEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Comments — let visitors comment on public pages (moderated)
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Domain & Menu (Domains & URL + Navigation overrides)
// ---------------------------------------------------------------------------

function DomainsPanel({
  initial,
  onUpgradeTab,
}: {
  initial: DomainsData
  onUpgradeTab: () => void
}) {
  const [domain, setDomain] = useState(initial.domain)
  const [bindings, setBindings] = useState(initial.aliases)
  const [canonical, setCanonical] = useState(initial.canonical)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsUpgrade, setNeedsUpgrade] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const send = useCallback(async (action: string, value: string, okText: string) => {
    setBusy(true)
    setMessage(null)
    setNeedsUpgrade(false)
    try {
      const res = await fetch('/api/domain-ops/bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, domain: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402 || data?.upgradeRequired) {
          setNeedsUpgrade(true)
        }
        setMessage({ type: 'error', text: data?.error || 'Could not save that domain.' })
        return
      }
      setDomain(data.domain)
      setBindings(data.bindings)
      setCanonical(data.canonical)
      setInput('')
      setMessage({ type: 'success', text: okText })
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }, [])

  const rows = [
    { domain, removable: false },
    ...bindings.map((b) => ({ domain: b.domain, removable: true })),
  ].filter((r, i, all) => r.domain && all.findIndex((x) => x.domain === r.domain) === i)

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Domains &amp; URL</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hostnames that serve this site and your canonical public link.
          </p>
        </div>
        <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          slug: {initial.slug}
        </code>
      </div>

      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.domain} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <a
              href={`https://${r.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline break-all font-medium"
            >
              {r.domain}
            </a>
            {r.domain === canonical ? (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                canonical
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => send('set-primary', r.domain, `${r.domain} is now your canonical URL.`)}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                make canonical
              </button>
            )}
            {r.removable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => send('remove', r.domain, `${r.domain} removed.`)}
                className="ml-auto text-xs text-muted-foreground hover:text-red-600 disabled:opacity-50"
              >
                remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim()) send('add', input, `${input.trim()} bound to this portal.`)
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="yourdomain.com"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add Domain
        </button>
      </form>

      {message && <Toast message={message} />}

      {needsUpgrade && (
        <button
          type="button"
          onClick={onUpgradeTab}
          className="text-xs font-medium text-primary underline"
        >
          View Plan &amp; Billing options →
        </button>
      )}

      <p className="text-xs text-muted-foreground">
        The canonical domain is used for outbound links, sharing previews, and SEO. Point a CNAME or
        DNS record at your portal host for custom domains to resolve.
      </p>
    </div>
  )
}

interface NavCandidate {
  url: string
  label: string
}

function NavigationTab() {
  const [candidates, setCandidates] = useState<NavCandidate[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const [pinned, setPinned] = useState<string[]>([])
  const [maxInline, setMaxInline] = useState<string>('')
  const [hideMore, setHideMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/nav-ops/overrides', { credentials: 'include' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json?.error || 'Could not load menu settings.')
        setCandidates(json.candidates || [])
        setHidden(json.overrides?.hidden || [])
        setPinned(json.overrides?.pinned || [])
        setMaxInline(
          typeof json.overrides?.maxInline === 'number' ? String(json.overrides.maxInline) : '',
        )
        setHideMore(Boolean(json.overrides?.hideMore))
      } catch (err) {
        if (!cancelled) {
          setMessage({
            type: 'error',
            text: err instanceof Error ? err.message : 'Could not load menu settings.',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (list: string[], setList: (v: string[]) => void, url: string) =>
    setList(list.includes(url) ? list.filter((u) => u !== url) : [...list, url])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/nav-ops/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hidden,
          pinned,
          ...(maxInline.trim() === '' ? {} : { maxInline: Number(maxInline) }),
          hideMore,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not save.')
      setMessage({ type: 'success', text: 'Menu saved. Reload your public site to see updates.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Could not save.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading your menu...</p>

  return (
    <div className="space-y-6">
      {message && <Toast message={message} />}

      <div className="rounded-lg border border-border bg-card p-6 space-y-4 text-card-foreground">
        <div>
          <h2 className="text-lg font-semibold">Top Navigation Menu</h2>
          <p className="text-sm text-muted-foreground">
            Your menu builds itself from published content — a shop appears once you publish a
            product. Choose any items to hide or keep pinned up front.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Menu item</th>
                <th className="pb-2 pr-4">Hide</th>
                <th className="pb-2">Keep up front</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.url} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <span className="font-medium">{c.label}</span>{' '}
                    <span className="text-xs text-muted-foreground">{c.url}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={hidden.includes(c.url)}
                      onChange={() => toggle(hidden, setHidden, c.url)}
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      disabled={hidden.includes(c.url)}
                      checked={pinned.includes(c.url)}
                      onChange={() => toggle(pinned, setPinned, c.url)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4 text-card-foreground">
        <h2 className="text-lg font-semibold">Bar Overflow</h2>
        <div>
          <label className="block text-sm font-medium mb-1">
            Items in the bar before &ldquo;More&rdquo;
          </label>
          <input
            type="number"
            min="0"
            max="12"
            placeholder="Leave empty to fit automatically"
            value={maxInline}
            onChange={(e) => setMaxInline(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Pinned items always stay visible regardless of this limit.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={hideMore}
            onChange={(e) => setHideMore(e.target.checked)}
          />
          Drop the &ldquo;More&rdquo; menu entirely (desktop only)
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Menu'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4: LEO & Integrations (Persona + Knowledge + Connectors + BYOK Drawer)
// ---------------------------------------------------------------------------

function LeoAndIntegrationsTab({
  tenantId,
  tenantName,
  leoProfile,
  connectors,
}: {
  tenantId: number
  tenantName: string
  leoProfile: LeoProfileData
  connectors: ConnectorSummary[]
}) {
  const router = useRouter()
  const [angelName, setAngelName] = useState(leoProfile.angelName || 'LEO')
  const [displayName, setDisplayName] = useState(leoProfile.displayName || '')
  const [personality, setPersonality] = useState(leoProfile.personality || '')
  const [savingPersona, setSavingPersona] = useState(false)
  const [personaMessage, setPersonaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [googleKey, setGoogleKey] = useState('')
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [openAiKey, setOpenAiKey] = useState('')
  const [nvidiaKey, setNvidiaKey] = useState('')
  const [preferredImageProvider, setPreferredImageProvider] = useState(
    leoProfile.preferredImageProvider || 'auto',
  )
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysMessage, setKeysMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const youtubeConnectors = connectors.filter((c) => c.type === 'youtube_channel')

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPersona(true)
    setPersonaMessage(null)
    const res = await saveLeoAndAiSettings({
      angelName,
      displayName,
      personality,
    })
    if (res.success) {
      setPersonaMessage({ type: 'success', text: 'LEO assistant persona updated.' })
      router.refresh()
    } else {
      setPersonaMessage({ type: 'error', text: res.error || 'Could not update LEO persona.' })
    }
    setSavingPersona(false)
  }

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingKeys(true)
    setKeysMessage(null)
    const res = await saveLeoAndAiSettings({
      ...(googleKey.trim() ? { googleAiApiKey: googleKey } : {}),
      ...(openRouterKey.trim() ? { openrouterApiKey: openRouterKey } : {}),
      ...(openAiKey.trim() ? { openaiApiKey: openAiKey } : {}),
      ...(nvidiaKey.trim() ? { nvidiaApiKey: nvidiaKey } : {}),
      preferredImageProvider,
    })
    if (res.success) {
      setGoogleKey('')
      setOpenRouterKey('')
      setOpenAiKey('')
      setNvidiaKey('')
      setKeysMessage({ type: 'success', text: 'AI provider settings saved.' })
      router.refresh()
    } else {
      setKeysMessage({ type: 'error', text: res.error || 'Could not save AI provider keys.' })
    }
    setSavingKeys(false)
  }

  const handleClearKey = async (
    field: 'clearGoogleKey' | 'clearOpenRouterKey' | 'clearOpenAiKey' | 'clearNvidiaKey',
    label: string,
  ) => {
    setSavingKeys(true)
    setKeysMessage(null)
    const res = await saveLeoAndAiSettings({ [field]: true })
    if (res.success) {
      setKeysMessage({ type: 'success', text: `${label} key removed — reverted to platform AI.` })
      router.refresh()
    } else {
      setKeysMessage({ type: 'error', text: res.error || 'Could not remove key.' })
    }
    setSavingKeys(false)
  }

  return (
    <div className="space-y-8">
      {/* Section 1: LEO Persona & Knowledge */}
      <form
        onSubmit={handleSavePersona}
        className="rounded-lg border border-border bg-card p-6 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">LEO Persona &amp; Knowledge</h2>
            <p className="text-sm text-muted-foreground">
              Customize how LEO greets visitors, answers questions, and manages {tenantName}.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Powered by Google Gemini
          </span>
        </div>

        {personaMessage && <Toast message={personaMessage} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Assistant Name</label>
            <input
              type="text"
              value={angelName}
              onChange={(e) => setAngelName(e.target.value)}
              placeholder="LEO"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Display Name in Chat</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="LEO — Studio Assistant"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Voice &amp; Instructions</label>
          <textarea
            rows={4}
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="Describe your channel tone, key topics, links, or policies LEO should follow when replying to visitors and members."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* YouTube & Knowledge Index Card */}
        <div className="rounded-md border border-border/70 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">YouTube &amp; Transcript Knowledge Index</p>
              <p className="text-xs text-muted-foreground">
                Published transcript blocks are automatically chunked and vector-indexed for LEO search.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <p className="font-semibold text-foreground">{leoProfile.ragVideoCount}</p>
                <p className="text-muted-foreground">Indexed videos</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{leoProfile.ragChunkCount}</p>
                <p className="text-muted-foreground">RAG chunks</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{youtubeConnectors.length}</p>
                <p className="text-muted-foreground">YT sources</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPersona}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingPersona ? 'Saving...' : 'Save LEO Persona'}
          </button>
        </div>
      </form>

      {/* Section 2: Connected Channels & Integrations */}
      <ConnectorsAdmin
        embedded
        connectors={connectors}
        tenantId={String(tenantId)}
        tenantName={tenantName}
      />

      {/* Section 3: Secondary Collapsed Drawer for BYOK AI Keys */}
      <details className="rounded-lg border border-border bg-card p-6">
        <summary className="cursor-pointer select-none text-sm font-semibold">
          Bring Your Own AI Keys (Optional BYOK)
        </summary>
        <form onSubmit={handleSaveKeys} className="mt-4 space-y-5">
          <p className="text-sm text-muted-foreground">
            Platform Gemini keys are included automatically. Add your own keys only if you want
            direct provider billing or higher dedicated quotas.
          </p>

          {keysMessage && <Toast message={keysMessage} />}

          {/* Google AI (Primary) */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Google AI (Gemini) API Key</h3>
                <p className="text-xs text-muted-foreground">
                  Primary chat, transcript RAG embeddings, and image generation.
                </p>
              </div>
              <StatusBadge
                active={leoProfile.hasGoogleAiKey}
                activeLabel="Custom key set"
                inactiveLabel="Using platform Gemini"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={googleKey}
                onChange={(e) => setGoogleKey(e.target.value)}
                placeholder={leoProfile.hasGoogleAiKey ? '••••••••••••••••' : 'AIza...'}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {leoProfile.hasGoogleAiKey && (
                <button
                  type="button"
                  disabled={savingKeys}
                  onClick={() => handleClearKey('clearGoogleKey', 'Google AI')}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* OpenRouter */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">OpenRouter API Key</h3>
                <p className="text-xs text-muted-foreground">
                  Optional multi-model routing fallback.
                </p>
              </div>
              <StatusBadge
                active={leoProfile.hasOpenRouterKey}
                activeLabel="Custom key set"
                inactiveLabel="Using platform default"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder={leoProfile.hasOpenRouterKey ? '••••••••••••••••' : 'sk-or-...'}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {leoProfile.hasOpenRouterKey && (
                <button
                  type="button"
                  disabled={savingKeys}
                  onClick={() => handleClearKey('clearOpenRouterKey', 'OpenRouter')}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* OpenAI + NVIDIA */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">OpenAI API Key</h3>
                <StatusBadge
                  active={leoProfile.hasOpenAiKey}
                  activeLabel="Active"
                  inactiveLabel="Unset"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  placeholder={leoProfile.hasOpenAiKey ? '••••••••••••••••' : 'sk-...'}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                {leoProfile.hasOpenAiKey && (
                  <button
                    type="button"
                    disabled={savingKeys}
                    onClick={() => handleClearKey('clearOpenAiKey', 'OpenAI')}
                    className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-md border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">NVIDIA NIM API Key</h3>
                <StatusBadge
                  active={leoProfile.hasNvidiaKey}
                  activeLabel="Active"
                  inactiveLabel="Unset"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={nvidiaKey}
                  onChange={(e) => setNvidiaKey(e.target.value)}
                  placeholder={leoProfile.hasNvidiaKey ? '••••••••••••••••' : 'nvapi-...'}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                {leoProfile.hasNvidiaKey && (
                  <button
                    type="button"
                    disabled={savingKeys}
                    onClick={() => handleClearKey('clearNvidiaKey', 'NVIDIA')}
                    className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Preferred Image Provider</label>
            <select
              value={preferredImageProvider}
              onChange={(e) => setPreferredImageProvider(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="auto">Auto (best available)</option>
              <option value="google">Google (Gemini / Imagen)</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI (DALL-E)</option>
              <option value="cloudflare">Cloudflare Workers AI</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingKeys}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {savingKeys ? 'Saving...' : 'Save AI Keys'}
            </button>
          </div>
        </form>
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 6 Helper: Developer & Agent Access (Railway-accurate, Sprint E preview)
// ---------------------------------------------------------------------------

function DeveloperAndAgentPanel({
  tenantSlug,
  canonicalDomain,
}: {
  tenantSlug: string
  canonicalDomain: string
}) {
  const [copied, setCopied] = useState(false)
  const serverUrl = canonicalDomain
    ? `https://${canonicalDomain}`
    : process.env.NEXT_PUBLIC_SERVER_URL || 'https://spacesangels.com'

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        'angel-os': {
          command: 'npx',
          args: ['tsx', 'mcp-server/index.ts'],
          cwd: '/path/to/angels-os',
          env: {
            ANGEL_OS_URL: serverUrl,
            ANGEL_OS_TENANT: tenantSlug || 'default',
          },
        },
      },
    },
    null,
    2,
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfig)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // non-fatal
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">External Agent &amp; MCP Access</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            OAuth 2.1 Remote MCP — Coming in Sprint E
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Antigravity, ChatGPT, Claude, or Cursor to LEO on this site over MCP so your
          external AI assistant can publish posts, update pages, and manage products securely.
        </p>
        <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">MCP Endpoint:</strong>{' '}
            <code>{serverUrl}/api/mcp</code>
          </p>
          <p>
            <strong className="text-foreground">Portal Slug:</strong>{' '}
            <code>{tenantSlug || 'default'}</code>
          </p>
        </div>
      </div>

      {/* Local Operator / Railway Quick Setup */}
      <details className="rounded-lg border border-border bg-card p-6">
        <summary className="cursor-pointer select-none text-sm font-semibold">
          Local Developer MCP Setup (Railway Core)
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">1. Load Railway Core variables</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Fetch your node&apos;s <code className="rounded bg-muted px-1 py-0.5 text-xs">PAYLOAD_SECRET</code> via the Railway CLI (never commit secrets):
            </p>
            <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto">
              railway variables -s Core --kv &gt; .env.local
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">2. Local stdio MCP config</h3>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
            <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto leading-relaxed">
              {mcpConfig}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Core LEO MCP Tools</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                ['leo_respond', 'Send conversational tasks directly to LEO'],
                ['query_posts', 'Browse posts, video episodes, and transcripts'],
                ['query_products', 'Search storefront products & pricing'],
                ['query_orders', 'Inspect orders & fulfillment status'],
                ['query_events', 'List scheduled events & registrations'],
                ['query_bookings', 'Check bookings & availability'],
                ['query_spaces', 'List community spaces & channels'],
                ['search_geo_archive', 'Search indexed transcripts & archive pins'],
              ].map(([name, desc]) => (
                <div key={name} className="flex items-start gap-2 text-xs">
                  <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono">{name}</code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsHub (Unified 6-Tab Export)
// ---------------------------------------------------------------------------

export function SettingsHub({
  tenantId,
  isSuperAdmin,
  portalPlan,
  branding,
  commerce,
  storefront,
  domains,
  features,
  leoProfile,
  connectors,
  paymentsData,
}: SettingsHubProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    normalizeTab(searchParams?.get('tab')),
  )

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams?.get('tab')))
  }, [searchParams])

  const selectTab = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId)
      router.replace(`${pathname}?tab=${tabId}`, { scroll: false })
    },
    [pathname, router],
  )

  return (
    <div className="space-y-6">
      {/* Header + Live Canonical Site URL Pill */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage branding, domains, payments, LEO AI, billing, and site profile in one place.
          </p>
        </div>
        {domains?.canonical && (
          <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <span className="text-muted-foreground">Live URL:</span>
            <a
              href={`https://${domains.canonical}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {domains.canonical} ↗
            </a>
            <button
              type="button"
              onClick={() => selectTab('domains')}
              className="ml-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium hover:bg-muted/80"
            >
              Domains
            </button>
          </div>
        )}
      </div>

      {/* 6-Tab Bar */}
      <div className="border-b border-border">
        <div className="flex gap-6 overflow-x-auto" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => selectTab(tab.id)}
              className={`relative whitespace-nowrap pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'branding' && (
          <BrandingTab
            tenantId={tenantId}
            branding={branding}
            commerce={commerce}
            storefront={storefront}
            features={features}
          />
        )}

        {activeTab === 'domains' && (
          <div className="space-y-8">
            {domains && (
              <DomainsPanel
                initial={domains}
                onUpgradeTab={() => selectTab('plan')}
              />
            )}
            <NavigationTab />
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-8">
            <PaymentsAdmin
              embedded
              tenantId={tenantId}
              tenantName={paymentsData.tenantName}
              squareConnected={paymentsData.squareConnected}
              squareMerchantId={paymentsData.squareMerchantId}
              squareMerchantName={paymentsData.squareMerchantName}
              squareLocationId={paymentsData.squareLocationId}
              squareEnvironment={paymentsData.squareEnvironment}
              squareConnectedAt={paymentsData.squareConnectedAt}
              availableProviders={paymentsData.availableProviders}
              isSuperAdmin={paymentsData.isSuperAdmin}
              recentTransactions={paymentsData.recentTransactions}
              platformFeePercent={paymentsData.platformFeePercent}
            />
            <PayoutsAdmin
              embedded
              squareConnected={paymentsData.squareConnected}
              squareMerchantId={paymentsData.squareMerchantId}
              squareMerchantName={paymentsData.squareMerchantName}
              squareEnvironment={paymentsData.squareEnvironment}
              paypalConfigured={paymentsData.paypalConfigured}
              recentOrders={paymentsData.recentOrders}
              tenantName={paymentsData.tenantName}
              platformFeePercent={paymentsData.platformFeePercent}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <RevenueChart data={paymentsData.revenueData} />
              {isSuperAdmin && <PlatformFeeChart data={paymentsData.platformFeeData} />}
            </div>
          </div>
        )}

        {activeTab === 'leo' && (
          <LeoAndIntegrationsTab
            tenantId={tenantId}
            tenantName={branding.siteName || paymentsData.tenantName}
            leoProfile={leoProfile}
            connectors={connectors}
          />
        )}

        {activeTab === 'plan' && (
          <PlanPanel
            embedded
            plan={portalPlan}
            tenantName={branding.siteName || paymentsData.tenantName}
          />
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-8">
            <EndeavorSetup
              mode="advanced"
              isSuperAdmin={isSuperAdmin}
              siteBranding={{
                siteName: branding.siteName,
                tagline: branding.tagline,
                logo: branding.logo ?? null,
                coverImage: storefront?.coverImage ?? null,
              }}
            />
            <DeveloperAndAgentPanel
              tenantSlug={domains?.slug || ''}
              canonicalDomain={domains?.canonical || ''}
            />
          </div>
        )}
      </div>
    </div>
  )
}
