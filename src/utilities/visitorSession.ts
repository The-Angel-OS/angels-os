/**
 * Anonymous visitor sessions — the brochure-site chat.
 *
 * Before this, `GuestChatBubble` held the conversation in React state and
 * nothing else. Three consequences, and the third is the one that mattered:
 *
 *   1. Refresh killed it.
 *   2. Nobody at the portal ever saw it — your most engaged visitors were
 *      invisible, and you could not know what people asked your own site.
 *   3. **LEO could not remember the previous sentence.** Its context comes from
 *      reading the Messages table, and guest turns were never persisted, so
 *      every message was message one. "Do you rent the hall on weekends?" got a
 *      good answer; "how much?" got a non-sequitur.
 *
 * Persistence and memory are therefore the same fix — which is why this is
 * worth doing properly rather than patching context on the client.
 *
 * Policy, Ken's calls of 260824:
 *   - identity: a server-set httpOnly cookie (not localStorage — a page script
 *     can't read it, and it's first-party on the portal's own domain)
 *   - the channel is NOT created until the second message; most first messages
 *     are a bounce or a test, and this filters them almost perfectly
 *   - unclaimed visitor channels expire after 30 days
 *   - the widget says so: "LEO may share this conversation with the site owner."
 */
import { VISITOR_DISCLOSURE } from '@/constants/visitorDisclosure'

export { VISITOR_DISCLOSURE }

/** First-party, httpOnly. The visitor can clear it; nothing else can read it. */
export const VISITOR_COOKIE = 'angel_visitor'

/** Matches the unclaimed-channel TTL, so the cookie and the data die together. */
export const VISITOR_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

/** Bound what a client may replay when a channel is first created. */
export const MAX_BACKFILL_TURNS = 20
export const MAX_BACKFILL_CHARS = 4000

/**
 * `visitor-<uuid>`. Deliberately NOT the `dm-` shape: a DM's access check is
 * `{ type: 'dm', members: { in: [user.id] } }`, and a visitor has no user row —
 * so a DM-shaped channel would be visible to literally nobody, which is the
 * opposite of the point. This is an ordinary channel in the tenant's AI Bus
 * space, so the portal's own people can read it.
 */
export function visitorChannelSlug(visitorId: string): string {
  return `visitor-${visitorId}`
}

export function isVisitorChannelSlug(slug: string): boolean {
  return /^visitor-[0-9a-f-]{16,}$/i.test(slug)
}

/** A short, human-legible handle for the channel name. Not an identifier. */
export function visitorLabel(visitorId: string): string {
  return `Visitor ${visitorId.slice(0, 6)}`
}

/** Read the visitor id off a request's Cookie header. */
export function readVisitorId(headers: Headers): string | null {
  const raw = headers.get('cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === VISITOR_COOKIE) {
      const v = decodeURIComponent(rest.join('='))
      return /^[0-9a-f-]{16,}$/i.test(v) ? v : null
    }
  }
  return null
}

export function newVisitorId(): string {
  return globalThis.crypto.randomUUID()
}

/**
 * The Set-Cookie value. `SameSite=Lax` because the widget is same-origin with
 * the portal it sits on; `Secure` everywhere but local dev.
 */
export function visitorCookieHeader(visitorId: string, secure = process.env.NODE_ENV === 'production'): string {
  return [
    `${VISITOR_COOKIE}=${encodeURIComponent(visitorId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export interface BackfillTurn {
  role: 'user' | 'assistant'
  text: string
}

/**
 * Sanitise the transcript a client replays when its channel is first created.
 *
 * The channel does not exist until message two, so turn one would otherwise be
 * lost — and turn one is exactly the context turn two needs ("how much?").
 * The client holds it, so the client sends it back.
 *
 * This is visitor-supplied text landing in the visitor's own channel and their
 * own LEO context — the same place their next message lands anyway, so it
 * grants them nothing they did not already have. It is bounded all the same:
 * a replay is not an invitation to write unlimited rows.
 */
export function sanitizeBackfill(raw: unknown): BackfillTurn[] {
  if (!Array.isArray(raw)) return []
  const out: BackfillTurn[] = []
  for (const item of raw.slice(-MAX_BACKFILL_TURNS)) {
    if (!item || typeof item !== 'object') continue
    const { role, text } = item as { role?: unknown; text?: unknown }
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof text !== 'string') continue
    const trimmed = text.trim().slice(0, MAX_BACKFILL_CHARS)
    if (!trimmed) continue
    out.push({ role, text: trimmed })
  }
  return out
}
