/**
 * Auth Completion Route — GET /api/auth/complete
 *
 * A standalone Next.js route handler (NOT a Payload custom endpoint) that
 * sets the `payload-token` cookie and redirects to the final destination.
 *
 * WHY THIS EXISTS:
 * Payload's `handleEndpoints()` reconstructs a new Response object from the
 * handler's return value. This reconstruction can interfere with cookie
 * setting — both `Set-Cookie` headers and `cookies()` from `next/headers`
 * fail to persist through the pipeline reliably.
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
 */
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const redirectTo = url.searchParams.get('redirect') || '/dashboard'

  if (!token) {
    return Response.json(
      { error: 'Missing token parameter.' },
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

  // Build absolute redirect URL from request context
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost'
  const baseUrl = `${protocol}://${host}`
  const absoluteRedirect = new URL(safeRedirect, baseUrl).toString()

  // Set the payload-token cookie via Next.js cookies() API
  // This is a native Next.js route handler — no Payload handleEndpoints()
  // interference. cookies() uses AsyncLocalStorage and Next.js merges
  // the mutations into the outgoing response natively.
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined
  const isProduction = process.env.NODE_ENV === 'production'

  console.log('[Auth Complete] Setting payload-token cookie and redirecting:', {
    safeRedirect,
    absoluteRedirect,
    cookieDomain: cookieDomain || '(current host)',
    isProduction,
  })

  const cookieStore = await cookies()
  cookieStore.set('payload-token', token, {
    domain: cookieDomain,
    expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  })

  return new Response(null, {
    status: 302,
    headers: { Location: absoluteRedirect },
  })
}
