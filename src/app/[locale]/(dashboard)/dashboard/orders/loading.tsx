/**
 * Orders page loading skeleton.
 */
export default function OrdersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 rounded bg-muted" />
        <div className="h-9 w-32 rounded bg-muted" />
      </div>

      {/* Table header */}
      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-5 gap-4 border-b border-border p-4">
          {['Order', 'Customer', 'Status', 'Date', 'Total'].map((_, i) => (
            <div key={i} className="h-4 w-20 rounded bg-muted" />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 border-b border-border p-4 last:border-0">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
