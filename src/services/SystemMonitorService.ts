/**
 * System monitor logging for the in-app API interceptor (the live "System
 * Console" telemetry feed).
 *
 * ⚠️ NOT the canonical error pipeline. `logError` here is CONSOLE-ONLY — it does
 * NOT reach application-logs / the AI Bus / Gotify. The interceptor
 * (apiInterceptor.ts) separately routes genuine failures to the canonical
 * `logClientError` so the self-improvement loop sees them. Don't mistake this
 * for `@/utilities/logError` or `@/utilities/logClientError`.
 */
export function logApi(
  method: string,
  url: string,
  status: number,
  durationMs: number,
): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[API] ${method} ${url} ${status} ${durationMs}ms`)
  }
}

export function logError(
  message: string,
  category: string,
  context?: Record<string, unknown>,
): void {
  console.error(`[${category}] ${message}`, context ?? '')
}
