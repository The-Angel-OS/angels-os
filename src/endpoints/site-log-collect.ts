/**
 * POST /api/site-log/collect — the Site Log beacon writer.
 *
 * Public, unauthenticated, fire-and-forget (the client uses navigator.sendBeacon).
 * Enriches each hit with what Cloudflare's edge already gives us — country
 * (cf-ipcountry) and the real client IP (cf-connecting-ip) — resolves the tenant
 * from the Host, derives a COOKIELESS daily-salted visitor hash, and writes one
 * page-views row. Always returns 204 fast; never throws to the caller.
 *
 * @see src/collections/Analytics/PageViews.ts
 */
import type { PayloadHandler } from 'payload'
import crypto from 'crypto'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'

function deviceClass(ua: string): { device: 'desktop' | 'mobile' | 'tablet' | 'bot'; isBot: boolean } {
  const s = ua.toLowerCase()
  if (!s || /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|curl|wget|python-|axios|node-fetch|go-http/.test(s)) {
    return { device: 'bot', isBot: true }
  }
  if (/ipad|tablet|playbook|silk/.test(s)) return { device: 'tablet', isBot: false }
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return { device: 'mobile', isBot: false }
  return { device: 'desktop', isBot: false }
}

function refHost(referrer: string, selfHost: string): string {
  if (!referrer) return 'direct'
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '')
    if (!h || h === selfHost.replace(/^www\./, '')) return 'direct' // in-site nav = direct
    return h.slice(0, 120)
  } catch {
    return 'direct'
  }
}

export const siteLogCollectHandler: PayloadHandler = async (req) => {
  // Always 204 — analytics must never surface an error to the page.
  const ok = () => new Response(null, { status: 204 })
  try {
    if ((req.method || (req as unknown as Request).method)?.toUpperCase() !== 'POST') return ok()

    let body: Record<string, unknown> = {}
    try {
      body = (req.data as Record<string, unknown>) ?? (await (req as unknown as Request).json())
    } catch {
      return ok()
    }

    let path = typeof body.path === 'string' ? body.path : ''
    if (!path) return ok()
    path = path.split('?')[0].split('#')[0].slice(0, 512) || '/'

    const h = (name: string) => req.headers?.get?.(name) || ''
    const host = (h('host') || h('x-forwarded-host')).split(':')[0].toLowerCase()
    if (!host) return ok()

    const tenant = await fetchTenantByDomain(host)
    const tenantId = tenant?.id
    if (tenantId == null) return ok() // no tenant → nothing to scope to

    const ua = h('user-agent')
    const ip = h('cf-connecting-ip') || h('x-real-ip') || (h('x-forwarded-for').split(',')[0].trim())
    const country = (h('cf-ipcountry') || '').toUpperCase().slice(0, 2) || 'XX'
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 2048) : ''

    const { device, isBot } = deviceClass(ua)

    // Cookieless daily-rotating visitor key: hash(secret : YYYYMMDD : ip : ua).
    // The daily salt means it can't be correlated across days or reversed to an IP.
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const sessionHash = crypto
      .createHash('sha256')
      .update(`${req.payload.secret}:${day}:${ip}:${ua}`)
      .digest('hex')
      .slice(0, 32)

    await req.payload.create({
      collection: 'page-views',
      data: {
        tenant: tenantId,
        path,
        referrerHost: refHost(referrer, host),
        referrerFull: referrer || undefined,
        country,
        device,
        sessionHash,
        isBot,
      } as never,
      overrideAccess: true,
    })

    return ok()
  } catch {
    return ok()
  }
}
