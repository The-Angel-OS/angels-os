'use client'

import React, { useCallback, useEffect, useState } from 'react'

/**
 * Site Log — the DNN Site Log module's reports, for a portal owner.
 *
 * One report picker, one date range, one table. Every report returns the same
 * `{ label, views, visitors }` shape from the server, so the table is written
 * once instead of eight times; the detail log is the only different shape.
 */

const REPORTS = [
  { id: 'detail', label: 'Detailed log', blurb: 'Every page view, newest first.' },
  { id: 'pages', label: 'Page popularity', blurb: 'Which pages get read.' },
  { id: 'referrers', label: 'Referrers', blurb: 'Where your visitors came from.' },
  { id: 'agents', label: 'Browsers & devices', blurb: 'What they viewed it on.' },
  { id: 'by-day', label: 'Views by day', blurb: 'Traffic over the period.' },
  { id: 'by-weekday', label: 'Views by day of week', blurb: 'Which days are busy.' },
  { id: 'by-hour', label: 'Views by hour', blurb: 'What time of day they visit.' },
  { id: 'visitors', label: 'Returning visitors', blurb: 'Who comes back most.' },
] as const

type ReportId = (typeof REPORTS)[number]['id']

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

interface AggregateRow {
  label: string
  views: number
  visitors?: number
  pages?: number
  device?: string
  first_seen?: string
  last_seen?: string
}

interface DetailRow {
  at: string
  path: string
  referrerHost: string | null
  browser: string
  os: string
  device: string
  isBot: boolean
}

export function SiteLogViewer({ tenantName }: { tenantName: string }) {
  const [report, setReport] = useState<ReportId>('detail')
  const [days, setDays] = useState(7)
  const [includeBots, setIncludeBots] = useState(false)
  const [rows, setRows] = useState<Array<AggregateRow | DetailRow>>([])
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        type: report,
        days: String(days),
        limit: '100',
        ...(includeBots ? { bots: 'true' } : {}),
      })
      const res = await fetch(`/api/site-log/report?${qs}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not load that report.')
      setRows(json.rows || [])
      setPending(Boolean(json.pending))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that report.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [report, days, includeBots])

  useEffect(() => {
    void load()
  }, [load])

  const active = REPORTS.find((r) => r.id === report)!
  const totalViews = rows.reduce(
    (sum, r) => sum + (typeof (r as AggregateRow).views === 'number' ? (r as AggregateRow).views : 1),
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site Log</h1>
        <p className="text-muted-foreground">
          Who is visiting {tenantName}, and what they are reading.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <select
          value={report}
          onChange={(e) => setReport(e.target.value as ReportId)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium"
        >
          {REPORTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-md border border-border">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-2 text-sm ${
                days === r.days ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeBots}
            onChange={(e) => setIncludeBots(e.target.checked)}
          />
          Include crawlers
        </label>

        <button
          onClick={() => void load()}
          className="ml-auto rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {/* Report */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{active.label}</h2>
            <p className="text-sm text-muted-foreground">{active.blurb}</p>
          </div>
          {!loading && rows.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalViews.toLocaleString()} view{totalViews === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : pending ? (
          <EmptyState
            title="Not collecting yet"
            body="The visitor log table hasn't been created on this node yet. It appears automatically after the next deploy."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No visits recorded"
            body={
              days <= 1
                ? "Nothing today yet. Try a longer range — and remember only public pages count, not your own dashboard."
                : 'Nothing in this period. Only public pages are recorded, and crawlers are hidden unless you tick the box.'
            }
          />
        ) : report === 'detail' ? (
          <DetailTable rows={rows as DetailRow[]} />
        ) : (
          <AggregateTable rows={rows as AggregateRow[]} report={report} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

function DetailTable({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">When</th>
            <th className="pb-2 pr-4">Page</th>
            <th className="pb-2 pr-4">Came from</th>
            <th className="pb-2">Browser</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                {new Date(r.at).toLocaleString()}
              </td>
              <td className="py-2 pr-4 font-medium">{r.path}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.referrerHost || 'direct'}</td>
              <td className="py-2 text-muted-foreground">
                {r.browser} · {r.os}
                {r.isBot && <span className="ml-2 text-xs opacity-70">crawler</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AggregateTable({ rows, report }: { rows: AggregateRow[]; report: ReportId }) {
  const max = Math.max(...rows.map((r) => r.views), 1)
  const firstHeader =
    report === 'pages' ? 'Page'
    : report === 'referrers' ? 'Source'
    : report === 'agents' ? 'Browser'
    : report === 'visitors' ? 'Visitor'
    : 'Period'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">{firstHeader}</th>
            <th className="pb-2 pr-4 text-right">Views</th>
            <th className="pb-2 pr-4 text-right">
              {report === 'visitors' ? 'Pages' : 'Visitors'}
            </th>
            <th className="pb-2 w-1/3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-2 pr-4 font-medium">
                {/* A visitor hash is 32 characters of noise — show enough to tell
                    two visitors apart and no more. */}
                {report === 'visitors' ? `Visitor ${r.label.slice(0, 6)}` : r.label}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.views.toLocaleString()}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {(report === 'visitors' ? r.pages : r.visitors)?.toLocaleString() ?? '—'}
              </td>
              <td className="py-2">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.round((r.views / max) * 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
