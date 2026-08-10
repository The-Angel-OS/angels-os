'use client'

import React, { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import EndeavorSetup, { ImageField, type MediaValue } from '@/app/[locale]/(dashboard)/dashboard/endeavor/EndeavorSetup'
import { HEADING_FONTS, BODY_FONTS } from '@/config/brandingOptions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'general' | 'endeavor' | 'ai' | 'developer'

interface BrandingData {
  siteName?: string
  tagline?: string
  /** Site header logo (tenant.branding.logo) — NOT the Discovery Card badge. */
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
  shippingEnabled?: boolean
  bookingsEnabled?: boolean
  eventsEnabled?: boolean
  digitalProductsEnabled?: boolean
}

interface StorefrontData {
  /**
   * tenant.storefront.coverImage — the hero behind Shop, Posts and Events.
   * Per-section overrides (postsHeroImage / eventsHeroImage / shopHeroImage)
   * stay in Payload admin: they are the exception, this is the setting.
   */
  coverImage?: { id: number | string; url: string } | null
}

export interface SettingsHubProps {
  tenantId: number
  hasAnthropicKey: boolean
  hasOpenRouterKey: boolean
  branding: BrandingData
  commerce: CommerceData
  storefront?: StorefrontData
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Font catalogs now live in one place — src/config/brandingOptions.ts (53).

const CURRENCIES = [
  { value: 'usd', label: 'USD ($)' },
  { value: 'cad', label: 'CAD (C$)' },
  { value: 'eur', label: 'EUR (€)' },
  { value: 'gbp', label: 'GBP (£)' },
  { value: 'aud', label: 'AUD (A$)' },
]

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'endeavor', label: 'Endeavor' },
  { id: 'ai', label: 'AI' },
  { id: 'developer', label: 'Developer' },
]

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
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

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

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
// GeneralTab
// ---------------------------------------------------------------------------

function GeneralTab({ tenantId, branding, commerce, storefront }: { tenantId: number; branding: BrandingData; commerce: CommerceData; storefront?: StorefrontData }) {
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
    shippingEnabled: commerce.shippingEnabled ?? false,
    bookingsEnabled: commerce.bookingsEnabled ?? false,
    eventsEnabled: commerce.eventsEnabled ?? false,
    digitalProductsEnabled: commerce.digitalProductsEnabled ?? false,
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
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding: {
            logo: logo ? Number(logo.id) : null,
            siteName: form.siteName,
            tagline: form.tagline,
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            accentColor: form.accentColor,
            backgroundColor: form.backgroundColor,
            foregroundColor: form.foregroundColor,
            borderColor: form.borderColor,
            headingFont: form.headingFont,
            bodyFont: form.bodyFont,
          },
          // Only the one subfield: a 260809 probe on a spare tenant confirmed
          // Payload MERGES partial group writes, so description/contactEmail and
          // the per-section overrides all survive this.
          storefront: {
            coverImage: coverImage ? Number(coverImage.id) : null,
          },
          commerce: {
            currency: form.currency,
            taxRate: form.taxRate,
            shippingEnabled: form.shippingEnabled,
            bookingsEnabled: form.bookingsEnabled,
            eventsEnabled: form.eventsEnabled,
            digitalProductsEnabled: form.digitalProductsEnabled,
          },
        }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save. Check your permissions.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {message && <Toast message={message} />}

      {/* Site Identity */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Site Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Site Name</label>
            <input
              type="text"
              value={form.siteName}
              onChange={(e) => updateField('siteName', e.target.value)}
              placeholder="My Store"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => updateField('tagline', e.target.value)}
              placeholder="Your tagline here"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="max-w-sm">
          <ImageField
            label="Site Logo (shown in the site header)"
            value={logo}
            onChange={setLogo}
            aspect="square"
            tenantId={tenantId}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Different from the Discovery Card badge on the Endeavor tab — that one is your
            federation catalog badge.
          </p>
        </div>
        <div className="max-w-sm">
          <ImageField
            label="Cover Image (Shop, Posts and Events)"
            value={coverImage}
            onChange={setCoverImage}
            aspect="banner"
            tenantId={tenantId}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The banner behind your listing pages. Leave empty for the brand gradient built from
            your colours. To give one section its own image, set a per-section override in
            Admin → Tenants → Storefront.
          </p>
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
                <option key={f.value} value={f.value}>{f.label}</option>
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
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Commerce */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Commerce</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
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
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          {([
            ['shippingEnabled', 'Shipping'],
            ['bookingsEnabled', 'Bookings'],
            ['eventsEnabled', 'Events'],
            ['digitalProductsEnabled', 'Digital Products'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => updateField(key, e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Enable {label}
            </label>
          ))}
        </div>
      </div>

      {/* Save button */}
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
// AITab (preserved from original AISettingsAdmin)
// ---------------------------------------------------------------------------

function AITab({ tenantId, hasAnthropicKey, hasOpenRouterKey }: { tenantId: number; hasAnthropicKey: boolean; hasOpenRouterKey: boolean }) {
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async (keyType: 'anthropic' | 'openrouter') => {
    setSaving(true)
    setMessage(null)

    const key = keyType === 'anthropic' ? anthropicKey : openRouterKey
    if (!key.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid API key.' })
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiConfig: {
            ...(keyType === 'anthropic'
              ? { anthropicApiKey: key }
              : { openrouterApiKey: key }),
          },
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: `${keyType === 'anthropic' ? 'Anthropic' : 'OpenRouter'} key saved.` })
        if (keyType === 'anthropic') setAnthropicKey('')
        else setOpenRouterKey('')
      } else {
        setMessage({ type: 'error', text: 'Failed to save. Check your permissions.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && <Toast message={message} />}

      <p className="text-muted-foreground text-sm">
        Bring your own API keys for LEO and image generation. When set, your keys are used
        instead of platform keys — giving you full control over costs and usage limits.
      </p>

      {/* Anthropic */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Anthropic API Key</h2>
            <p className="text-sm text-muted-foreground">
              Used for LEO conversations (Claude).
            </p>
          </div>
          <StatusBadge active={hasAnthropicKey} activeLabel="Active" inactiveLabel="Using platform key" />
        </div>
        <div className="flex gap-3">
          <input
            type="password"
            placeholder={hasAnthropicKey ? '••••••••••••••••' : 'sk-ant-...'}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => handleSave('anthropic')}
            disabled={saving || !anthropicKey.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* OpenRouter */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">OpenRouter API Key</h2>
            <p className="text-sm text-muted-foreground">
              Used for image generation (Flux, Gemini).
            </p>
          </div>
          <StatusBadge active={hasOpenRouterKey} activeLabel="Active" inactiveLabel="Using platform key" />
        </div>
        <div className="flex gap-3">
          <input
            type="password"
            placeholder={hasOpenRouterKey ? '••••••••••••••••' : 'sk-or-...'}
            value={openRouterKey}
            onChange={(e) => setOpenRouterKey(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => handleSave('openrouter')}
            disabled={saving || !openRouterKey.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-sm font-medium mb-2">How it works</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Keys are encrypted at rest and never exposed after saving</li>
          <li>LEO checks your tenant config first, then falls back to the platform key</li>
          <li>You can remove a key at any time to switch back to platform-provided AI</li>
          <li>Usage on your own keys is billed directly by the provider</li>
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeveloperTab
// ---------------------------------------------------------------------------

function DeveloperTab() {
  const [copied, setCopied] = useState(false)

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        'angel-os': {
          command: 'npx',
          args: ['tsx', 'mcp-server/index.ts'],
          cwd: '/path/to/angels-os',
          env: {
            ANGEL_OS_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'https://your-angel-os-node',
            ANGEL_OS_TENANT: 'default',
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
      // fallback
      const ta = document.createElement('textarea')
      ta.value = mcpConfig
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Connect Claude Code to Angel OS via the MCP (Model Context Protocol) server. This allows
        Claude to talk directly to Merlin, query products, orders, and more.
      </p>

      {/* Quick Setup */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Quick Setup</h2>
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium mb-1">1. Pull environment variables</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Run this in your project root to get your <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> with the PAYLOAD_SECRET:
            </p>
            <pre className="rounded-md bg-muted p-3 text-sm font-mono overflow-x-auto">
              npx vercel env pull .env.local
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">2. Open Claude Code in the project</h3>
            <p className="text-sm text-muted-foreground">
              The <code className="rounded bg-muted px-1 py-0.5 text-xs">.mcp.json</code> file auto-configures the server.
              Authentication is derived from <code className="rounded bg-muted px-1 py-0.5 text-xs">PAYLOAD_SECRET</code> in your .env.local — no extra API keys needed.
            </p>
          </div>
        </div>
      </div>

      {/* MCP Config */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">MCP Server Config</h2>
          <button
            onClick={handleCopy}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="rounded-md bg-muted p-4 text-sm font-mono overflow-x-auto leading-relaxed">
          {mcpConfig}
        </pre>
      </div>

      {/* Available Tools */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Available MCP Tools</h2>
        <div className="grid gap-2">
          {[
            ['talk_to_merlin', 'Send messages to Merlin (LEO) and get AI responses'],
            ['list_products', 'Browse and search storefront products'],
            ['get_product', 'Get full details of a single product'],
            ['create_product', 'Create new products in the storefront'],
            ['list_orders', 'View orders with status and customer info'],
            ['list_posts', 'Browse blog posts'],
            ['list_spaces', 'List collaboration spaces'],
            ['list_events', 'List events (tour stops, meetups, workshops, livestreams)'],
            ['get_event', 'Get full details of a single event'],
            ['create_event', 'Create new events (meetups, workshops, etc.)'],
            ['list_event_registrations', 'View registrations for an event'],
            ['search_content', 'Full-text search across products, posts, pages, and events'],
          ].map(([name, desc]) => (
            <div key={name} className="flex items-start gap-2 text-sm">
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{name}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-sm font-medium mb-2">Connection Info</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li><span className="font-medium text-foreground">Transport:</span> stdio (Claude Code manages lifecycle)</li>
          <li><span className="font-medium text-foreground">Auth:</span> Auto-JWT from PAYLOAD_SECRET or ANGEL_OS_API_KEY</li>
          <li><span className="font-medium text-foreground">Endpoint:</span> {process.env.NEXT_PUBLIC_SERVER_URL || 'https://your-angel-os-node'}</li>
          <li><span className="font-medium text-foreground">Tenant:</span> default</li>
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsHub (main export)
// ---------------------------------------------------------------------------

export function SettingsHub({
  tenantId,
  hasAnthropicKey,
  hasOpenRouterKey,
  branding,
  commerce,
  storefront,
}: SettingsHubProps) {
  // Deep-linkable: /dashboard/admin/settings?tab=endeavor lands on the Endeavor
  // tab. Legacy /dashboard/endeavor redirects here with that param, so LEO's
  // navDirective('/dashboard/endeavor') calls still open the right pane.
  const searchParams = useSearchParams()
  const initialTab = ((): TabId => {
    const t = searchParams?.get('tab')
    return TABS.some((tab) => tab.id === t) ? (t as TabId) : 'general'
  })()
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your site identity, AI configuration, and developer integrations.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border">
        <div className="flex gap-6" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 text-sm font-medium transition-colors ${
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

      {/* Tab content */}
      <div>
        {activeTab === 'general' && (
          <GeneralTab tenantId={tenantId} branding={branding} commerce={commerce} storefront={storefront} />
        )}
        {activeTab === 'endeavor' && <EndeavorSetup />}
        {activeTab === 'ai' && (
          <AITab tenantId={tenantId} hasAnthropicKey={hasAnthropicKey} hasOpenRouterKey={hasOpenRouterKey} />
        )}
        {activeTab === 'developer' && <DeveloperTab />}
      </div>
    </div>
  )
}
