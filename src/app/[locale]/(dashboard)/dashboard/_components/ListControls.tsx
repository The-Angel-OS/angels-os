'use client'

/**
 * ListControls — shared URL-as-state filter bar for dashboard list views
 * (Media, Posts, Products, Pages). Generalizes the old MediaFilters so one maker
 * serves every list: debounced search (`?q=`), optional tab filter (`?<param>=`),
 * and a page-size selector (`?limit=`, default 30). Every change resets `?page=`.
 *
 * Server pages read these params, build the Payload `where` + `limit/page`, and
 * render — so filtering/paging spans the WHOLE tenant collection, not just the
 * loaded rows, and every view is a shareable URL.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '@/utilities/pageSize'

export interface ListTab {
  key: string
  label: string
}

export function ListControls({
  searchPlaceholder = 'Search…',
  tabParam,
  tabs,
  showPageSize = true,
}: {
  searchPlaceholder?: string
  /** Query-string key the tab filter writes to (e.g. 'type' for media, 'status'). */
  tabParam?: string
  /** Tab options; the first is treated as the "all"/default (clears the param). */
  tabs?: ListTab[]
  showPageSize?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const defaultTab = tabs?.[0]?.key ?? 'all'
  const activeTab = (tabParam && params.get(tabParam)) || defaultTab
  const [q, setQ] = useState(params.get('q') || '')
  const firstRender = useRef(true)

  // Push a new query string; always reset to page 1 when any filter changes.
  function apply(mutate: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString())
    mutate(sp)
    sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = setTimeout(() => apply((sp) => (q ? sp.set('q', q) : sp.delete('q'))), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const currentLimit = Number(params.get('limit')) || DEFAULT_PAGE_SIZE

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
          style={{ fontSize: '16px' }}
        />
      </div>

      {tabParam && tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => apply((sp) => (t.key === defaultTab ? sp.delete(tabParam) : sp.set(tabParam, t.key)))}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {showPageSize && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Show</span>
          <select
            value={currentLimit}
            onChange={(e) =>
              apply((sp) =>
                Number(e.target.value) === DEFAULT_PAGE_SIZE
                  ? sp.delete('limit')
                  : sp.set('limit', e.target.value),
              )
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
