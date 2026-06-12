/**
 * surfaceStore — the shared, persisted "current Surface" (space + channel).
 *
 * The selected Surface is a SINGLE app-wide fact, not per-component state. Every
 * ChatProvider mount (the dashboard Spaces tab, the (app) /spaces view, the
 * floating side viewer) reads its initial selection from here and writes changes
 * back — so:
 *   - navigating away never loses the space/channel (localStorage rehydrate), and
 *   - two visible surfaces sync live: changing the chooser in either updates both
 *     (in-process pub/sub), and other tabs follow too (the `storage` event).
 *
 * This is the "subscription to a common event" the Spaces UX was meant to have.
 * Realizes the Surface={space,channel,position} deep-link model (position TBD).
 */
export interface Surface {
  spaceId: string | null
  channelSlug: string
}

const KEY = 'angel-os:surface'
const EMPTY: Surface = { spaceId: null, channelSlug: '' }

type Listener = (s: Surface) => void
const listeners = new Set<Listener>()
let current: Surface | null = null

function read(): Surface {
  if (typeof window === 'undefined') return { ...EMPTY }
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Surface>
      return { spaceId: parsed.spaceId ?? null, channelSlug: parsed.channelSlug ?? '' }
    }
  } catch {
    /* corrupt / unavailable — fall through to empty */
  }
  return { ...EMPTY }
}

/** Reset in-memory state — TESTS ONLY. */
export function __resetSurface(): void {
  current = null
  listeners.clear()
}

/** Current Surface (lazy-loaded from localStorage on first read). */
export function getSurface(): Surface {
  if (!current) current = read()
  return current
}

/**
 * Merge-update the Surface. No-ops when nothing changed (prevents pub/sub loops),
 * persists to localStorage, and notifies in-process subscribers.
 */
export function setSurface(patch: Partial<Surface>): void {
  const prev = getSurface()
  const next: Surface = {
    spaceId: patch.spaceId !== undefined ? patch.spaceId : prev.spaceId,
    channelSlug: patch.channelSlug !== undefined ? patch.channelSlug : prev.channelSlug,
  }
  if (next.spaceId === prev.spaceId && next.channelSlug === prev.channelSlug) {
    return // unchanged — prevents pub/sub loops
  }
  current = next
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full / blocked — keep in-memory copy */
  }
  for (const l of listeners) l(next)
}

/**
 * Subscribe to Surface changes (in-process AND cross-tab via the storage event).
 * Returns an unsubscribe function.
 */
export function subscribeSurface(fn: Listener): () => void {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && e.newValue) {
      try {
        current = JSON.parse(e.newValue) as Surface
        fn(current)
      } catch {
        /* ignore malformed cross-tab payload */
      }
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}
