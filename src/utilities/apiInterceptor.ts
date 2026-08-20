import { logApi, logError } from '@/services/SystemMonitorService'
import { logClientError } from '@/utilities/logClientError'

/**
 * URLs that are high-frequency polls / prefetches OR the error sink itself.
 * Per the project rule (user actions → logError; polls → console only), these
 * must NOT escalate to the canonical pipeline — and `/api/log-ops/client-error`
 * MUST be excluded or the interceptor would recurse on its own POST.
 */
const NO_ESCALATE = [
  '/api/log-ops/client-error', // the sink itself — escalating it = infinite loop
  '/api/ai-bus/poll',
  '/api/presence', // presence-ping / presence-online
  '/api/users/me', // prefetch
  '/api/dashboard/presence',
]

function shouldEscalate(url: string): boolean {
  return !NO_ESCALATE.some((skip) => url.includes(skip))
}

/**
 * A same-origin /api/ 5xx is already escalated server-side by the endpoint's own
 * logError / the afterError hook — re-escalating from the client would double-log
 * it. Client-worthy escalations are 4xx (which the server often doesn't log) and
 * network/transport failures. So skip our-own-API server errors here.
 */
function isOwnApiServerError(url: string, status: number): boolean {
  if (status < 500) return false
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined)
    const sameOrigin = typeof window === 'undefined' || u.origin === window.location.origin
    return sameOrigin && u.pathname.startsWith('/api/')
  } catch {
    return url.includes('/api/')
  }
}

// Dedupe + rate-limit so a flapping endpoint can't spam the AI Bus. Key by
// method+url+status; suppress repeats within the window.
const ESCALATE_WINDOW_MS = 60_000
const recentEscalations = new Map<string, number>()

function escalateOnce(key: string): boolean {
  const now = Date.now()
  const last = recentEscalations.get(key)
  if (last && now - last < ESCALATE_WINDOW_MS) return false
  recentEscalations.set(key, now)
  // Bound the map so it can't grow unbounded over a long session.
  if (recentEscalations.size > 200) {
    for (const [k, t] of recentEscalations) {
      if (now - t > ESCALATE_WINDOW_MS) recentEscalations.delete(k)
    }
  }
  return true
}

/**
 * Wraps fetch to (1) feed the in-app System Console (logApi/logError, console
 * only by design) AND (2) escalate genuine API failures to the CANONICAL error
 * pipeline (logClientError → application-logs + AI Bus), so the self-improvement
 * loop actually sees client-side failures instead of them dying in the console.
 */
export function createApiInterceptor() {
  if (typeof window === 'undefined') return // Only run on client
  // Idempotent — never patch window.fetch twice (React strict-mode double-effects,
  // remounts, HMR would otherwise stack interceptors).
  if ((window as unknown as { __apiInterceptorInstalled?: boolean }).__apiInterceptorInstalled) return
  ;(window as unknown as { __apiInterceptorInstalled?: boolean }).__apiInterceptorInstalled = true

  const originalFetch = window.fetch

  window.fetch = async function(...args) {
    const [input, init] = args
    const url = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.toString() 
        : input.url
    const method = init?.method || 'GET'
    const startTime = Date.now()

    try {
      const response = await originalFetch.apply(this, args)
      const duration = Date.now() - startTime

      // In-app System Console (console-only telemetry).
      logApi(method, url, response.status, duration)

      if (!response.ok && response.status >= 400) {
        logError(
          `API Error: ${method} ${url} - ${response.status} ${response.statusText}`,
          'API',
          { status: response.status, statusText: response.statusText }
        )
        // Escalate real failures to the canonical pipeline (deduped, poll-skipped,
        // and not our own /api/ 5xx which the server already logs).
        if (shouldEscalate(url) && !isOwnApiServerError(url, response.status) && escalateOnce(`${method} ${url} ${response.status}`)) {
          logClientError({
            source: 'client/fetch',
            message: `API ${response.status} ${method} ${url}`,
            details: `status=${response.status} statusText=${response.statusText} duration=${duration}ms`,
          })
        }
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      const detail = error instanceof Error ? error.message : String(error)
      logError(
        `Network Error: ${method} ${url}`,
        'API',
        { error: detail, duration }
      )
      // An aborted fetch is not a failure — it's the user navigating away, or a
      // poll cancelling its own in-flight request. Logging those made
      // `client/fetch` the loudest unresolved source in the error log.
      const aborted =
        (error instanceof Error && error.name === 'AbortError') ||
        /abort/i.test(detail)

      // A thrown fetch = network/transport failure. Escalate (deduped, poll-skipped),
      // but never for the sink itself (would loop) or polls.
      if (!aborted && shouldEscalate(url) && escalateOnce(`${method} ${url} network`)) {
        logClientError({
          source: 'client/fetch',
          message: `Network error ${method} ${url}`,
          details: `${detail} (duration=${duration}ms)`,
        })
      }
      throw error
    }
  }
}

// Initialize the interceptor
if (typeof window !== 'undefined') {
  createApiInterceptor()
}
