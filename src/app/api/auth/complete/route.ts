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
 * Flow:
 *   1. OAuth callback (Payload endpoint) exchanges code, creates/finds user, signs JWT
 *   2. Redirect to: /api/auth/complete?token=<jwt>&redirect=/admin
 *   3. This handler verifies JWT, sets `payload-token` cookie, redirects to /admin
 *
 * Security:
 *   - JWT is verified with PAYLOAD_SECRET before setting the cookie
 *   - Redirect is validated to be a relative path (prevents open redirect)
 *   - Cookie flags match Payload's own auth cookie configuration
 *
 * Cookie Strategy (Attempt #7):
 *   Uses NextResponse.redirect() + response.cookies.set() — the native Next.js
 *   cookie API. This is critical because:
 *   - Middleware (src/middleware.ts) intercepts /api routes via NextResponse.next()
 *   - When middleware is active, raw `new Response()` with Set-Cookie headers
 *     can be silently dropped during Next.js response pipeline processing
 *   - NextResponse.cookies.set() integrates properly with the middleware pipeline
 *   - This is different from cookies() (next/headers AsyncLocalStorage) which
 *     only works with NextResponse, not raw Response objects
 *
 * Diagnostic:
 *   Response includes X-Auth-Debug-* headers visible in Chrome DevTools
 *   Network tab for troubleshooting cookie issues.
 */
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const redirectTo = url.searchParams.get('redirect') || '/dashboard'

  // --- Collect diagnostic info for headers ---
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

  // Build absolute redirect URL from request context (current host)
  const baseUrl = `${proto}://${host}`
  const absoluteRedirect = new URL(safeRedirect, baseUrl).toString()

  // --- Cookie domain validation ---
  // If COOKIE_DOMAIN is set, verify it matches the current host.
  // A mismatch causes the browser to silently reject the cookie.
  // e.g., COOKIE_DOMAIN=".angelos.local" on host "spacesangels.com" → rejected
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
        '[Auth Complete] COOKIE_DOMAIN mismatch! Domain "%s" does not match host "%s". Skipping Domain attribute to avoid silent rejection.',
        effectiveCookieDomain,
        hostWithoutPort,
      )
      effectiveCookieDomain = '' // Skip Domain attribute — let browser default to exact host
    }
  }

  const maxAge = 14 * 24 * 60 * 60 // 14 days in seconds

  console.log('[Auth Complete] Setting cookie and redirecting:', {
    safeRedirect,
    absoluteRedirect,
    effectiveCookieDomain: effectiveCookieDomain || '(exact host: ' + host + ')',
    isProduction,
    tokenLength: token.length,
  })

  // --- Use NextResponse.redirect() + response.cookies.set() ---
  // This is the ONLY reliable way to set cookies in a Next.js route handler
  // when middleware (src/middleware.ts) is in the pipeline.
  //
  // Why other approaches failed:
  // 1. Raw Set-Cookie header on Payload endpoint → Payload handleEndpoints() strips it
  // 2. cookies() (next/headers) on Payload endpoint → same strip
  // 3. cookies() (next/headers) + new Response(302) → AsyncLocalStorage doesn't merge
  // 4. Raw Set-Cookie on new Response(302) in standalone handler → middleware pipeline
  //    processes the response and can silently drop Set-Cookie from raw Response objects
  //
  // NextResponse.redirect() + .cookies.set() works because:
  // - NextResponse is the native response type that Next.js middleware pipeline expects
  // - .cookies.set() attaches cookies directly to the NextResponse instance
  // - The middleware pipeline preserves NextResponse cookie state through processing
  const response = NextResponse.redirect(absoluteRedirect, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Auth-Debug-Host': host,
      'X-Auth-Debug-Proto': proto,
      'X-Auth-Debug-Cookie-Domain': effectiveCookieDomain || '(exact host)',
      'X-Auth-Debug-Redirect': absoluteRedirect,
      'X-Auth-Debug-Secure': String(isProduction),
      'X-Auth-Debug-Env-Server-URL': envServerUrl,
      'X-Auth-Debug-Env-Vercel-Prod-URL': envVercelProdUrl,
      'X-Auth-Debug-Cookie-Method': 'NextResponse.cookies.set',
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
