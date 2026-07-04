import { logError } from '@/utilities/logError'

/**
 * Config-level afterError hook — the single chokepoint where Payload surfaces
 * EVERY admin/API/save error. Without this, a failing collection save (bad
 * validation, missing block table, tenant-resolution throw, locked-doc-rels
 * drift) returns a generic toast to the admin UI and vanishes — it never
 * reaches `application-logs`, the AI Bus `errors` channel, or Gotify.
 *
 * Routing all of it through logError() makes those failures visible in the
 * error-log viewer and the Spaces AI bus, per the unified escalation triage.
 *
 * Fail-soft: never throw from here, or we'd mask the original error.
 */
export const afterErrorHook = async (args: any) => {
  try {
    const { error, req, collection } = args ?? {}
    if (!error) return

    // Triage before logging: expected client errors are noise in the error log.
    // Skip 404s entirely; downgrade the rest of the 4xx band to 'warning' so
    // genuine 5xx faults remain the signal. (A triageable log is the prerequisite
    // for anything — LEO or human — actually consuming the errors channel.)
    const status = typeof error?.status === 'number' ? error.status : 500
    if (status === 404) return
    const level: 'error' | 'warning' = status >= 400 && status < 500 ? 'warning' : 'error'

    const source = collection?.slug
      ? `payload/${collection.slug}/save`
      : 'payload/api'

    // Best-effort context — none of these are guaranteed on every error path.
    const userId = req?.user?.id
    const tenantId =
      req?.data?.tenant ??
      req?.user?.lastLoggedInTenant ??
      req?.user?.tenant ??
      undefined

    await logError({
      level,
      source,
      message: error?.message ? String(error.message) : 'Unknown Payload error',
      // Payload validation errors carry a `data`/`errors` array with field-level detail.
      details: [error?.stack, JSON.stringify(error?.data ?? error?.errors ?? null)]
        .filter(Boolean)
        .join('\n'),
      statusCode: status,
      url: req?.url,
      userId,
      tenantId,
    }).catch(() => {})
  } catch {
    // ponytail: swallow — an error logger that throws is worse than no logger.
  }
}
