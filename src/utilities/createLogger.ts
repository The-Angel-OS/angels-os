/**
 * createLogger — a source-bound logger factory over `logError`.
 *
 * Inspired by the DNN/Bisk pattern `LoggerSource.Instance.GetLogger(typeof(X))`:
 * each module gets a logger pre-bound to its source (and optional default context
 * like tenantId/url), so every line is automatically attributed without repeating
 * the `source` string at every call site. It rides the existing `logError`
 * pipeline — ApplicationLogs + AI-Bus errors channel + escalation — unchanged.
 *
 * @example
 * const log = createLogger('bookingEngine', { tenantId })
 * log.error('slot conflict', { details, statusCode: 409 })
 * log.info('resolved harmonically')
 * await log.caught(err)                    // Error object → message + stack
 * const reqLog = log.child({ url })        // bind more defaults per request
 *
 * @see src/utilities/logError.ts
 */
import { logError, type LogErrorOptions, type LogLevel } from '@/utilities/logError'

/** Per-call extra context — everything logError accepts except what the factory binds. */
export type LogExtra = Partial<Omit<LogErrorOptions, 'source' | 'message' | 'level'>>

/** Defaults bound at logger-creation time (merged under every call's extra). */
export type LoggerDefaults = Partial<Omit<LogErrorOptions, 'source' | 'message'>>

export interface Logger {
  error(message: string, extra?: LogExtra): Promise<void>
  /** Maps to logError level 'warning'. */
  warn(message: string, extra?: LogExtra): Promise<void>
  info(message: string, extra?: LogExtra): Promise<void>
  debug(message: string, extra?: LogExtra): Promise<void>
  /** Log an Error/unknown with automatic message + stack extraction. */
  caught(err: unknown, extra?: LogExtra): Promise<void>
  /** Derive a new logger with additional bound defaults (same source). */
  child(extraDefaults: LoggerDefaults): Logger
  /** The bound source, exposed for composition (e.g. trace emission). */
  readonly source: string
}

/**
 * The sink the factory writes through. Defaults to `logError`; injectable so the
 * factory is unit-testable without booting Payload.
 */
export type LogSink = (options: LogErrorOptions) => Promise<void>

export function createLogger(
  source: string,
  defaults: LoggerDefaults = {},
  sink: LogSink = logError,
): Logger {
  const emit = (level: LogLevel, message: string, extra?: LogExtra) =>
    sink({ ...defaults, ...extra, level, source, message })

  return {
    source,
    error: (message, extra) => emit('error', message, extra),
    warn: (message, extra) => emit('warning', message, extra),
    info: (message, extra) => emit('info', message, extra),
    debug: (message, extra) => emit('debug', message, extra),
    caught: (err, extra) => {
      const error = err instanceof Error ? err : new Error(String(err))
      return emit('error', error.message, { details: error.stack, ...extra })
    },
    child: (extraDefaults) => createLogger(source, { ...defaults, ...extraDefaults }, sink),
  }
}
