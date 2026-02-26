/**
 * Spaces page loading skeleton — channels + chat area.
 */
export default function SpacesLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] animate-pulse">
      {/* Channel list */}
      <div className="w-64 border-r border-border p-4 space-y-3">
        <div className="h-6 w-32 rounded bg-muted mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
        ))}
        <div className="h-6 w-40 rounded bg-muted mt-6 mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <div className="h-6 w-6 rounded-full bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border p-4">
          <div className="h-6 w-40 rounded bg-muted" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'justify-end'}`}>
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="space-y-1 max-w-[60%]">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  )
}
