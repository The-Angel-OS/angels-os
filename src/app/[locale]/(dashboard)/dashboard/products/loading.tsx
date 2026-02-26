/**
 * Products page loading skeleton.
 */
export default function ProductsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 rounded bg-muted" />
        <div className="h-9 w-36 rounded bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden">
            <div className="aspect-square bg-muted" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
