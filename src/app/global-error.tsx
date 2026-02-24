'use client'

/**
 * Global Error Boundary — Root-level catch for unhandled errors.
 *
 * This is the last line of defense. If an error escapes all other
 * error boundaries, this catches it and shows a recovery page.
 *
 * In production, this will also report to Sentry (when configured).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log error for debugging
  console.error('[GlobalError]', error)

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#0a0a0a',
          color: '#e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: 32,
            }}
          >
            &#x1f6e1;&#xfe0f;
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#a3a3a3', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            An unexpected error occurred. Your data is safe &mdash; this is a temporary issue.
            If it persists, please reach out to support.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
