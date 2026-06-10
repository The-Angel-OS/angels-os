/**
 * Cookie Clearing Endpoint — POST /api/auth/clear-cookie
 *
 * The logout counterpart to /api/auth/set-cookie. A cookie can only be cleared
 * with the SAME Domain it was set with — since set-cookie scopes the auth cookie
 * to the host's registrable apex (cross-subdomain SSO), logout must expire it at
 * that same apex, or the session would linger (a "can't fully log out" bug).
 *
 * Excluded from the middleware matcher (like set-cookie) so nothing wraps the
 * Set-Cookie header. Fetch-based delivery, same as the set path.
 */
import { cookieDomainForHost } from '@/utilities/cookieDomain'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost'
  const isProduction = process.env.NODE_ENV === 'production'

  // Mirror set-cookie's resolution: explicit env (if it matches) → host apex.
  const envCookieDomain = process.env.COOKIE_DOMAIN || ''
  let effectiveCookieDomain = ''
  if (envCookieDomain) {
    const base = envCookieDomain.startsWith('.') ? envCookieDomain.slice(1) : envCookieDomain
    const h = host.split(':')[0]
    effectiveCookieDomain = h === base || h.endsWith(`.${base}`) ? envCookieDomain : cookieDomainForHost(host) || ''
  } else {
    effectiveCookieDomain = cookieDomainForHost(host) || ''
  }

  const securePart = isProduction ? '; Secure' : ''
  const domainPart = effectiveCookieDomain ? `; Domain=${effectiveCookieDomain}` : ''
  // Max-Age=0 + an empty value expires the cookie at the same scope it was set.
  const clearCookie = `payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${securePart}${domainPart}`

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.append('Set-Cookie', clearCookie)

  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
}
