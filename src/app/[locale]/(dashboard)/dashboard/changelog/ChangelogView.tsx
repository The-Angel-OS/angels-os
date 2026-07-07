'use client'

/**
 * ChangelogView — renders the parsed git history (grouped by day) with a type
 * filter and a free-text search. Data comes pre-fetched from the server page;
 * filtering is client-side over the already-loaded set (no round-trips).
 */

import React from 'react'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/utilities/cn'
import type { Changelog, ChangelogEntry } from '@/utilities/changelog'

// Type → label + color token. Unknown types fall through to 'other'.
const TYPE_META: Record<string, { label: string; className: string }> = {
  feat: { label: 'Feature', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  fix: { label: 'Fix', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  docs: { label: 'Docs', className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30' },
  refactor: { label: 'Refactor', className: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30' },
  perf: { label: 'Perf', className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
  test: { label: 'Test', className: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30' },
  chore: { label: 'Chore', className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' },
  style: { label: 'Style', className: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30' },
  build: { label: 'Build', className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  ci: { label: 'CI', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  other: { label: 'Other', className: 'bg-muted text-muted-foreground border-border' },
}

function typeMeta(type: string) {
  return TYPE_META[type] || TYPE_META.other
}

function formatDay(date: string): string {
  if (date === 'undated') return 'Undated'
  // Parse as UTC noon to avoid TZ drift shifting the date label.
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function TypeBadge({ type, breaking }: { type: string; breaking: boolean }) {
  const meta = typeMeta(type)
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', meta.className)}>
        {meta.label}
      </span>
      {breaking && (
        <span className="inline-block rounded border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
          Breaking
        </span>
      )}
    </span>
  )
}

function EntryRow({ e }: { e: ChangelogEntry }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <TypeBadge type={e.type} breaking={e.breaking} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {e.scope && <span className="font-medium text-muted-foreground">{e.scope}: </span>}
          <span className="text-foreground">{e.subject}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{e.author}</p>
      </div>
      <a
        href={e.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 font-mono text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        title="View commit on GitHub"
      >
        {e.shortSha}
      </a>
    </li>
  )
}

export default function ChangelogView({ data }: { data: Changelog }) {
  const [activeType, setActiveType] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')

  const q = query.trim().toLowerCase()

  const filteredDays = React.useMemo(() => {
    return data.days
      .map((day) => ({
        ...day,
        entries: day.entries.filter((e) => {
          if (activeType && e.type !== activeType) return false
          if (q) {
            const hay = `${e.scope || ''} ${e.subject} ${e.author}`.toLowerCase()
            if (!hay.includes(q)) return false
          }
          return true
        }),
      }))
      .filter((day) => day.entries.length > 0)
  }, [data.days, activeType, q])

  const shownCount = filteredDays.reduce((n, d) => n + d.entries.length, 0)

  // Type chips ordered by frequency, most-common first.
  const typeOrder = Object.entries(data.typeCounts).sort((a, b) => b[1] - a[1])

  return (
    <Panel
      id="changelog"
      title="Changelog"
      headerRight={
        <a
          href={`https://github.com/${data.repo}/commits/${data.branch}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          {data.repo} · {data.branch}
        </a>
      }
    >
      {data.error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {data.error}
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              activeType === null ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30',
            )}
          >
            All {data.total}
          </button>
          {typeOrder.map(([type, count]) => {
            const meta = typeMeta(type)
            const isActive = activeType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(isActive ? null : type)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive ? meta.className : 'border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                {meta.label} {count}
              </button>
            )
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commits…"
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary/40"
        />
      </div>

      {shownCount === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No commits match this filter.</p>
      ) : (
        <div className="space-y-6">
          {filteredDays.map((day) => (
            <div key={day.date}>
              <h3 className="sticky top-0 z-10 -mx-1 mb-1 bg-card/80 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {formatDay(day.date)}
                <span className="ml-2 font-normal normal-case text-muted-foreground/70">{day.entries.length}</span>
              </h3>
              <ul className="divide-y divide-border/60">
                {day.entries.map((e) => (
                  <EntryRow key={e.sha} e={e} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
