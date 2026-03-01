/**
 * Auth Completion Route — GET /api/auth/complete
 *
 * A standalone Next.js route handler (NOT a Payload custom endpoint) that
 * sets the `payload-token` cookie and redirects to the final destination.
 *
 * WHY THIS EXISTS:
 * Payload's `handleEndpoints()` reconstructs a new Response object from the
 * handler's return value. This reconstruction strips cookies — both
 * `Set-Cookie` headers and `cookies()` from `next/headers` fail to persist.
 *
 * By moving the cookie-setting step to a standalone Next.js route handler
 * (outside Payload's endpoint system), we let Next.js handle the Response
 * lifecycle natively. The OAuth callback handlers redirect here after
 * generating the JWT, and this handler sets the cookie and sends the user
 * to their final destination.
 *
 * Cookie Strategy (Attempt #8 — HTML page + meta refresh):
 *   Previous attempts proved the Set-Cookie header IS sent on 302 responses
 *   (verified via curl), but Chrome does not store the cookie during
 *   redirect chains originating from cross-site OAuth flows.
 *
 *   This approach returns a 200 HTML page instead of a 302 redirect.
 *   The browser processes the Set-Cookie header on a normal 200 response
 *   (which is always honored), then follows a meta refresh to the
 *   final destination. This separates cookie storage from navigation.
 *
 * Flow:
 *   1. OAuth callback (Payload endpoint) exchanges code, creates/finds user, signs JWT
 *   2. Redirect to: /api/auth/complete?token=<jwt>&redirect=/admin
 *   3. This handler verifies JWT, sets `payload-token` cookie via Set-Cookie header
 *   4. Returns 200 HTML page with meta refresh → /admin
 *   5. Browser stores cookie, then navigates to /admin as a fresh page load
 *
 * Security:
 *   - JWT is verified with PAYLOAD_SECRET before setting the cookie
 *   - Redirect is validated to be a relative path (prevents open redirect)
 *   - Cookie flags match Payload's own auth cookie configuration
 */
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const redirectTo = url.searchParams.get('redirect') || '/dashboard'

  // --- Collect diagnostic info ---
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost'
  const envServerUrl = process.env.NEXT_PUBLIC_SERVER_URL || '(not set)'
  const envVercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || '(not set)'
  const envCookieDomain = process.env.COOKIE_DOMAIN || ''
  const isProduction = process.env.NODE_ENV === 'production'

  console.log('[Auth Complete] Handler invoked:', {
    host,
    proto,
    hasToken: Boolean(token),
    redirectTo,
    envServerUrl,
    envVercelProdUrl,
    envCookieDomain: envCookieDomain || '(not set)',
    isProduction,
    requestUrl: request.url,
  })

  if (!token) {
    return Response.json(
      {
        error: 'Missing token parameter.',
        debug: {
          host,
          proto,
          envServerUrl,
          envVercelProdUrl,
          envCookieDomain: envCookieDomain || '(not set)',
          isProduction,
          message: 'This endpoint requires ?token=<jwt>&redirect=/path',
        },
      },
      { status: 400 },
    )
  }

  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    return Response.json(
      { error: 'Server configuration error.' },
      { status: 500 },
    )
  }

  // Verify the JWT is genuine (signed by our PAYLOAD_SECRET)
  try {
    jwt.verify(token, secret)
  } catch {
    return Response.json(
      { error: 'Invalid or expired token.' },
      { status: 401 },
    )
  }

  // Validate redirect is a relative path (prevent open redirect)
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  // --- Cookie domain validation ---
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
        '[Auth Complete] COOKIE_DOMAIN mismatch! Domain "%s" does not match host "%s". Skipping Domain attribute.',
        effectiveCookieDomain,
        hostWithoutPort,
      )
      effectiveCookieDomain = ''
    }
  }

  const maxAge = 14 * 24 * 60 * 60 // 14 days in seconds

  console.log('[Auth Complete] Setting cookie via HTML page + meta refresh:', {
    safeRedirect,
    effectiveCookieDomain: effectiveCookieDomain || '(exact host: ' + host + ')',
    isProduction,
    tokenLength: token.length,
  })

  // --- Return 200 HTML page with Set-Cookie + meta refresh ---
  // Why NOT a 302 redirect:
  //   Chrome does not reliably store cookies set on 302 responses during
  //   redirect chains originating from cross-site OAuth flows (Google).
  //   Verified via curl that Set-Cookie header IS present on 302, but
  //   Chrome ignores it. A 200 HTML page with meta refresh separates
  //   cookie storage from navigation.
  //
  // The HTML page:
  //   1. Browser receives 200 + Set-Cookie → stores cookie immediately
  //   2. <meta http-equiv="refresh"> triggers navigation to final URL
  //   3. JavaScript window.location.replace() as fallback
  //   4. The next page load includes the stored cookie

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${safeRedirect}">
  <title>Signing in...</title>
</head>
<body>
  <p>Signing in, please wait...</p>
  <script>window.location.replace(${JSON.stringify(safeRedirect)})</script>
</body>
</html>`

  // Build the response with NextResponse so cookies work with middleware
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Auth-Debug-Host': host,
      'X-Auth-Debug-Proto': proto,
      'X-Auth-Debug-Cookie-Domain': effectiveCookieDomain || '(exact host)',
      'X-Auth-Debug-Redirect': safeRedirect,
      'X-Auth-Debug-Secure': String(isProduction),
      'X-Auth-Debug-Cookie-Method': 'NextResponse-200-html-meta-refresh',
    },
  })

  // Set the payload-token cookie using NextResponse's native cookie API
  response.cookies.set('payload-token', token, {
    path: '/',
    maxAge,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    ...(effectiveCookieDomain ? { domain: effectiveCookieDomain } : {}),
  })

  return response
}
