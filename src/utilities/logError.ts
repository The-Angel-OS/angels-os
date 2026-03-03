import { createSystemActionContent } from '@/utilities/messageContent'
import { AI_BUS_SPACE_SLUG } from '@/utilities/ensureSystemSpace'

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

/** Emoji prefix by log level for AI Bus messages */
const LEVEL_EMOJI: Record<LogLevel, string> = {
  error: '\u26D4',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
  debug: '\uD83D\uDD0D',
}

/**
 * Log an application error to ApplicationLogs AND the AI Bus errors channel.
 *
 * Dual-write strategy:
 *   1. Always persists to `application-logs` (admin dashboard triage)
 *   2. When tenantId is available, also emits a Message to the AI Bus
 *      `errors` channel in UMS format — making errors visible to LEO
 *      and any subscribed agents in real-time.
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
 *     tenantId: 1,  // enables AI Bus routing
 *   })
 * }
 * ```
 */
export async function logError(options: LogErrorOptions): Promise<void> {
  try {
    // Lazy import: avoids pulling @payload-config into every module that imports logError
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })

    // 1. Always persist to application-logs
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

    // 2. Route to AI Bus errors channel (if tenant context available)
    if (options.tenantId) {
      await emitToAiBus(payload, options).catch(() => {
        // Non-critical — don't let AI Bus failure block error logging
      })
    }
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

// ─── AI Bus Integration ──────────────────────────────────────────────────────

/**
 * Emit an error as a UMS message to the AI Bus `errors` channel.
 * This makes system errors visible to LEO and other subscribed agents.
 */
async function emitToAiBus(
  payload: { find: Function; create: Function },
  options: LogErrorOptions,
): Promise<void> {
  const tenantId = options.tenantId!
  const level = options.level ?? 'error'

  // Find the AI Bus space for this tenant
  const aiBusSpaces = await payload.find({
    collection: 'spaces',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { equals: AI_BUS_SPACE_SLUG } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const aiBusSpace = aiBusSpaces.docs?.[0]
  if (!aiBusSpace) return // AI Bus space doesn't exist yet for this tenant

  // Build UMS message content
  const emoji = LEVEL_EMOJI[level]
  const summary = `${emoji} **[${level.toUpperCase()}]** ${options.source}: ${options.message}`
  const content = createSystemActionContent(summary, {
    type: 'error_log',
    level,
    source: options.source,
    message: options.message,
    details: options.details,
    statusCode: options.statusCode,
    url: options.url,
  })

  // Create message in the errors channel
  await payload.create({
    collection: 'messages',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      content,
      space: aiBusSpace.id,
      channel: 'errors',
      messageType: 'system',
      visibility: 'tenant',
      priority: level === 'error' ? 'high' : 'normal',
      metadata: {
        source: options.source,
        level,
        statusCode: options.statusCode,
        url: options.url,
        userId: options.userId,
      },
      tenant: tenantId as number,
    } as any,
    overrideAccess: true,
  })
}
