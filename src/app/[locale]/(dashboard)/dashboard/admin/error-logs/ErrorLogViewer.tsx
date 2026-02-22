'use client'

import React, { useEffect, useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  getErrorLogs,
  getLogCounts,
  toggleLogResolved,
  clearResolvedLogs,
  type LogEntry,
} from './actions'

// ─── Level badge colors ──────────────────────────────────────────────
const LEVEL_STYLES: Record<string, string> = {
  error: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
  debug: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const LEVEL_ICONS: Record<string, string> = {
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  debug: '⚙',
}

// ─── Component ───────────────────────────────────────────────────────
export function ErrorLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)

  // Filters
  const [levelFilter, setLevelFilter] = useState('all')
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [searchQuery, setSearchQuery] = useState('')

  // Summary counts
  const [counts, setCounts] = useState({ total: 0, errors: 0, warnings: 0, unresolved: 0 })

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | number | null>(null)

  // ── Fetch logs ─────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const result = await getErrorLogs({
      page,
      limit: 25,
      level: levelFilter !== 'all' ? levelFilter : undefined,
      resolved: resolvedFilter === 'all' ? undefined : resolvedFilter === 'resolved',
      search: searchQuery || undefined,
    })
    if (result.error) {
      setError(result.error)
    } else {
      setLogs(result.logs)
      setTotalPages(result.totalPages)
      setTotalDocs(result.totalDocs)
      setError(null)
    }
    setLoading(false)
  }, [page, levelFilter, resolvedFilter, searchQuery])

  const fetchCounts = useCallback(async () => {
    const result = await getLogCounts()
    if (!result.error) {
      setCounts(result)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // ── Actions ────────────────────────────────────────────────
  function handleToggleResolved(log: LogEntry) {
    startTransition(async () => {
      const result = await toggleLogResolved(log.id, !log.resolved)
      if (result.success) {
        setLogs((prev) =>
          prev.map((l) => (l.id === log.id ? { ...l, resolved: !l.resolved } : l)),
        )
        fetchCounts()
      }
    })
  }

  function handleClearResolved() {
    if (!confirm('Delete all resolved log entries? This cannot be undone.')) return
    startTransition(async () => {
      const result = await clearResolvedLogs()
      if (result.error) {
        alert(result.error)
      } else {
        fetchLogs()
        fetchCounts()
      }
    })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [levelFilter, resolvedFilter])

  // ── Loading skeleton ───────────────────────────────────────
  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────
  if (error && logs.length === 0) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
        <p className="font-medium">Failed to load error logs</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          onClick={() => { setError(null); fetchLogs() }}
          className="mt-3 rounded-md border border-current px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Error Log Viewer</h1>
          <p className="text-sm text-muted-foreground">
            Triage application errors and warnings
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="admin"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Admin
          </Link>
          <button
            onClick={handleClearResolved}
            disabled={isPending || counts.total === counts.unresolved}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Clear Resolved
          </button>
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Logs" value={counts.total} color="text-foreground" />
        <SummaryCard label="Errors" value={counts.errors} color="text-red-600 dark:text-red-400" />
        <SummaryCard label="Warnings" value={counts.warnings} color="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Unresolved" value={counts.unresolved} color="text-blue-600 dark:text-blue-400" />
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Levels</option>
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        {/* Status filter */}
        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value as any)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, sources..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Log Table ──────────────────────────────────────── */}
      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">No log entries found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {resolvedFilter === 'open'
              ? 'All clear! No unresolved errors.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Level</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Time</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={String(log.id)}>
                    <tr
                      className={`border-b border-border transition-colors hover:bg-muted/30 ${
                        log.resolved ? 'opacity-50' : ''
                      } ${expandedId === log.id ? 'bg-muted/20' : ''}`}
                    >
                      {/* Level badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            LEVEL_STYLES[log.level] || LEVEL_STYLES.debug
                          }`}
                        >
                          <span>{LEVEL_ICONS[log.level]}</span>
                          {log.level}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{log.source}</span>
                      </td>

                      {/* Message (clickable to expand) */}
                      <td className="max-w-xs px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="w-full text-left"
                        >
                          <span className="line-clamp-2 text-sm">{log.message}</span>
                          {(log.details || log.statusCode || log.url) && (
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {expandedId === log.id ? 'Click to collapse' : 'Click for details'}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Timestamp */}
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted-foreground md:table-cell">
                        {formatTimestamp(log.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleResolved(log)}
                          disabled={isPending}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            log.resolved
                              ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950'
                          } disabled:opacity-50`}
                        >
                          {log.resolved ? 'Reopen' : 'Resolve'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {expandedId === log.id && (
                      <tr className="border-b border-border bg-muted/10">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-3 text-sm">
                            {log.statusCode && (
                              <div>
                                <span className="font-medium text-muted-foreground">Status Code: </span>
                                <span className="font-mono">{log.statusCode}</span>
                              </div>
                            )}
                            {log.url && (
                              <div>
                                <span className="font-medium text-muted-foreground">URL: </span>
                                <span className="font-mono text-xs break-all">{log.url}</span>
                              </div>
                            )}
                            {log.userId && (
                              <div>
                                <span className="font-medium text-muted-foreground">User ID: </span>
                                <span className="font-mono">{log.userId}</span>
                              </div>
                            )}
                            {log.tenantId && (
                              <div>
                                <span className="font-medium text-muted-foreground">Tenant ID: </span>
                                <span className="font-mono">{log.tenantId}</span>
                              </div>
                            )}
                            {log.details && (
                              <div>
                                <span className="mb-1 block font-medium text-muted-foreground">Details / Stack Trace:</span>
                                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
                                  {log.details}
                                </pre>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Created: {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {page} of {totalPages} ({totalDocs} entries)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3_600_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
