'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EndeavorSetup, { ImageField, type MediaValue } from '@/app/[locale]/(dashboard)/dashboard/endeavor/EndeavorSetup'
import { HEADING_FONTS, BODY_FONTS } from '@/config/brandingOptions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'general' | 'navigation' | 'endeavor' | 'ai' | 'developer'

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

/** Every hostname this portal answers on. Read-only — binding is super_admin work. */
export interface AddressesData {
  slug: string
  /** Primary domain from the Tenants record. */
  domain: string
  /** Bound aliases (Tenants.domains[]), each already resolving via fetchTenantByDomain. */
  aliases: { domain: string; isPrimary: boolean }[]
  /** The one used for outbound links (canonical): a primary alias, else `domain`. */
  canonical: string
}

export interface SettingsHubProps {
  tenantId: number
  hasAnthropicKey: boolean
  hasOpenRouterKey: boolean
  branding: BrandingData
  commerce: CommerceData
  storefront?: StorefrontData
  addresses?: AddressesData
  /** tenant.features — optional surfaces this portal has switched on. */
  features?: { works?: boolean | null; pageComments?: boolean | null } | null
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
  { id: 'navigation', label: 'Navigation' },
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

function GeneralTab({ tenantId, branding, commerce, storefront, features }: { tenantId: number; branding: BrandingData; commerce: CommerceData; storefront?: StorefrontData; features?: { works?: boolean | null; pageComments?: boolean | null } | null }) {
  // Switching tabs UNMOUNTS this form (the tab bar renders `activeTab === 'x' &&`),
  // so coming back re-runs every useState initialiser against the props from the
  // ORIGINAL server render. Without this refresh those props predate the save, and
  // an owner who uploaded a logo, saved, and clicked away and back was shown the
  // old value — identical to the save having failed, which is what it looked like.
  // The tenant afterChange hook busts the 120s tenant cache, so this re-read is fresh.
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
    shippingEnabled: commerce.shippingEnabled ?? false,
    bookingsEnabled: commerce.bookingsEnabled ?? false,
    eventsEnabled: commerce.eventsEnabled ?? false,
    digitalProductsEnabled: commerce.digitalProductsEnabled ?? false,
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
          features: { works: form.worksEnabled, pageComments: form.pageCommentsEnabled },
        }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved.' })
        router.refresh()
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
            label="Your logo"
            value={logo}
            onChange={setLogo}
            aspect="square"
            tenantId={tenantId}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            <strong>Shown in the header of your own website.</strong> This is not the same
            picture as the one in your directory listing — that one is on the Endeavor tab,
            and it is what other sites show when they link to you.
          </p>
        </div>
        <div className="max-w-sm">
          <ImageField
            label="Your cover picture"
            value={coverImage}
            onChange={setCoverImage}
            aspect="banner"
            tenantId={tenantId}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            <strong>The wide banner across the top of your shop, posts and events pages.</strong>
            Leave it empty and those pages use a gradient built from your colours instead. To
            give one section its own picture, set a per-section override in Admin → Tenants →
            Storefront.
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

      {/* Optional surfaces — what this portal WANTS on, not what it pays for. */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Optional Surfaces</h2>
        <p className="text-sm text-muted-foreground">
          Off by default. Turn one on only if you will actually use it.
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.worksEnabled}
            onChange={(e) => updateField('worksEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Works — long-form publishing (adds Works to your menu and dashboard)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.pageCommentsEnabled}
            onChange={(e) => updateField('pageCommentsEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Comments — let visitors comment on any page (moderated)
        </label>
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
  addresses,
  features,
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

      {/* Addresses — first thing on the page, because "what is my URL" is the
          question every portal owner asks first and nothing here answered it.
          Read-only: binding a hostname is super_admin work, and a portal that
          could rename its own address could take another's traffic. */}
      {addresses && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-semibold">Addresses</h2>
            <code className="text-xs text-muted-foreground">{addresses.slug}</code>
          </div>
          <ul className="space-y-1.5 text-sm">
            {[
              { domain: addresses.domain, isPrimary: false },
              ...addresses.aliases,
            ]
              // A tenant may list its primary domain in domains[] as well.
              .filter((a, i, all) => a.domain && all.findIndex((x) => x.domain === a.domain) === i)
              .map((a) => (
                <li key={a.domain} className="flex items-center gap-2">
                  <a
                    href={`https://${a.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {a.domain}
                  </a>
                  {a.domain === addresses.canonical && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      canonical
                    </span>
                  )}
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            All of these reach this portal. The canonical one is used for outbound links,
            sharing previews and SEO. Ask an administrator to bind another address.
          </p>
        </div>
      )}

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
          <GeneralTab tenantId={tenantId} branding={branding} commerce={commerce} storefront={storefront} features={features} />
        )}
        {activeTab === 'navigation' && <NavigationTab />}
        {activeTab === 'endeavor' && <EndeavorSetup />}
        {activeTab === 'ai' && (
          <AITab tenantId={tenantId} hasAnthropicKey={hasAnthropicKey} hasOpenRouterKey={hasOpenRouterKey} />
        )}
        {activeTab === 'developer' && <DeveloperTab />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NavigationTab
// ---------------------------------------------------------------------------

interface NavCandidate {
  url: string
  label: string
}

/**
 * The owner's intent layer over a menu that otherwise configures itself.
 *
 * The menu derives what it can: Shop appears when there are products, Posts
 * when there are posts. Those signals are deliberately NOT mirrored here — a
 * settings screen repeating them would be a second source of truth for the same
 * fact, and the menu would then be wrong in two places instead of one. These
 * three are what derivation cannot know, and until now only LEO could set them.
 */
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
        if (!res.ok) throw new Error(json?.error || 'Could not load the menu settings.')
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
            text: err instanceof Error ? err.message : 'Could not load the menu settings.',
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
          // Empty means "no cap". Send nothing rather than a zero — zero is a
          // real and different instruction (the bar holds exactly the pins).
          ...(maxInline.trim() === '' ? {} : { maxInline: Number(maxInline) }),
          hideMore,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not save.')
      setMessage({ type: 'success', text: 'Menu saved. Reload your site to see it.' })
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
          <h2 className="text-lg font-semibold">Top menu</h2>
          <p className="text-sm text-muted-foreground">
            Your menu builds itself from what you have &mdash; a shop appears once you publish a
            product. These are the choices it cannot make for you.
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
                      // Hiding wins over pinning, so disable rather than let
                      // someone set two instructions that contradict.
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
        <h2 className="text-lg font-semibold">How much fits</h2>
        <div>
          <label className="block text-sm font-medium mb-1">
            Items in the bar before &ldquo;More&rdquo;
          </label>
          <input
            type="number"
            min="0"
            max="12"
            placeholder="Leave empty to fit as many as will fit"
            value={maxInline}
            onChange={(e) => setMaxInline(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Anything you kept up front ignores this limit. Set it to 0 to show only those.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={hideMore}
            onChange={(e) => setHideMore(e.target.checked)}
          />
          Drop the &ldquo;More&rdquo; menu entirely (desktop only &mdash; phones still list
          everything)
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
