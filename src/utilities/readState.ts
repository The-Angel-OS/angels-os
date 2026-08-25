/**
 * Read state — what you have already seen, per channel.
 *
 * One timestamp per (user, channel), stored as a JSON map on the user rather
 * than a `channel-reads` collection. That is a deliberate trade:
 *
 *   - It rides along with `/api/users/me`, so read state costs no extra request
 *     on page load.
 *   - It sits next to `dashboardPrefs`, which is the same idea (per-user,
 *     device-independent, nobody else's business) and already carries the same
 *     field gate.
 *   - A new collection would need its `<slug>_id` column on
 *     `payload_locked_documents_rels` or EVERY admin save breaks. Not a reason
 *     to choose this shape, but a cost it happens to avoid.
 *
 * ponytail: a blob cannot answer "who has read this message", and a user in
 * hundreds of channels carries a fat row. Neither is real today. When either
 * becomes real the upgrade is a `channel-reads` collection behind the same two
 * endpoints, and no caller changes.
 */

/** channel slug → ISO timestamp of the newest message that user has seen. */
export type ReadState = Record<string, string>

/**
 * Keys are cheap but not free, and nothing prunes them otherwise — a channel you
 * visited once and left keeps its row forever. Oldest marks are dropped first:
 * a channel you have not opened in a year is not one whose unread count matters.
 */
export const MAX_TRACKED_CHANNELS = 500

/** Unread counts above this are noise; the UI shows "99+". */
export const UNREAD_CAP = 99

/** Anything that is not a `{ slug: isoString }` map reads as empty. */
export function normalizeReadState(value: unknown): ReadState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: ReadState = {}
  for (const [slug, at] of Object.entries(value as Record<string, unknown>)) {
    if (typeof slug !== 'string' || !slug) continue
    if (typeof at !== 'string') continue
    const t = Date.parse(at)
    if (Number.isNaN(t)) continue
    out[slug] = new Date(t).toISOString()
  }
  return out
}

/**
 * Merge one mark into the map, monotonically.
 *
 * The `max` is what makes this safe without a lock: two tabs marking the same
 * channel cannot lose each other's progress, and a late-arriving request from a
 * stale tab cannot drag the marker backwards and resurrect messages the user has
 * already read. Read-modify-write races are harmless when the operation only
 * ever moves forward.
 *
 * Returns the SAME object when nothing changed, so callers can skip the write —
 * which is most of the time, since the client marks on a debounce.
 */
export function mergeReadState(existing: unknown, channel: string, at: string): ReadState {
  const state = normalizeReadState(existing)
  const slug = String(channel || '').trim()
  if (!slug) return state

  const incoming = Date.parse(at)
  if (Number.isNaN(incoming)) return state

  const current = state[slug] ? Date.parse(state[slug]) : -Infinity
  if (incoming <= current) return state

  const next: ReadState = { ...state, [slug]: new Date(incoming).toISOString() }
  return pruneReadState(next)
}

/** Drop the oldest marks once the map outgrows MAX_TRACKED_CHANNELS. */
export function pruneReadState(state: ReadState): ReadState {
  const keys = Object.keys(state)
  if (keys.length <= MAX_TRACKED_CHANNELS) return state
  const keep = keys
    .sort((a, b) => Date.parse(state[b]!) - Date.parse(state[a]!))
    .slice(0, MAX_TRACKED_CHANNELS)
  const out: ReadState = {}
  for (const k of keep) out[k] = state[k]!
  return out
}

/**
 * A channel with no mark has no time floor: everything in it is unread, because
 * the user has genuinely never read any of it. That does mean joining a busy
 * portal lights up every channel at once — which is what actually happened, and
 * one click each clears it. A synthetic floor ("only count since now") would be
 * tidier on day one and would silently swallow real messages on day two.
 */
export function sinceFor(state: ReadState, channel: string): string | null {
  return state[channel] ?? null
}

/** Clamp to what the badge can meaningfully say. */
export function capUnread(n: number): number {
  return n > UNREAD_CAP ? UNREAD_CAP : n
}
