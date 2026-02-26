/**
 * Posts page loading skeleton.
 */
export default function PostsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-20 rounded bg-muted" />
        <div className="h-9 w-28 rounded bg-muted" />
      </div>

      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-4">
          <div className="h-16 w-16 rounded bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </div>
          <div className="h-6 w-20 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}
