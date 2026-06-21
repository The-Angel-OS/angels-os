'use client'

/**
 * Dashboard error boundary — catches errors in the (dashboard) route group.
 * Shows a warm recovery message. Follows the Anti-Daemon Protocol.
 *
 * Logging: best-effort report to the central error log (/api/log-ops/client-error)
 * so recoverable errors land in application-logs + the AI Bus. NOTE: when the
 * failure IS Payload failing to initialize (e.g. a node's DB is unreachable), the
 * DB-backed log can't be written — physics, not a bug — so we ALSO surface the
 * `digest` to the operator. The digest links to the server-side entry Next logged
 * (visible in the Vercel runtime logs), which is the diagnostic key.
 */
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Local first (always visible).
    console.error('[Dashboard Error]', error?.message, error?.digest, error)
    // Best-effort durable log — fail-soft (no-ops if Payload itself is down).
    try {
      void fetch('/api/log-ops/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: 'dashboard/error-boundary',
          message: `Dashboard render error${error?.digest ? ` [digest ${error.digest}]` : ''}: ${error?.message || 'unknown'}`,
          details: error?.stack,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {})
    } catch {
      /* never let logging break the boundary */
    }
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
          <svg
            className="h-8 w-8 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold">Dashboard hiccup</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Something unexpected happened while loading the dashboard. Your data is safe &mdash;
          this is a temporary issue.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Try again
        </button>
        {error?.digest && (
          <p className="mt-5 text-[11px] font-mono text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
