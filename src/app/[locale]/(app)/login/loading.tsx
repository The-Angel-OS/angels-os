/**
 * Login page loading skeleton.
 */
export default function LoginLoading() {
  return (
    <div className="container animate-pulse">
      <div className="max-w-xl mx-auto my-12">
        <div className="mb-4 h-8 w-24 rounded bg-muted" />
        <div className="mb-8 h-5 w-80 rounded bg-muted" />
        <div className="space-y-4">
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 w-32 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
