/**
 * Runs once per server process, before any route handler.
 *
 * Class fix for footgun 2.1 (docs/FOOTGUNS.md): Node's `fetch` has a 300s
 * default. Two separate production hangs — the image-analysis stall and a
 * media download inside a streaming turn — were bare `fetch` calls waiting
 * out that default inside a request path. There are ~240 fetch sites in
 * `src/`; rather than annotate each one (and every future one), give the
 * runtime a bounded default.
 *
 * An explicit `signal` always wins, so a caller that genuinely needs longer
 * — or shorter — just passes its own.
 */
const DEFAULT_FETCH_TIMEOUT_MS = 180_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as typeof globalThis & { __fetchTimeoutInstalled?: boolean }
  if (g.__fetchTimeoutInstalled) return
  g.__fetchTimeoutInstalled = true

  const original = globalThis.fetch
  globalThis.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    // ponytail: only fills the gap — never overrides an explicit signal.
    if (init?.signal || (input instanceof Request && input.signal)) return original(input, init)
    return original(input, { ...init, signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS) })
  } as typeof fetch
}
