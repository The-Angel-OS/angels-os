'use client'

import React, { useState, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────

interface ConnectorItem {
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

interface ConnectorsAdminProps {
  connectors: ConnectorItem[]
  tenantId: string
  tenantName: string
}

// ─── Connector Type Catalog ──────────────────────────────────

interface ConnectorTypeDef {
  type: string
  label: string
  icon: string
  description: string
  category: 'messaging' | 'email' | 'voice' | 'integration'
  fields: Array<{
    key: string
    label: string
    type: 'text' | 'password' | 'number' | 'select'
    placeholder?: string
    required?: boolean
    options?: Array<{ label: string; value: string }>
    helpText?: string
  }>
}

const CONNECTOR_CATALOG: ConnectorTypeDef[] = [
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    icon: '📱',
    description: 'Connect a WhatsApp Business account to receive and respond to messages via LEO.',
    category: 'messaging',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [{ label: 'Meta Cloud API', value: 'meta' }], required: true },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', placeholder: '123456789012345', required: true, helpText: 'From Meta Business Suite → WhatsApp → API Setup' },
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'EAAx...', required: true, helpText: 'Permanent access token from Meta Developer Portal' },
      { key: 'verifyToken', label: 'Webhook Verify Token', type: 'text', placeholder: 'my-custom-verify-token', required: true, helpText: 'Custom string you set when configuring the webhook in Meta' },
      { key: 'appSecret', label: 'App Secret', type: 'password', placeholder: 'abc123...', helpText: 'For webhook signature verification (recommended)' },
      { key: 'businessName', label: 'Business Name', type: 'text', placeholder: 'My Business' },
    ],
  },
  {
    type: 'discord',
    label: 'Discord',
    icon: '🎮',
    description: 'Connect a Discord bot to bridge server messages to LEO.',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'MTIzNDU2Nzg5...', required: true },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'Generate a secure random string', required: true },
      { key: 'guildId', label: 'Server (Guild) ID', type: 'text', placeholder: '123456789012345678', helpText: 'Right-click server → Copy Server ID' },
    ],
  },
  {
    type: 'slack',
    label: 'Slack',
    icon: '💼',
    description: 'Connect a Slack workspace bot to receive and send messages via LEO.',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token (xoxb-...)', type: 'password', placeholder: 'xoxb-...', required: true, helpText: 'From Slack App → OAuth & Permissions' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password', placeholder: 'abc123...', required: true, helpText: 'From Slack App → Basic Information' },
    ],
  },
  {
    type: 'email_inbound',
    label: 'Email Inbound (IMAP)',
    icon: '📨',
    description: 'Poll an email inbox via IMAP. LEO reads and responds to incoming emails.',
    category: 'email',
    fields: [
      { key: 'emailAddress', label: 'Email Address', type: 'text', placeholder: 'hello@yourbusiness.com', required: true },
      { key: 'password', label: 'Email Password', type: 'password', required: true },
      { key: 'displayName', label: 'Display Name', type: 'text', placeholder: 'My Business' },
      { key: 'imapHost', label: 'IMAP Host', type: 'text', placeholder: 'imap.ionos.com' },
      { key: 'imapPort', label: 'IMAP Port', type: 'number', placeholder: '993' },
    ],
  },
  {
    type: 'email_outbound',
    label: 'Email Outbound',
    icon: '📤',
    description: 'Send transactional emails (invitations, confirmations) from your own domain.',
    category: 'email',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [{ label: 'Resend', value: 'resend' }, { label: 'SMTP', value: 'smtp' }], required: true },
      { key: 'fromAddress', label: 'From Address', type: 'text', placeholder: 'hello@yourbusiness.com', required: true },
      { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'My Business' },
      { key: 'apiKey', label: 'Resend API Key', type: 'password', placeholder: 're_xxx', helpText: 'Required for Resend provider' },
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', placeholder: 'smtp.yourdomain.com', helpText: 'Required for SMTP provider' },
      { key: 'smtpPort', label: 'SMTP Port', type: 'number', placeholder: '587', helpText: 'Usually 587 (TLS) or 465 (SSL)' },
      { key: 'smtpUser', label: 'SMTP Username', type: 'text', helpText: 'Required for SMTP provider' },
      { key: 'smtpPass', label: 'SMTP Password', type: 'password', helpText: 'Required for SMTP provider' },
    ],
  },
  {
    type: 'sms',
    label: 'SMS (Twilio)',
    icon: '📲',
    description: 'Send and receive SMS messages via Twilio.',
    category: 'messaging',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxxxx', required: true },
      { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
      { key: 'phoneNumber', label: 'Phone Number', type: 'text', placeholder: '+15551234567', required: true, helpText: 'Your Twilio phone number' },
    ],
  },
  {
    type: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    description: 'Connect a Telegram bot to bridge messages to LEO.',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF...', required: true, helpText: 'From @BotFather on Telegram' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
    ],
  },
  {
    type: 'google_chat',
    label: 'Google Chat',
    icon: '💬',
    description: 'Connect Google Chat to receive workspace messages via LEO.',
    category: 'messaging',
    fields: [
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: true, helpText: 'Shared secret for HMAC verification' },
      { key: 'projectId', label: 'Google Cloud Project ID', type: 'text', placeholder: 'my-project-123', helpText: 'From Google Cloud Console' },
      { key: 'spaceId', label: 'Google Chat Space ID', type: 'text', placeholder: 'spaces/AAAA...', helpText: 'The Chat space to bridge' },
    ],
  },
  {
    type: 'webhook',
    label: 'Custom Webhook',
    icon: '🔗',
    description: 'Generic inbound webhook for custom integrations.',
    category: 'integration',
    fields: [
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: true },
      { key: 'callbackUrl', label: 'Reply Callback URL', type: 'text', placeholder: 'https://your-service.com/callback' },
    ],
  },
  {
    type: 'gotify',
    label: 'Gotify',
    icon: '🔔',
    description:
      'Push notifications to/from a Gotify server. Receives alerts (e.g. Uptime-Kuma) onto the AI Bus, sends Angel OS events out. Multiple Gotify connectors per tenant are supported — each with its own server + tokens.',
    category: 'integration',
    fields: [
      { key: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'https://gotify.kendev.co', required: true },
      { key: 'appToken', label: 'App Token (send, A…)', type: 'password', placeholder: 'A…', helpText: 'Gotify → Apps. Used to PUSH Angel OS events out.' },
      { key: 'clientToken', label: 'Client Token (receive, C…)', type: 'password', placeholder: 'C…', helpText: 'Gotify → Clients. Used to POLL inbound messages onto the AI Bus.' },
      { key: 'limit', label: 'Poll Limit', type: 'number', placeholder: '50', helpText: 'Max messages fetched per poll (1–200).' },
      // ── Escalation policy (dotted keys → nested config.escalation) ──
      { key: 'escalation.enabled', label: 'Escalation: Master Switch', type: 'select', options: [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }], helpText: 'Push Angel OS events to this Gotify.' },
      { key: 'escalation.events.error.enabled', label: 'Push: Errors', type: 'select', options: [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }] },
      { key: 'escalation.events.error.minPriority', label: 'Errors: Min Priority (0–10)', type: 'number', placeholder: '8' },
      { key: 'escalation.events.warning.enabled', label: 'Push: Warnings', type: 'select', options: [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }] },
      { key: 'escalation.events.budget_exceeded.enabled', label: 'Push: AI Budget Exceeded', type: 'select', options: [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }] },
      { key: 'escalation.events.provider_failover.enabled', label: 'Push: Provider Failover', type: 'select', options: [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }] },
      { key: 'escalation.rateLimitPerMin', label: 'Rate Limit (per min)', type: 'number', placeholder: '10', helpText: 'Caps the flap-storm.' },
      { key: 'escalation.cooldownSeconds', label: 'Dedupe Cooldown (sec)', type: 'number', placeholder: '300' },
    ],
  },
]

// ─── Connector Status Utilities ──────────────────────────────

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    provisioning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.paused}`}>
      {status === 'active' && '● '}
      {status === 'error' && '⚠ '}
      {status}
    </span>
  )
}

function typeLabel(type: string): { label: string; icon: string } {
  const def = CONNECTOR_CATALOG.find((c) => c.type === type)
  return def ? { label: def.label, icon: def.icon } : { label: type, icon: '🔌' }
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ─── Main Component ──────────────────────────────────────────

export function ConnectorsAdmin({ connectors: initialConnectors, tenantId, tenantName }: ConnectorsAdminProps) {
  const [connectors, setConnectors] = useState(initialConnectors)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [selectedType, setSelectedType] = useState<ConnectorTypeDef | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [connectorName, setConnectorName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { status: string; message: string; latencyMs?: number }>>({})

  // ── Add Connector ──────────────────────────────────────────
  const handleSelectType = useCallback((typeDef: ConnectorTypeDef) => {
    setSelectedType(typeDef)
    setFormValues({})
    setConnectorName('')
    setSaveError('')
  }, [])

  const handleSaveConnector = useCallback(async () => {
    if (!selectedType || !tenantId) return
    setSaving(true)
    setSaveError('')

    try {
      const name = connectorName.trim() || `${selectedType.label} Connector`

      // Build config from form values. Dotted keys (e.g. "escalation.events.error.enabled")
      // are folded into nested objects so connectors can declare structured config
      // through the same flat field form. Boolean-ish selects ('true'/'false') coerce.
      const config: Record<string, unknown> = {}
      const assignNested = (target: Record<string, unknown>, path: string, value: unknown) => {
        const parts = path.split('.')
        let node = target
        for (let i = 0; i < parts.length - 1; i++) {
          const k = parts[i]
          if (typeof node[k] !== 'object' || node[k] === null) node[k] = {}
          node = node[k] as Record<string, unknown>
        }
        node[parts[parts.length - 1]] = value
      }
      for (const field of selectedType.fields) {
        const val = formValues[field.key]
        if (val === undefined || val === '') continue
        let coerced: unknown = val
        if (field.type === 'number') coerced = Number(val)
        else if (val === 'true') coerced = true
        else if (val === 'false') coerced = false
        assignNested(config, field.key, coerced)
      }

      // Validate required fields
      const missing = selectedType.fields
        .filter((f) => f.required && !formValues[f.key]?.trim())
        .map((f) => f.label)

      if (missing.length > 0) {
        setSaveError(`Missing required fields: ${missing.join(', ')}`)
        setSaving(false)
        return
      }

      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: selectedType.type,
          enabled: true,
          status: 'active',
          priority: 10,
          config,
          tenant: Number(tenantId),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ errors: [{ message: 'Failed to create connector' }] }))
        throw new Error(err.errors?.[0]?.message || 'Failed to create connector')
      }

      const created = await res.json()
      setConnectors((prev) => [
        ...prev,
        {
          id: String(created.doc?.id || created.id),
          name,
          type: selectedType.type,
          enabled: true,
          status: 'active',
          lastActivity: null,
          errorMessage: null,
          priority: 10,
          config,
        },
      ])

      // Reset form
      setSelectedType(null)
      setShowAddPanel(false)
      setFormValues({})
      setConnectorName('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save connector')
    } finally {
      setSaving(false)
    }
  }, [selectedType, tenantId, connectorName, formValues])

  // ── Toggle Connector ───────────────────────────────────────
  const handleToggle = useCallback(async (id: string, currentEnabled: boolean) => {
    setToggleLoading(id)
    try {
      const res = await fetch(`/api/connectors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })

      if (res.ok) {
        setConnectors((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, enabled: !currentEnabled, status: !currentEnabled ? 'active' : 'paused' } : c,
          ),
        )
      }
    } catch {
      // Non-critical
    } finally {
      setToggleLoading(null)
    }
  }, [])

  // ── Delete Connector ───────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/connectors/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setConnectors((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {
      // Non-critical
    } finally {
      setDeleteConfirm(null)
    }
  }, [])

  // ── Test Connector ────────────────────────────────────────
  const handleTest = useCallback(async (id: string) => {
    setTesting(id)
    setTestResult((prev) => ({ ...prev, [id]: { status: 'testing', message: 'Testing...' } }))
    try {
      const res = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId: id }),
      })
      const data = (await res.json()) as { status: string; message: string; latencyMs?: number }
      setTestResult((prev) => ({ ...prev, [id]: data }))
      if (data.status === 'ok') {
        setConnectors((prev) => prev.map((c) =>
          c.id === id ? { ...c, status: 'active', errorMessage: null } : c,
        ))
      } else {
        setConnectors((prev) => prev.map((c) =>
          c.id === id ? { ...c, status: 'error', errorMessage: data.message } : c,
        ))
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { status: 'error', message: 'Network error' } }))
    } finally {
      setTesting(null)
    }
  }, [])

  // ── Group connectors by category ───────────────────────────
  const grouped = connectors.reduce<Record<string, ConnectorItem[]>>((acc, c) => {
    const def = CONNECTOR_CATALOG.find((d) => d.type === c.type)
    const cat = def?.category || 'integration'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {})

  const categoryLabels: Record<string, string> = {
    messaging: '💬 Messaging',
    email: '📧 Email',
    voice: '🎙️ Voice',
    integration: '🔗 Integrations',
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connectors</h1>
          <p className="text-muted-foreground">
            Manage integrations for {tenantName}. Connect messaging platforms, email,
            and other services to LEO.
          </p>
        </div>
        <button
          onClick={() => { setShowAddPanel(!showAddPanel); setSelectedType(null) }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Connector
        </button>
      </div>

      {/* ─── Add Connector Panel ────────────────────────────── */}
      {showAddPanel && (
        <div className="rounded-xl border border-primary/20 bg-card p-6">
          {!selectedType ? (
            <>
              <h2 className="mb-4 text-lg font-semibold">Choose a Connector Type</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CONNECTOR_CATALOG.map((def) => {
                  const alreadyExists = connectors.some((c) => c.type === def.type)
                  return (
                    <button
                      key={def.type}
                      onClick={() => handleSelectType(def)}
                      className="group flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition-all hover:border-primary hover:shadow-sm"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-2xl">{def.icon}</span>
                        {alreadyExists && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Connected
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{def.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {selectedType.icon} Configure {selectedType.label}
                </h2>
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to types
                </button>
              </div>
              <p className="mb-6 text-sm text-muted-foreground">{selectedType.description}</p>

              <div className="space-y-4">
                {/* Connector Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium">Connector Name</label>
                  <input
                    type="text"
                    value={connectorName}
                    onChange={(e) => setConnectorName(e.target.value)}
                    placeholder={`${selectedType.label} — ${tenantName}`}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Dynamic fields from catalog */}
                {selectedType.fields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-sm font-medium">
                      {field.label}
                      {field.required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formValues[field.key] || ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                        value={formValues[field.key] || ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                    {field.helpText && (
                      <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}

                {/* WhatsApp-specific webhook URL hint */}
                {selectedType.type === 'whatsapp' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Webhook Configuration</p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      After saving, configure your Meta webhook URL to:
                    </p>
                    <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/50">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/whatsapp/webhook
                    </code>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Subscribe to the <strong>messages</strong> webhook field.
                    </p>
                  </div>
                )}

                {/* Discord-specific webhook URL hint */}
                {selectedType.type === 'discord' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Bot Bridge</p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      The Discord bot bridge should send messages to:
                    </p>
                    <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/50">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/discord/webhook
                    </code>
                  </div>
                )}

                {/* Slack-specific Event Subscriptions hint */}
                {selectedType.type === 'slack' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Slack Event Subscriptions</p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      Register this URL in your Slack App under Event Subscriptions:
                    </p>
                    <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/50">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/slack/webhook
                    </code>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Subscribe to: <strong>message.channels</strong>, <strong>message.groups</strong>, <strong>message.im</strong>
                    </p>
                  </div>
                )}

                {/* Telegram-specific webhook URL hint */}
                {selectedType.type === 'telegram' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Telegram Webhook</p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      Register the webhook with your bot token using the Telegram API:
                    </p>
                    <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/50">
                      https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/telegram/webhook&secret_token=&lt;WEBHOOK_SECRET&gt;
                    </code>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      The <strong>secret_token</strong> must match the Webhook Secret above.
                    </p>
                  </div>
                )}

                {/* SMS/Twilio-specific webhook URL hint */}
                {selectedType.type === 'sms' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Twilio Webhook</p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      In Twilio Console, set the &quot;A message comes in&quot; webhook URL to:
                    </p>
                    <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/50">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/sms/webhook
                    </code>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Method: <strong>HTTP POST</strong>. Found under Phone Numbers &rarr; Active Numbers &rarr; your number.
                    </p>
                  </div>
                )}

                {/* Google Chat-specific webhook URL hint */}
                {selectedType.type === 'google_chat' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Google Chat App</p>
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      Use the generic bridge endpoint for Google Chat messages:
                    </p>
                    <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900/50">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/bridge/inbound
                    </code>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Include the <strong>X-Bridge-Secret</strong> header with your Webhook Secret.
                    </p>
                  </div>
                )}

                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveConnector}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      'Save Connector'
                    )}
                  </button>
                  <button
                    onClick={() => { setShowAddPanel(false); setSelectedType(null) }}
                    className="rounded-lg border border-border px-5 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Connector List ─────────────────────────────────── */}
      {connectors.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
            🔌
          </div>
          <h3 className="mb-2 text-lg font-semibold">No Connectors Yet</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Connect your first messaging platform, email account, or integration.
            Each connector bridges an external channel to LEO.
          </p>
          <button
            onClick={() => setShowAddPanel(true)}
            className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Add Your First Connector
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {categoryLabels[category] || category}
              </h2>
              <div className="space-y-2">
                {items.map((conn) => {
                  const { label, icon } = typeLabel(conn.type)
                  return (
                    <div
                      key={conn.id}
                      className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                        conn.enabled
                          ? 'border-border bg-card'
                          : 'border-border/50 bg-muted/30 opacity-60'
                      }`}
                    >
                      {/* Icon + Name */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{conn.name || label}</p>
                          {statusBadge(conn.status)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{label}</span>
                          <span>·</span>
                          <span>Last active: {timeAgo(conn.lastActivity)}</span>
                          {conn.errorMessage && (
                            <>
                              <span>·</span>
                              <span className="truncate text-red-500" title={conn.errorMessage}>
                                {conn.errorMessage.slice(0, 60)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(conn.id, conn.enabled)}
                          disabled={toggleLoading === conn.id}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                            conn.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          title={conn.enabled ? 'Disable' : 'Enable'}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              conn.enabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>

                        {/* Test */}
                        <button
                          onClick={() => handleTest(conn.id)}
                          disabled={testing === conn.id}
                          className="rounded border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                          title={testResult[conn.id]?.message || 'Test connection'}
                        >
                          {testing === conn.id
                            ? 'Testing...'
                            : testResult[conn.id]?.status === 'ok'
                              ? `OK (${testResult[conn.id]?.latencyMs}ms)`
                              : 'Test'}
                        </button>

                        {/* Delete */}
                        {deleteConfirm === conn.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(conn.id)}
                              className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(conn.id)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                            title="Delete connector"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Webhook URLs Reference ─────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Webhook URLs</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Configure these URLs in your external service dashboards.
        </p>
        <div className="space-y-3">
          {[
            { label: 'WhatsApp (Meta)', path: '/api/whatsapp/webhook', note: 'Subscribe to "messages" field' },
            { label: 'Discord Bot', path: '/api/discord/webhook', note: 'Include X-Discord-Secret header' },
            { label: 'Telegram Bot', path: '/api/telegram/webhook', note: 'Set via setWebhook API with secret_token' },
            { label: 'SMS (Twilio)', path: '/api/sms/webhook', note: 'Twilio "A message comes in" webhook (POST)' },
            { label: 'Email Poll (Cron)', path: '/api/email/poll', note: 'Vercel Cron: */2 * * * *' },
            { label: 'Bridge (Generic)', path: '/api/bridge/inbound', note: 'For Google Chat + custom integrations' },
          ].map((wh) => (
            <div key={wh.path} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{wh.label}</p>
                <code className="mt-1 block text-xs text-muted-foreground">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}
                  {wh.path}
                </code>
                <p className="mt-1 text-xs text-muted-foreground">{wh.note}</p>
              </div>
              <button
                onClick={() => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}${wh.path}`
                  navigator.clipboard?.writeText(url)
                }}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Copy URL"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
