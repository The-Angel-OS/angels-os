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
  { id: 'countries', label: 'Countries', blurb: 'Where in the world they are.' },
  { id: 'by-day', label: 'Views by day', blurb: 'Traffic over the period.' },
  { id: 'by-weekday', label: 'Views by day of week', blurb: 'Which days are busy.' },
  { id: 'by-hour', label: 'Views by hour', blurb: 'What time of day they visit.' },
  { id: 'visitors', label: 'Returning visitors', blurb: 'Who comes back most.' },
  {
    id: 'variants',
    label: 'A/B test',
    blurb: 'Half your visitors see A, half see B. This is which one wins.',
  },
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

/** One arm of the A/B test, plus its conversion rate. */
interface VariantRow {
  variant: string
  views: number
  visitors: number
  conversions: number
  rate: number
}

/** The statistician's answer, so the operator does not have to be one. */
interface Verdict {
  lift: number | null
  pValue: number | null
  significant: boolean
  note: string
}

interface DetailRow {
  at: string
  path: string
  /** Who they came in as, in plain terms: "Chrome on Windows", "Safari on iOS". */
  visitor?: string | null
  /** Only present on a platform-scoped log: whose portal the hit landed on. */
  portal?: string | null
  referrerHost: string | null
  browser: string
  os: string
  device: string
  isBot: boolean
}

export function SiteLogViewer({
  tenantName,
  canSeeWholeNode = false,
}: {
  tenantName: string
  /** Platform admins may widen the log past this portal. */
  canSeeWholeNode?: boolean
}) {
  const [report, setReport] = useState<ReportId>('detail')
  const [days, setDays] = useState(7)
  const [includeBots, setIncludeBots] = useState(false)
  const [rows, setRows] = useState<Array<AggregateRow | DetailRow | VariantRow>>([])
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [wholeNode, setWholeNode] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [goals, setGoals] = useState<string[]>([])
  const [PAGE, setPage] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        type: report,
        days: String(days),
        limit: String(PAGE),
        offset: String(offset),
        ...(includeBots ? { bots: 'true' } : {}),
        ...(wholeNode && canSeeWholeNode ? { scope: 'platform' } : {}),
      })
      const res = await fetch(`/api/site-log/report?${qs}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not load that report.')
      setRows(json.rows || [])
      setTotal(typeof json.totalDocs === 'number' ? json.totalDocs : null)
      setHasMore(Boolean(json.hasMore))
      setPending(Boolean(json.pending))
      setVerdict(json.verdict ?? null)
      setGoals(json.goals ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that report.')
      setRows([])
      setVerdict(null)
    } finally {
      setLoading(false)
    }
  }, [report, days, includeBots, offset, wholeNode, canSeeWholeNode, PAGE])

  // Any change to WHAT is being asked resets WHERE we are in it — otherwise
  // switching report while on page 4 shows an empty page 4 of something else.
  useEffect(() => {
    setOffset(0)
  }, [report, days, includeBots, wholeNode, PAGE])

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
          {wholeNode
            ? 'Who is visiting every portal on this node, and what they are reading.'
            : `Who is visiting ${tenantName}, and what they are reading.`}
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

        <select
          value={PAGE}
          onChange={(e) => setPage(Number(e.target.value))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          title="Rows per page"
        >
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeBots}
            onChange={(e) => setIncludeBots(e.target.checked)}
          />
          Include crawlers
        </label>

        {/* Platform admins only — the whole node instead of this one portal.
            Every other viewer never sees this and cannot ask for it. */}
        {canSeeWholeNode && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wholeNode}
              onChange={(e) => setWholeNode(e.target.checked)}
            />
            Every portal
          </label>
        )}

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
          {!loading && rows.length > 0 && report !== 'variants' && (
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
        ) : rows.length === 0 && report === 'variants' ? (
          <EmptyState
            title="No test data yet"
            body="Every visitor is assigned to A or B automatically, so this fills in on its own once the site has traffic in this period."
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
        ) : report === 'variants' ? (
          <VariantsReport rows={rows as VariantRow[]} verdict={verdict} goals={goals} />
        ) : report === 'detail' ? (
          <>
            <DetailTable rows={rows as DetailRow[]} />
            <Pager
              offset={offset}
              count={rows.length}
              total={total}
              hasMore={hasMore}
              page={PAGE}
              onChange={setOffset}
              busy={loading}
            />
          </>
        ) : (
          <>
            <ReportChart rows={rows as AggregateRow[]} report={report} />
            <AggregateTable rows={rows as AggregateRow[]} report={report} />
          </>
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

/**
 * The A/B readout.
 *
 * Written for someone who is not a statistician, which is the whole design
 * constraint: the verdict sentence comes FIRST and in plain words, because the
 * failure mode this report exists to prevent is an owner seeing "B is up 40%"
 * on ninety visitors and rebuilding their home page around noise.
 */
function VariantsReport({
  rows,
  verdict,
  goals,
}: {
  rows: VariantRow[]
  verdict: Verdict | null
  goals: string[]
}) {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const best = rows.reduce<VariantRow | null>((a, b) => (!a || b.rate > a.rate ? b : a), null)

  return (
    <div className="space-y-4">
      {verdict && (
        <div
          className={`rounded-lg border p-4 ${
            verdict.significant
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-border bg-muted/20'
          }`}
        >
          <p className="font-medium">{verdict.note}</p>
          {verdict.lift !== null && (
            <p className="mt-1 text-sm text-muted-foreground">
              B is {verdict.lift >= 0 ? 'up' : 'down'} {pct(Math.abs(verdict.lift))} against A.
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Variant</th>
              <th className="py-2 pr-4 font-medium">Visitors</th>
              <th className="py-2 pr-4 font-medium">Conversions</th>
              <th className="py-2 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variant} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 font-medium uppercase">
                  {r.variant}
                  {best && r.variant === best.variant && verdict?.significant && (
                    <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-normal">
                      winning
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{r.visitors.toLocaleString()}</td>
                <td className="py-2 pr-4">{r.conversions.toLocaleString()}</td>
                <td className="py-2">{pct(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        A conversion counts when a visitor reaches {goals.length ? goals.join(', ') : 'a goal page'}.
      </p>
    </div>
  )
}

function DetailTable({ rows }: { rows: DetailRow[] }) {
  // Only widen the table when there is something to put in the column.
  const showPortal = rows.some((r) => r.portal)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">When</th>
            {showPortal && <th className="pb-2 pr-4">Portal</th>}
            <th className="pb-2 pr-4">Visitor</th>
            <th className="pb-2 pr-4">Page</th>
            <th className="pb-2 pr-4">Came from</th>
            <th className="pb-2">Device</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                {new Date(r.at).toLocaleString()}
              </td>
              {showPortal && (
                <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{r.portal || '—'}</td>
              )}
              <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                {r.visitor || 'unknown'}
              </td>
              <td className="py-2 pr-4 font-medium">{r.path}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.referrerHost || 'direct'}</td>
              <td className="py-2 text-muted-foreground">
                {r.device || '—'}
                {r.isBot && <span className="ml-2 text-xs opacity-70">crawler</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * "US" means nothing to a portal owner; "United States" does. Intl.DisplayNames
 * is in every browser we support, so the country list needs no lookup table and
 * speaks the reader's own language for free.
 */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

/** The reports that are a shape over time — the ones DNN drew as a graph. */
const TIME_SERIES = new Set<ReportId>(['by-day', 'by-hour', 'by-weekday'])

/**
 * The graph half of the Site Log. A column per period, drawn as plain divs.
 *
 * ponytail: no charting library. This is one series of non-negative numbers on a
 * shared baseline — flex + percentage heights say it exactly, in about thirty
 * lines, with no bundle and no theming layer to reconcile against the app's
 * tokens. Reach for a real chart library when there are two series and an axis
 * to negotiate.
 *
 * Labels thin out as the bars get thin, because forty overlapping dates is worse
 * than none — the tooltip and the table underneath both still carry every value.
 */
function ReportChart({ rows, report }: { rows: AggregateRow[]; report: ReportId }) {
  if (!TIME_SERIES.has(report) || rows.length < 2) return null
  const max = Math.max(...rows.map((r) => r.views), 1)
  // Show roughly a dozen labels however long the range is.
  const every = Math.ceil(rows.length / 12)

  return (
    <div className="mb-6 rounded-lg border border-border bg-muted/10 p-4">
      <div className="flex h-40 items-end gap-[2px]">
        {rows.map((r, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(2, Math.round((r.views / max) * 100))}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
              {r.label} · {r.views.toLocaleString()} view{r.views === 1 ? '' : 's'}
              {typeof r.visitors === 'number' ? ` · ${r.visitors.toLocaleString()} visitors` : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] text-[10px] text-muted-foreground">
        {rows.map((r, i) => (
          <div key={i} className="flex-1 overflow-hidden text-center">
            {i % every === 0 ? r.label.replace(/^\d{4}-/, '') : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function AggregateTable({ rows, report }: { rows: AggregateRow[]; report: ReportId }) {
  const max = Math.max(...rows.map((r) => r.views), 1)
  const firstHeader =
    report === 'pages' ? 'Page'
    : report === 'referrers' ? 'Source'
    : report === 'agents' ? 'Browser'
    : report === 'countries' ? 'Country'
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
                {report === 'visitors'
                  ? `Visitor ${r.label.slice(0, 6)}`
                  : report === 'countries'
                    ? countryName(r.label)
                    : r.label}
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

/**
 * Pagination for the detailed log. It listed the newest 100 hits and stopped —
 * on a portal with any traffic, the rest of the week simply was not reachable.
 * Offsets rather than cursors: the aggregate reports already think in limits,
 * and a visit log is append-only at the head, so a page never shifts under you.
 */
function Pager({
  offset,
  count,
  total,
  hasMore,
  page,
  onChange,
  busy,
}: {
  offset: number
  count: number
  total: number | null
  hasMore: boolean
  page: number
  onChange: (next: number) => void
  busy: boolean
}) {
  if (offset === 0 && !hasMore) return null
  const from = count ? offset + 1 : 0
  const to = offset + count
  return (
    <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4 text-sm">
      <span className="text-muted-foreground">
        {from}&ndash;{to}
        {total != null ? ` of ${total.toLocaleString()}` : ''}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || offset === 0}
          onClick={() => onChange(Math.max(0, offset - page))}
          className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
        >
          Newer
        </button>
        <button
          type="button"
          disabled={busy || !hasMore}
          onClick={() => onChange(offset + page)}
          className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
        >
          Older
        </button>
      </div>
    </div>
  )
}
