'use client'

/**
 * MediaFilters — URL-as-state filter bar for the Media Library.
 *
 * Payload best practice for a large library is SERVER-side pagination + where
 * filtering (not loading everything and filtering in the browser). This client
 * component owns only the filter UI: it debounces the search box and pushes
 * `?q=&type=&page=` to the URL; the server page reads those params, queries
 * Payload with the matching `where` + `limit/page`, and renders the page. So the
 * filter spans the WHOLE library, not just the loaded rows, and every view is a
 * shareable URL.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'document', label: 'Documents' },
] as const

export function MediaFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const activeType = params.get('type') || 'all'
  const [q, setQ] = useState(params.get('q') || '')
  const firstRender = useRef(true)

  // Push a new query string, always resetting to page 1 when a filter changes.
  function apply(next: { q?: string; type?: string }) {
    const sp = new URLSearchParams(params.toString())
    if (next.q !== undefined) next.q ? sp.set('q', next.q) : sp.delete('q')
    if (next.type !== undefined) next.type === 'all' ? sp.delete('type') : sp.set('type', next.type)
    sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = setTimeout(() => apply({ q }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by filename…"
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
        />
      </div>
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => apply({ type: t.key })}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeType === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
