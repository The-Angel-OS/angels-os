'use client'

import React, { useEffect, useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types (mirrors CICStatusResponse from cic-status.ts)
// ---------------------------------------------------------------------------

interface DepartmentStatus {
  department: string
  activeCount: number
  reserveCount: number
  totalCount: number
}

interface CICData {
  endeavorName: string
  endeavorStatus: string
  timestamp: string
  crew: {
    totalCrew: number
    activeDuty: number
    reserve: number
    shoreLeave: number
    detached: number
    departments: DepartmentStatus[]
  }
  workQueue: {
    pending: number
    claimed: number
    executing: number
    completed24h: number
    failed24h: number
    avgExecutionMs: number
  }
  federation: {
    networkVisible: boolean
    ministryStatus: string
    federationId: string | null
    lastPingAt: string | null
  }
  platforms: {
    name: string
    status: 'connected' | 'disconnected' | 'unknown'
    detail?: string
  }[]
}

// ---------------------------------------------------------------------------
// Department display config
// ---------------------------------------------------------------------------

const DEPT_LABELS: Record<string, string> = {
  bridge: 'Bridge',
  engineering: 'Engineering',
  operations: 'Operations',
  science: 'Science',
  communications: 'Comms',
  medical: 'Medical',
  security: 'Security',
  logistics: 'Logistics',
}

const DEPT_COLORS: Record<string, string> = {
  bridge: 'bg-amber-500',
  engineering: 'bg-orange-500',
  operations: 'bg-blue-500',
  science: 'bg-cyan-500',
  communications: 'bg-purple-500',
  medical: 'bg-red-500',
  security: 'bg-slate-500',
  logistics: 'bg-emerald-500',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  forming: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  retired: 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CICDashboard() {
  const [data, setData] = useState<CICData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cic/status', { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as CICData
      setData(json)
      setError(null)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to fetch CIC status')
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 30 seconds
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Initializing CIC systems...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">
            CIC Offline
          </h2>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchStatus}
            className="mt-3 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            CIC — {data.endeavorName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Command Information Center • Real-time operational status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              STATUS_BADGE[data.endeavorStatus] || STATUS_BADGE.forming
            }`}
          >
            {data.endeavorStatus}
          </span>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStatus}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top Cards Grid ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Crew Readiness */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Crew Complement
          </div>
          <div className="text-3xl font-bold">{data.crew.totalCrew}</div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-emerald-600">{data.crew.activeDuty} active</span>
            <span className="text-blue-600">{data.crew.reserve} reserve</span>
            <span className="text-amber-600">{data.crew.shoreLeave} shore</span>
          </div>
        </div>

        {/* Work Queue */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Work Queue
          </div>
          <div className="text-3xl font-bold">
            {data.workQueue.pending + data.workQueue.claimed + data.workQueue.executing}
          </div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-amber-600">{data.workQueue.pending} pending</span>
            <span className="text-blue-600">{data.workQueue.executing} active</span>
          </div>
        </div>

        {/* 24h Throughput */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            24h Throughput
          </div>
          <div className="text-3xl font-bold">{data.workQueue.completed24h}</div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-emerald-600">{data.workQueue.completed24h} completed</span>
            <span className="text-red-600">{data.workQueue.failed24h} failed</span>
          </div>
        </div>

        {/* Avg Execution */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Avg Execution
          </div>
          <div className="text-3xl font-bold">
            {data.workQueue.avgExecutionMs > 0
              ? `${(data.workQueue.avgExecutionMs / 1000).toFixed(1)}s`
              : '—'}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Based on last 50 completed units
          </div>
        </div>
      </div>

      {/* ── Department Readiness + Federation ──────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Department Readiness */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
            Department Readiness
          </h2>
          {data.crew.departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No crew assigned yet. Use the Team page to assign crew members.
            </p>
          ) : (
            <div className="space-y-2">
              {data.crew.departments.map((dept) => (
                <div key={dept.department} className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      DEPT_COLORS[dept.department] || 'bg-gray-400'
                    }`}
                  />
                  <span className="w-24 text-sm font-medium">
                    {DEPT_LABELS[dept.department] || dept.department}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          DEPT_COLORS[dept.department] || 'bg-gray-400'
                        }`}
                        style={{
                          width: `${dept.totalCount > 0 ? (dept.activeCount / dept.totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {dept.activeCount}/{dept.totalCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Federation Radar */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
            Federation Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Network Visible</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  data.federation.networkVisible
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {data.federation.networkVisible ? 'Active' : 'Hidden'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Ministry Status</span>
              <span className="text-sm font-medium capitalize">
                {data.federation.ministryStatus}
              </span>
            </div>
            {data.federation.federationId && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Federation ID</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {data.federation.federationId.slice(0, 16)}...
                </code>
              </div>
            )}
            {data.federation.lastPingAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Ping</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(data.federation.lastPingAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Platform Connections ───────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
          Universal Transport Bus — Platform Connections
        </h2>
        {data.platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No platform connections detected. Configure MCP connections in settings.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.platforms.map((platform) => (
              <div
                key={platform.name}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    platform.status === 'connected'
                      ? 'bg-emerald-500'
                      : platform.status === 'disconnected'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{platform.name}</div>
                  {platform.detail && (
                    <div className="truncate text-xs text-muted-foreground">
                      {platform.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
