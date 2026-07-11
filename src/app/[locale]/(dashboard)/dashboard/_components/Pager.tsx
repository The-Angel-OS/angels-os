'use client'

/**
 * Pager — shared previous/next pager for dashboard list views. Reads the current
 * pathname + query string and preserves all params (q, filters, limit) while
 * flipping `?page=`. Presentational; the server page owns the actual query.
 */
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  const pathname = usePathname()
  const params = useSearchParams()

  if (totalPages <= 1) return null

  const href = (p: number) => {
    const sp = new URLSearchParams(params.toString())
    if (p > 1) sp.set('page', String(p))
    else sp.delete('page')
    const s = sp.toString()
    return s ? `${pathname}?${s}` : pathname
  }

  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      {hasPrev ? (
        <Link href={href(page - 1)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">← Prev</Link>
      ) : (
        <span className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/50">← Prev</span>
      )}
      <span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      {hasNext ? (
        <Link href={href(page + 1)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Next →</Link>
      ) : (
        <span className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground/50">Next →</span>
      )}
    </div>
  )
}
