'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import {
  importContacts,
  getContacts,
  getContactStats,
  bulkInvite,
  deleteContacts,
  type ContactRecord,
  type ContactStats,
  type ImportResult,
  type BulkInviteResult,
} from './actions'

type Tab = 'import' | 'contacts' | 'invite'

export default function ContactsManager() {
  const [activeTab, setActiveTab] = useState<Tab>('contacts')
  const [stats, setStats] = useState<ContactStats | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const s = await getContactStats()
    setStats(s)
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Import, manage, and invite contacts to your Enterprise
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Total" value={stats.total} color="text-foreground" />
          <StatCard label="Not Invited" value={stats.notInvited} color="text-muted-foreground" />
          <StatCard label="Invited" value={stats.invited} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Pending" value={stats.pending} color="text-amber-600 dark:text-amber-400" />
          <StatCard label="Accepted" value={stats.accepted} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Bounced" value={stats.bounced} color="text-red-600 dark:text-red-400" />
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {(['import', 'contacts', 'invite'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'import' ? 'Import' : tab === 'contacts' ? 'Contacts' : 'Invite'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'import' && <ImportTab onImported={loadStats} />}
      {activeTab === 'contacts' && <ContactsTab onChanged={loadStats} />}
      {activeTab === 'invite' && <InviteTab stats={stats} onInvited={loadStats} />}
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  )
}

// ── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab({ onImported }: { onImported: () => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [source, setSource] = useState('csv-import')
  const [tags, setTags] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      const format = file.name.endsWith('.json') ? 'json' : 'csv'
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      setImporting(true)
      setResult(null)

      startTransition(async () => {
        const res = await importContacts(text, format as 'csv' | 'json', source, tagList)
        setResult(res)
        setImporting(false)
        if (res.created > 0) onImported()
      })
    },
    [source, tags, onImported],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="space-y-4">
      {/* Source & Tags */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Source Tag</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="clerk-lms">Clerk LMS</option>
            <option value="csv-import">CSV Import</option>
            <option value="json-import">JSON Import</option>
            <option value="manual">Manual</option>
            <option value="referral">Referral</option>
            <option value="api">API</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. lms-student, beta-tester"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
            : 'border-border hover:border-muted-foreground/50'
        }`}
      >
        {importing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Importing contacts...</p>
          </div>
        ) : (
          <>
            <svg
              className="mb-3 h-10 w-10 text-muted-foreground/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mb-1 text-sm font-medium">Drop a CSV or JSON file here</p>
            <p className="mb-3 text-xs text-muted-foreground">
              CSV format: email,name — JSON: [{'{'}email, name{'}'}] or Clerk export
            </p>
            <label className="cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              Choose File
              <input
                type="file"
                accept=".csv,.json,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.success && result.created > 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
              : result.errors.length > 0
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10'
          }`}
        >
          <p className="mb-1 text-sm font-medium">
            {result.created > 0
              ? `Imported ${result.created} contacts`
              : result.error || 'No new contacts imported'}
            {result.skipped > 0 && ` (${result.skipped} duplicates skipped)`}
          </p>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {result.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 20 && (
                  <li>...and {result.errors.length - 20} more</li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ onChanged }: { onChanged: () => void }) {
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [inviteFilter, setInviteFilter] = useState('')
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [isPending, startTransition] = useTransition()

  const load = useCallback(
    async (p = 1) => {
      setLoading(true)
      const result = await getContacts({
        search: search || undefined,
        source: sourceFilter || undefined,
        inviteStatus: inviteFilter || undefined,
        page: p,
        limit: 50,
      })
      if (result.success) {
        setContacts(result.contacts)
        setTotalDocs(result.totalDocs)
        setTotalPages(result.totalPages)
        setPage(result.page)
      }
      setLoading(false)
    },
    [search, sourceFilter, inviteFilter],
  )

  useEffect(() => {
    load(1)
  }, [load])

  const toggleSelect = (id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((c) => c.id)))
    }
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} contact(s)?`)) return
    startTransition(async () => {
      await deleteContacts(Array.from(selected))
      setSelected(new Set())
      load(page)
      onChanged()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Sources</option>
          <option value="clerk-lms">Clerk LMS</option>
          <option value="csv-import">CSV Import</option>
          <option value="json-import">JSON Import</option>
          <option value="manual">Manual</option>
          <option value="referral">Referral</option>
        </select>
        <select
          value={inviteFilter}
          onChange={(e) => setInviteFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Invite Status</option>
          <option value="not-invited">Not Invited</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selected.size === contacts.length}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Name</th>
              <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Source</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Invite</th>
              <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Invited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No contacts found. Import some from the Import tab.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.email}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{c.name || '—'}</td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <SourceBadge source={c.source} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={c.contactStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <InviteBadge status={c.inviteStatus} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell">
                    {c.lastInvitedAt
                      ? new Date(c.lastInvitedAt).toLocaleDateString()
                      : '—'}
                    {c.inviteCount > 1 && ` (${c.inviteCount}x)`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {totalDocs.toLocaleString()} contacts
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Invite Tab ───────────────────────────────────────────────────────────────

function InviteTab({
  stats,
  onInvited,
}: {
  stats: ContactStats | null
  onInvited: () => void
}) {
  const [role, setRole] = useState('tenant_member')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BulkInviteResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const notInvitedCount = stats?.notInvited || 0

  const handleSend = () => {
    if (notInvitedCount === 0) return
    if (
      !confirm(
        `Send invitations to ${notInvitedCount} contacts? This will email them all.`,
      )
    )
      return

    setSending(true)
    setResult(null)

    startTransition(async () => {
      const res = await bulkInvite({
        inviteStatus: 'not-invited',
        role,
        message: message || undefined,
      })
      setResult(res)
      setSending(false)
      onInvited()
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-2 text-lg font-semibold">Bulk Invite</h3>
        <p className="text-sm text-muted-foreground">
          Send Enterprise invitations to all contacts who haven&apos;t been invited yet.
        </p>
        <p className="mt-2 text-3xl font-bold text-primary">
          {notInvitedCount.toLocaleString()}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            contacts ready to invite
          </span>
        </p>
      </div>

      {/* Settings */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="tenant_member">Member</option>
            <option value="tenant_manager">Manager</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Personal Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Join us on Angel OS!"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={sending || notInvitedCount === 0}
        className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {sending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Sending invitations...
          </span>
        ) : (
          `Send ${notInvitedCount.toLocaleString()} Invitation${notInvitedCount !== 1 ? 's' : ''}`
        )}
      </button>

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.invited > 0
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10'
          }`}
        >
          <p className="text-sm font-medium">
            {result.invited > 0
              ? `Sent ${result.invited} invitation${result.invited !== 1 ? 's' : ''}`
              : 'No invitations sent'}
          </p>
          {(result.skipped > 0 || result.failed > 0) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {result.skipped > 0 && `${result.skipped} skipped (already invited)`}
              {result.skipped > 0 && result.failed > 0 && ' · '}
              {result.failed > 0 && `${result.failed} failed`}
            </p>
          )}
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {result.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    'clerk-lms': 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
    'csv-import': 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    'json-import': 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    manual: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    referral: 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
    signup: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    api: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[source] || colors.manual}`}>
      {source.replace('-', ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    lead: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    invited: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    bounced: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    unsubscribed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.lead}`}>
      {status}
    </span>
  )
}

function InviteBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'not-invited': 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors['not-invited']}`}>
      {status.replace('-', ' ')}
    </span>
  )
}
