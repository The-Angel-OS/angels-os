'use client'

import { useState, useTransition } from 'react'
import { BookOpen, FileText, Loader2 } from 'lucide-react'
import { setWorkCarried, type ShelfWork } from './actions'

/**
 * The Library shelf — pick which Works this portal carries.
 *
 * Turning one off hides it from this portal's Library, nav and readers; it stays
 * exactly where it is for every other portal. A Work this portal OWNS can't be
 * switched off here — unpublish it in the Work itself instead.
 */
export function LibraryShelf({ initial, portalName }: { initial: ShelfWork[]; portalName: string }) {
  const [works, setWorks] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (!works.length) return null

  const toggle = (w: ShelfWork) => {
    const next = !w.carried
    setBusy(w.slug)
    setError(null)
    // Optimistic — the shelf is a preference, not money.
    setWorks((prev) => prev.map((x) => (x.slug === w.slug ? { ...x, carried: next } : x)))
    startTransition(async () => {
      const res = await setWorkCarried(w.slug, next)
      if (!res.success) {
        setWorks((prev) => prev.map((x) => (x.slug === w.slug ? { ...x, carried: !next } : x)))
        setError(res.error ?? 'Could not save that.')
      }
      setBusy(null)
    })
  }

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">The Library on {portalName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose what your visitors can read here. Everything else stays untouched on the portals
        that carry it.
      </p>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <ul className="mt-4 divide-y divide-border">
        {works.map((w) => (
          <li key={w.slug} className="flex items-center gap-3 py-3">
            {w.type === 'book' ? (
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{w.title}</div>
              {w.subtitle && (
                <div className="truncate text-xs text-muted-foreground">{w.subtitle}</div>
              )}
            </div>
            {w.canToggle ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                {busy === w.slug && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={w.carried}
                  onChange={() => toggle(w)}
                  aria-label={`Carry ${w.title} on this portal`}
                />
                <span className="w-16 text-muted-foreground">{w.carried ? 'Showing' : 'Hidden'}</span>
              </label>
            ) : (
              <a
                href={`/dashboard/works/${w.slug}/edit`}
                className="w-24 text-right text-xs text-primary underline-offset-2 hover:underline"
              >
                Edit
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
