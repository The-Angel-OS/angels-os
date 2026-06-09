/**
 * logClientError — fire-and-forget client → server error routing.
 *
 * Posts a *user-action* failure to /api/log-ops/client-error, which calls the
 * server-side `logError` (application-logs + AI Bus errors channel). Use this for
 * things a person did (e.g. opening the file viewer, a failed save) — NOT for
 * high-frequency polls (those use console.error to avoid spamming the AI Bus).
 *
 * @see project_deep_link_navigation — the error-logging rule for this layer.
 */
// Relative URL — same-origin so the session cookie rides along on tenant
// subdomains (NEXT_PUBLIC_SERVER_URL points at the apex → cross-origin). See
// useSpaces.ts / FilesBrowser.tsx for the same gotcha.
const SERVER_URL = ''

export interface ClientErrorInput {
  /** Component + action, e.g. 'FilesBrowser/load' */
  source: string
  message: string
  details?: string
  /** Space the action happened in — lets the server resolve the tenant for AI Bus routing. */
  spaceId?: string | number | null
}

export function logClientError(input: ClientErrorInput): void {
  // Best-effort: never throw, never block the UI.
  try {
    void fetch(`${SERVER_URL}/api/log-ops/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({
        source: input.source,
        message: input.message,
        details: input.details,
        spaceId: input.spaceId ?? undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}
