/**
 * Customer orders page loading skeleton.
 */
export default function CustomerOrdersLoading() {
  return (
    <div className="container animate-pulse">
      <div className="max-w-4xl mx-auto my-12 space-y-6">
        <div className="h-8 w-32 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-6 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 w-24 rounded bg-muted" />
              <div className="h-6 w-20 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
