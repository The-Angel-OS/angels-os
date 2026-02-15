/**
 * System monitor logging for API interceptor.
 * Logs API calls and errors (can be extended to send to backend/dashboard).
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
