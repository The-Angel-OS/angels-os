/**
 * Cookie Setting Endpoint — POST /api/auth/set-cookie
 *
 * Attempt #10: Fetch-based cookie delivery.
 *
 * WHY THIS EXISTS:
 * Attempts #3-#9b all set the `payload-token` cookie via Set-Cookie headers
 * on the page response from /api/auth/complete. Curl proved the headers were
 * correct every time, but Chrome never stored the cookie. After exhausting
 * every server-side approach (raw Response, NextResponse, middleware bypass,
 * cookie clearing, domain validation, verification delays), the conclusion
 * is that something in the Vercel edge / Next.js response pipeline strips
 * or interferes with Set-Cookie headers on page-load HTML responses.
 *
 * This endpoint takes a fundamentally different approach:
 *   - The auth/complete page loads as plain HTML with NO Set-Cookie headers
 *   - Client-side JavaScript calls this endpoint via fetch() with the token
 *   - This endpoint validates the JWT and returns Set-Cookie on a JSON response
 *   - fetch() responses follow a different browser cookie processing path
 *     than page-load responses, bypassing whatever pipeline is interfering
 *
 * This endpoint is EXCLUDED from the middleware matcher entirely, so Next.js
 * middleware never runs for this path — the Response goes straight to the client.
 *
 * Security:
 *   - JWT is verified with PAYLOAD_SECRET before setting the cookie
 *   - Only accepts POST requests (not linkable/CSRF via GET)
 *   - Cookie flags match Payload's own auth cookie configuration
 */
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    return Response.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return Response.json({ error: 'Missing token in request body.' }, { status: 400 })
  }

  // Verify the JWT is genuine
  try {
    jwt.verify(token, secret)
  } catch {
    return Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
  }

  // --- Cookie domain validation ---
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost'
  const envCookieDomain = process.env.COOKIE_DOMAIN || ''
  const isProduction = process.env.NODE_ENV === 'production'

  let effectiveCookieDomain = envCookieDomain
  if (effectiveCookieDomain) {
    const domainBase = effectiveCookieDomain.startsWith('.')
      ? effectiveCookieDomain.slice(1)
      : effectiveCookieDomain
    const hostWithoutPort = host.split(':')[0]
    const domainMatches =
      hostWithoutPort === domainBase ||
      hostWithoutPort.endsWith(`.${domainBase}`)

    if (!domainMatches) {
      console.warn(
        '[Auth Set-Cookie] COOKIE_DOMAIN mismatch! Domain "%s" does not match host "%s". Dropping Domain attribute.',
        effectiveCookieDomain,
        hostWithoutPort,
      )
      effectiveCookieDomain = ''
    }
  }

  const maxAge = 14 * 24 * 60 * 60 // 14 days
  const securePart = isProduction ? '; Secure' : ''
  const domainPart = effectiveCookieDomain ? `; Domain=${effectiveCookieDomain}` : ''

  const setCookie = `payload-token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${securePart}${domainPart}`

  console.log('[Auth Set-Cookie] Setting cookie via fetch-based endpoint (attempt #10):', {
    host,
    effectiveCookieDomain: effectiveCookieDomain || '(host-only)',
    secure: isProduction,
    tokenLength: token.length,
  })

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  headers.append('Set-Cookie', setCookie)

  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
}
