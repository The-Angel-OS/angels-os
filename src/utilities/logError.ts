import { getPayload } from 'payload'
import config from '@payload-config'

export type LogLevel = 'error' | 'warning' | 'info' | 'debug'

export interface LogErrorOptions {
  /** Severity level (default: 'error') */
  level?: LogLevel
  /** Component, module, or API route that generated the error */
  source: string
  /** Human-readable error description */
  message: string
  /** Stack trace, request body, or additional context */
  details?: string
  /** HTTP status code if applicable */
  statusCode?: number
  /** Request URL or page URL */
  url?: string
  /** User-agent string */
  userAgent?: string
  /** User ID (if authenticated) */
  userId?: string | number
  /** Tenant ID for context */
  tenantId?: string | number
}

/**
 * Log an application error to the ApplicationLogs collection.
 *
 * Call this from server actions, API routes, hooks, or any server-side code
 * to persist errors for admin triage.
 *
 * @example
 * ```ts
 * import { logError } from '@/utilities/logError'
 *
 * try {
 *   await riskyOperation()
 * } catch (err) {
 *   await logError({
 *     source: 'ChatControl/sendMessage',
 *     message: `Failed to send message: ${err.message}`,
 *     details: err.stack,
 *     statusCode: 400,
 *   })
 * }
 * ```
 */
export async function logError(options: LogErrorOptions): Promise<void> {
  try {
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'application-logs',
      data: {
        level: options.level ?? 'error',
        source: options.source,
        message: options.message,
        details: options.details,
        statusCode: options.statusCode,
        url: options.url,
        userAgent: options.userAgent,
        userId: options.userId != null ? String(options.userId) : undefined,
        tenantId: options.tenantId != null ? String(options.tenantId) : undefined,
        resolved: false,
      },
      overrideAccess: true,
    })
  } catch (err) {
    // Fallback: if we can't log to DB, at least log to console
    console.error('[logError] Failed to persist log entry:', err)
    console.error('[logError] Original error:', options)
  }
}

/**
 * Convenience: log an Error object with automatic stack extraction.
 */
export async function logCaughtError(
  source: string,
  err: unknown,
  extra?: Partial<Omit<LogErrorOptions, 'source' | 'message' | 'details'>>,
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err))
  await logError({
    source,
    message: error.message,
    details: error.stack,
    ...extra,
  })
}
