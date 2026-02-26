'use client'

/**
 * FederationDashboard — Enterprise Operator Federation Control Panel
 *
 * Four tabs:
 *   1. Overview — Federation health, this Enterprise's status, constitution info
 *   2. Street Signs — Manage cross-holon content references
 *   3. Governance — Active proposals, voting, election history
 *   4. Suitcase — Export/import Endeavor data (constitutional portability)
 *
 * Sprint 20: Federation Launch Campaign
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Vote,
  Signpost,
  Briefcase,
  RefreshCw,
  Shield,
  Check,
  AlertCircle,
  ExternalLink,
  Download,
  Upload,
  Plus,
  ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface FederationHealth {
  totalMinistries: number
  activeMinistries: number
  probationaryMinistries: number
  catalogEntries: number
  trustScore: number
}

interface Proposal {
  id: string
  type: string
  title: string
  description: string
  status: string
  proposedAt: string
  expiresAt: string
  result?: {
    votesFor: number
    votesAgainst: number
    abstentions: number
    totalVotes: number
    supermajorityReached: boolean
  }
}

type Tab = 'overview' | 'street-signs' | 'governance' | 'suitcase'

// ── Tab Button Component ──────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-foreground',
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export default function FederationDashboard() {
  const [tab, setTab] = useState<Tab>('overview')
  const [health, setHealth] = useState<FederationHealth | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/federation/governance-sync', { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        if (data.governance) {
          setHealth({
            totalMinistries: data.governance.ministries?.length || 0,
            activeMinistries: data.governance.ministries?.filter((m: any) => m.status === 'active').length || 0,
            probationaryMinistries: data.governance.ministries?.filter((m: any) => m.status === 'probation').length || 0,
            catalogEntries: data.governance.catalogIndex?.length || 0,
            trustScore: 0,
          })
        }
      }
    } catch {
      // Governance endpoint may not be available in dev
    }
    setLoading(false)
  }, [])

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/federation/election?status=all', { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        setProposals(data.proposals || [])
      }
    } catch {
      // Election endpoint may not be available yet
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    fetchProposals()
  }, [fetchHealth, fetchProposals])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Federation Network</h1>
            <p className="text-sm text-muted-foreground">
              Governance, marketplace discovery, and Endeavor portability
            </p>
          </div>
          <button
            onClick={() => { fetchHealth(); fetchProposals() }}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={Globe} label="Overview" />
          <TabButton active={tab === 'street-signs'} onClick={() => setTab('street-signs')} icon={Signpost} label="Street Signs" />
          <TabButton active={tab === 'governance'} onClick={() => setTab('governance')} icon={Vote} label="Governance" />
          <TabButton active={tab === 'suitcase'} onClick={() => setTab('suitcase')} icon={Briefcase} label="Suitcase" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'overview' && <OverviewTab health={health} loading={loading} />}
        {tab === 'street-signs' && <StreetSignsTab />}
        {tab === 'governance' && <GovernanceTab proposals={proposals} onRefresh={fetchProposals} />}
        {tab === 'suitcase' && <SuitcaseTab />}
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab({ health, loading }: { health: FederationHealth | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Enterprises" value={health?.totalMinistries || 0} icon={Globe} />
        <StatCard label="Active" value={health?.activeMinistries || 0} icon={Check} color="text-green-600" />
        <StatCard label="Probationary" value={health?.probationaryMinistries || 0} icon={AlertCircle} color="text-amber-600" />
        <StatCard label="Catalog Entries" value={health?.catalogEntries || 0} icon={Signpost} />
      </div>

      {/* Constitution Status */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10">
            <Shield size={20} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold">Constitution v1.1</h3>
            <p className="text-sm text-muted-foreground">
              7 Articles — Dignity, Anti-Demonic Safeguards, Agent Conduct, AI Bus, Economic Model, Suitcase Principle, Federation
            </p>
          </div>
        </div>
      </div>

      {/* Revenue Split */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Toward-53 Revenue Architecture</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Constitutional split — directional toward the creator
        </p>
        <div className="mt-4 space-y-2">
          {[
            { label: 'Endeavor Owner', pct: 70, color: 'bg-green-500' },
            { label: 'Enterprise Operator', pct: 20, color: 'bg-blue-500' },
            { label: 'Justice Fund', pct: 5, color: 'bg-purple-500' },
            { label: 'Angel OS Protocol', pct: 4, color: 'bg-amber-500' },
            { label: 'Flagship (Clearwater)', pct: 1, color: 'bg-rose-500' },
          ].map(({ label, pct, color }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-24 text-right text-sm font-medium">{pct}%</div>
              <div className="flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="w-32 text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Street Signs Tab ─────────────────────────────────────────────────────

function StreetSignsTab() {
  const [signs, setSigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/street-signs?limit=50&depth=0')
      .then((r) => r.json())
      .then((data) => {
        setSigns(data.docs || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Street Signs</h2>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus size={14} />
          Create Street Sign
        </button>
      </div>

      {signs.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Signpost size={40} className="mx-auto text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground">
            No street signs yet. Create one to surface your content across the federation.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {signs.map((sign: any) => (
            <div key={sign.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div>
                <h3 className="font-medium">{sign.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {sign.contentType} — {sign.source?.dioceseName || 'Local'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{sign.impressions || 0} views</span>
                <span>{sign.clickThroughs || 0} clicks</span>
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Governance Tab ───────────────────────────────────────────────────────

function GovernanceTab({ proposals, onRefresh }: { proposals: Proposal[]; onRefresh: () => void }) {
  const activeProposals = proposals.filter((p) => p.status === 'active')
  const pastProposals = proposals.filter((p) => p.status !== 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Governance Proposals</h2>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus size={14} />
          New Proposal
        </button>
      </div>

      {/* Active Proposals */}
      {activeProposals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Active Votes</h3>
          {activeProposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}

      {/* Past Proposals */}
      {pastProposals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">History</h3>
          {pastProposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}

      {proposals.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Vote size={40} className="mx-auto text-muted-foreground/30" />
          <p className="mt-3 text-muted-foreground">
            No governance proposals yet. The federation governs itself through constitutional supermajority.
          </p>
        </div>
      )}
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const statusColors: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-600',
    passed: 'bg-green-500/10 text-green-600',
    rejected: 'bg-red-500/10 text-red-600',
    expired: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{proposal.title}</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{proposal.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-2 py-0.5 font-medium">{proposal.type}</span>
            <span>Proposed {new Date(proposal.proposedAt).toLocaleDateString()}</span>
            {proposal.result && (
              <span>
                {proposal.result.votesFor} for / {proposal.result.votesAgainst} against
              </span>
            )}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[proposal.status] || ''}`}>
          {proposal.status}
        </span>
      </div>
    </div>
  )
}

// ── Suitcase Tab ─────────────────────────────────────────────────────────

function SuitcaseTab() {
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<any>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/federation/suitcase/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setExportResult(data)
    } catch (err) {
      setExportResult({ error: 'Export failed' })
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Suitcase — Endeavor Portability</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Constitutional right (Article VI): Pack your data and move to any Enterprise. Instantly. Completely.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Export */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10">
              <Download size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">Export Suitcase</h3>
              <p className="text-sm text-muted-foreground">Pack all your Endeavor data for transport</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {exporting ? 'Packing...' : 'Pack Suitcase'}
          </button>
          {exportResult?.success && (
            <div className="mt-3 rounded-lg bg-green-500/10 p-3 text-sm text-green-700">
              {exportResult.message}
            </div>
          )}
          {exportResult?.error && (
            <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-700">
              {exportResult.error}
            </div>
          )}
        </div>

        {/* Import */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10">
              <Upload size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Import Suitcase</h3>
              <p className="text-sm text-muted-foreground">Welcome an Endeavor from another Enterprise</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Contact the source Enterprise operator to initiate a suitcase transfer.
            The import will preserve all content, products, and federation identity.
          </p>
        </div>
      </div>
    </div>
  )
}
