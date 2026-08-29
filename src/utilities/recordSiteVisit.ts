/**
 * recordSiteVisit — write one row to the Site Log for a public page render.
 *
 * Called from the public app layout, which is the single funnel every visitor
 * page passes through. That placement is deliberate: it sees exactly the requests
 * a *visitor log* is about (rendered pages) and none of the ones that made DNN's
 * Site Log table explode (assets, XHR, API calls).
 *
 * Three rules this must never break:
 *   1. Never throw. A missing table, a slow DB, a weird header — none of it may
 *      take a customer's home page down. Every path here is caught.
 *   2. Never block the render. The caller does not await it.
 *   3. Never store an IP. `visitorHash` is a salted digest that rotates daily, so
 *      it counts unique visitors and identifies nobody, and yesterday's hash
 *      cannot be matched to today's.
 *
 * ponytail: one INSERT per page view, no batching, no queue. At Angel OS traffic
 * that is nothing. If a portal ever gets busy enough for this to show up in the
 * DB metrics, batch in memory and flush on an interval — the call site does not
 * change.
 *
 * @see src/collections/SiteVisits/index.ts
 */
import crypto from 'crypto'
import type { Payload } from 'payload'

/** Paths that are never a "visit" — internal plumbing, not a person reading a page. */
const IGNORED_PREFIXES = ['/api', '/admin', '/dashboard', '/next', '/_next', '/favicon']

const BOT_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i

export interface VisitInput {
  tenantId?: number | string | null
  path: string
  referrer?: string | null
  userAgent?: string | null
  ip?: string | null
  /** Two-letter code from Cloudflare's CF-IPCountry header. */
  country?: string | null
  userId?: number | string | null
}

/** `Mozilla/5.0 (…) Chrome/… ` → a name a human recognises. First match wins. */
export function parseUserAgent(ua: string): {
  browser: string
  os: string
  device: 'desktop' | 'mobile' | 'tablet' | 'bot'
  isBot: boolean
} {
  const isBot = BOT_RE.test(ua)

  // Order matters — Edge and Opera both claim to be Chrome, Chrome claims Safari.
  const browser =
    /edg[ea]?\//i.test(ua) ? 'Edge'
    : /opr\/|opera/i.test(ua) ? 'Opera'
    : /samsungbrowser/i.test(ua) ? 'Samsung Internet'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /safari/i.test(ua) ? 'Safari'
    : isBot ? 'Bot'
    : 'Other'

  const os =
    /windows/i.test(ua) ? 'Windows'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /mac os x|macintosh/i.test(ua) ? 'macOS'
    : /linux/i.test(ua) ? 'Linux'
    : 'Other'

  const device: 'desktop' | 'mobile' | 'tablet' | 'bot' = isBot
    ? 'bot'
    : /ipad|tablet/i.test(ua)
      ? 'tablet'
      : /mobi|android|iphone/i.test(ua)
        ? 'mobile'
        : 'desktop'

  return { browser, os, device, isBot }
}

/** Referring DOMAIN, or undefined for a direct hit / unparseable referrer. */
export function referrerHostOf(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined
  try {
    return new URL(referrer).hostname || undefined
  } catch {
    return undefined
  }
}

/** True when this path is a page a person read, rather than internal plumbing. */
export function isVisitPath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return false // an asset, not a page
  return !IGNORED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

/**
 * Salted digest of IP + user agent, rotating daily.
 *
 * The salt is PAYLOAD_SECRET plus the calendar date, so the same visitor is one
 * person within a day (which is what "unique visitors today" means) and is a
 * different, unlinkable value tomorrow. Nothing here can be turned back into an
 * IP address.
 */
export function visitorHashOf(ip: string, userAgent: string, day = new Date()): string {
  const salt = `${process.env.PAYLOAD_SECRET || 'angel'}:${day.toISOString().slice(0, 10)}`
  return crypto.createHash('sha256').update(`${salt}:${ip}:${userAgent}`).digest('hex').slice(0, 32)
}

/**
 * Cloudflare sends CF-IPCountry on every proxied request — the country it already
 * derived from the IP at the edge. Free, no lookup, no dependency, and it is the
 * answer to "where is our traffic coming from" that does NOT require storing an
 * address. 'XX' (unknown) and 'T1' (Tor) are Cloudflare's own placeholders and
 * mean nothing to an owner, so they are dropped rather than shown as countries.
 */
export function normalizeCountry(raw: string | null | undefined): string | undefined {
  const c = (raw || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return undefined
  return c
}

export async function recordSiteVisit(payload: Payload, input: VisitInput): Promise<void> {
  try {
    if (!input.tenantId) return
    const path = (input.path || '').split('?')[0] || '/'
    if (!isVisitPath(path)) return

    const userAgent = (input.userAgent || '').slice(0, 500)
    const { browser, os, device, isBot } = parseUserAgent(userAgent)
    const referrer = (input.referrer || '').slice(0, 500) || undefined

    await payload.create({
      collection: 'site-visits',
      data: {
        tenant: Number(input.tenantId),
        path: path.slice(0, 500),
        referrer,
        referrerHost: referrerHostOf(referrer),
        userAgent: userAgent || undefined,
        browser,
        os,
        device,
        isBot,
        country: normalizeCountry(input.country),
        visitorHash: input.ip ? visitorHashOf(input.ip, userAgent) : undefined,
        ...(input.userId != null ? { user: Number(input.userId) } : {}),
      } as never,
      overrideAccess: true,
    })
  } catch {
    // Fail-soft by design — see the header. A visitor log is never worth an outage.
  }
}
