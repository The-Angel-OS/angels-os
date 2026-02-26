/**
 * Dashboard overview loading skeleton — shown while server data (stats, charts) loads.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="text-center">
        <div className="mx-auto h-8 w-48 rounded bg-muted" />
        <div className="mx-auto mt-2 h-4 w-32 rounded bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-5 text-center">
            <div className="mx-auto h-8 w-16 rounded bg-muted" />
            <div className="mx-auto mt-2 h-4 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-lg border border-border bg-muted/30" />
        <div className="h-64 rounded-lg border border-border bg-muted/30" />
      </div>

      {/* Quick access cards */}
      <div>
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center rounded-lg border border-border p-6">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="mt-3 h-5 w-20 rounded bg-muted" />
              <div className="mt-1 h-4 w-32 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
