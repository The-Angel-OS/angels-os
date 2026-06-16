'use client'

import Link from 'next/link'
import { getAllSouls, type SoulManifest } from '@/souls'

/**
 * WorksGrid — the list of Library works (books, case files, manifestos), rendered
 * as a grid of cards that link straight into each work's reader.
 *
 * Shared between the /learn hub (quick-access, near the top) and the dedicated
 * /learn/works Library page, so both stay in sync from one source: the soul
 * registry. getAllSouls() returns static manifest objects (no server-only deps),
 * so this is safe to render inside client components like LearnExperience.
 */

const STATUS_COLORS: Record<string, string> = {
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export function WorksGrid({
  className = '',
  souls,
}: {
  className?: string
  /** Tenant-scoped list to render. Defaults to ALL souls (unscoped). */
  souls?: SoulManifest[]
}) {
  const works = souls ?? getAllSouls()

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      {works.map((soul) => {
        const colorClass =
          STATUS_COLORS[soul.statusColor] ?? 'bg-muted/40 text-muted-foreground border-border'
        const docCount = soul.docs.length

        return (
          <Link
            key={soul.id}
            href={`/learn/${soul.id}`}
            className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <h3 className="text-base font-bold leading-tight tracking-tight transition-colors group-hover:text-primary">
                {soul.title}
              </h3>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}
              >
                {soul.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{soul.subtitle}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {soul.description}
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {docCount} document{docCount !== 1 ? 's' : ''}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {soul.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="ml-auto font-medium text-primary group-hover:underline">Open →</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
