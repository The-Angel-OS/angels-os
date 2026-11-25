'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  Activity,
  ExternalLink,
} from 'lucide-react'

type ScopeId = 'portal:read' | 'portal:content' | 'portal:admin' | 'portal:provision'

interface PortalKeySummary {
  id: string
  name: string
  prefix: string
  scopes: ScopeId[]
  source: 'api_key' | 'oauth2'
  clientId?: string
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
  active: boolean
}

interface AirlockItem {
  id: string
  toolName: string
  summary: string
  argsPreview: string
  keyName: string
  requestedAt: string
  expiresAt: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
}

interface ActivityItem {
  id: string
  timestamp: string
  keyName: string
  tool: string
  status: 'ok' | 'denied' | 'airlock' | 'revoked' | 'minted'
  summary: string
}

const SCOPE_OPTIONS: Array<{ id: ScopeId; label: string; desc: string }> = [
  { id: 'portal:read', label: 'portal:read', desc: 'Query posts, products, events, spaces & LEO chat' },
  { id: 'portal:content', label: 'portal:content', desc: 'Create & edit posts, videos, and pages' },
  { id: 'portal:admin', label: 'portal:admin', desc: 'Full portal management (Airlock-guarded)' },
  { id: 'portal:provision', label: 'portal:provision', desc: 'Provision new $0 Preview portals' },
]

export function SovereignMcpPanel({ canonicalDomain }: { canonicalDomain: string }) {
  const searchParams = useSearchParams()
  const highlightedAirlock = searchParams?.get('airlock') || ''

  const [keys, setKeys] = useState<PortalKeySummary[]>([])
  const [airlock, setAirlock] = useState<AirlockItem[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newKeyName, setNewKeyName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<ScopeId[]>(['portal:read', 'portal:content'])
  const [minting, setMinting] = useState(false)
  const [mintedPlaintext, setMintedPlaintext] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const origin = canonicalDomain ? `https://${canonicalDomain}` : 'https://spacesangels.com'
  const mcpUrl = `${origin}/api/mcp`
  const oauthDiscoveryUrl = `${origin}/.well-known/oauth-protected-resource`

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mcp-ops/keys', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not load Remote MCP keys.')
        return
      }
      setKeys(data.keys || [])
      setAirlock(data.airlock || [])
      setActivity(data.activity || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading MCP keys.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const toggleScope = (scope: ScopeId) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.length > 1
          ? prev.filter((s) => s !== scope)
          : prev
        : [...prev, scope],
    )
  }

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault()
    setMinting(true)
    setError(null)
    setMintedPlaintext(null)
    try {
      const res = await fetch('/api/mcp-ops/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'mint',
          name: newKeyName.trim() || 'External AI Assistant',
          scopes: selectedScopes,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to mint Portal API key.')
        return
      }
      setMintedPlaintext(data.plaintext || null)
      setNewKeyName('')
      setKeys(data.keys || [])
      setAirlock(data.airlock || [])
      setActivity(data.activity || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error minting key.')
    } finally {
      setMinting(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    setBusyId(keyId)
    setError(null)
    try {
      const res = await fetch('/api/mcp-ops/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'revoke', keyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not revoke key.')
        return
      }
      setKeys(data.keys || [])
      setActivity(data.activity || [])
    } finally {
      setBusyId(null)
    }
  }

  const handleAirlockDecision = async (approvalId: string, decision: 'approve_airlock' | 'deny_airlock') => {
    setBusyId(approvalId)
    setError(null)
    try {
      const res = await fetch('/api/mcp-ops/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: decision, approvalId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not update Airlock request.')
        return
      }
      setAirlock(data.airlock || [])
      setActivity(data.activity || [])
    } finally {
      setBusyId(null)
    }
  }

  const pendingAirlock = airlock.filter((a) => a.status === 'pending')
  const activeKeys = keys.filter((k) => k.active)

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold">Sovereign Remote MCP &amp; OAuth 2.1</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Connect Antigravity Plugins, ChatGPT Connectors, or Claude Remote MCP directly to this portal.
            Every token is strictly pinned to this portal server-side and guarded by Constitutional Airlock.
          </p>
        </div>
        <a
          href={oauthDiscoveryUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted shrink-0"
        >
          OAuth 2.1 Metadata
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Remote MCP Endpoint Bar */}
      <div className="rounded-md border border-border bg-muted/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Remote MCP Server URL
          </div>
          <code className="text-xs font-mono text-foreground break-all">{mcpUrl}</code>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(mcpUrl).catch(() => {})
            setCopiedEndpoint(true)
            setTimeout(() => setCopiedEndpoint(false), 1800)
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted shrink-0"
        >
          {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedEndpoint ? 'Copied' : 'Copy URL'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Pending Constitutional Airlock Approvals */}
      {pendingAirlock.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            Constitutional Airlock — Human Approval Required ({pendingAirlock.length})
          </div>
          {pendingAirlock.map((item) => (
            <div
              key={item.id}
              className={`rounded-md border bg-background/90 p-3 space-y-2 ${
                highlightedAirlock === item.id ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-border'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-foreground">{item.toolName}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">via {item.keyName}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{item.id}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.summary}</p>
              <pre className="rounded bg-muted p-2 text-[11px] font-mono overflow-x-auto">
                {item.argsPreview}
              </pre>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void handleAirlockDecision(item.id, 'approve_airlock')}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void handleAirlockDecision(item.id, 'deny_airlock')}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* One-time Plaintext Key Reveal */}
      {mintedPlaintext && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
          <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
            Copy Your Portal API Key Now — Shown Once
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background border border-border px-3 py-2 text-xs font-mono break-all">
              {mintedPlaintext}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(mintedPlaintext).catch(() => {})
                setCopiedKey(true)
                setTimeout(() => setCopiedKey(false), 2000)
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use as <code className="font-mono">Authorization: Bearer {mintedPlaintext.slice(0, 18)}…</code> in your MCP client.
          </p>
        </div>
      )}

      {/* Mint New Portal API Key Form */}
      <form onSubmit={handleMint} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Mint Scoped Portal API Key</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Label (e.g. Antigravity Desktop, Claude Remote, ChatGPT)"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={minting}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
          >
            {minting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Mint Key
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCOPE_OPTIONS.map((opt) => {
            const checked = selectedScopes.includes(opt.id)
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-2 rounded-md border p-2 text-xs cursor-pointer ${
                  checked ? 'border-primary/60 bg-primary/5' : 'border-border/60 bg-background/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleScope(opt.id)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-mono font-semibold text-foreground">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            )
          })}
        </div>
      </form>

      {/* Active Keys Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Active Portal Keys ({activeKeys.length})</h3>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        {activeKeys.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">
            No active external agent keys yet. Mint a scoped key above or connect via OAuth 2.1.
          </p>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((k) => (
              <div
                key={k.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-border bg-background/70 p-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{k.name}</span>
                    <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {k.prefix}
                    </code>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {k.source === 'oauth2' ? 'OAuth 2.1' : 'API Key'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === k.id}
                  onClick={() => void handleRevoke(k.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 shrink-0 self-start sm:self-center"
                >
                  {busyId === k.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External Agent Activity Feed */}
      {activity.length > 0 && (
        <details className="rounded-md border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />
              External Agent Activity ({activity.length})
            </span>
            <span className="text-[11px] text-muted-foreground">View audit log</span>
          </summary>
          <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
            {activity.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-2 text-[11px] border-t border-border/50 pt-1.5"
              >
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-foreground">{entry.tool}</span>{' '}
                  <span className="text-muted-foreground">({entry.keyName}) — {entry.summary}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
