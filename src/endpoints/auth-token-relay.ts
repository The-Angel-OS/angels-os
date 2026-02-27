/**
 * Token Relay Endpoint — GET /api/auth/token-relay
 *
 * Handles cross-domain authentication for custom domain tenants.
 *
 * When a user on `kendev.co` authenticates via Google OAuth, the callback
 * lands on the canonical domain (`spacesangels.com`). The cookie set there
 * won't be readable from `kendev.co`. So the callback redirects to:
 *
 *   https://kendev.co/api/auth/token-relay?t=<jwt>&r=/dashboard
 *
 * This endpoint validates the JWT and sets the `payload-token` cookie
 * on the current domain, then redirects to the final destination.
 *
 * Security: The JWT is already signed with PAYLOAD_SECRET (shared across
 * all tenant domains on the same deployment). We verify the signature
 * before setting the cookie.
 */
import type { PayloadHandler } from 'payload'
import jwt from 'jsonwebtoken'

export const authTokenRelayHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('t')
    const redirectTo = url.searchParams.get('r') || '/dashboard'

    if (!token) {
      return Response.json(
        { error: 'Missing token parameter.' },
        { status: 400 },
      )
    }

    // Verify the JWT is genuine (signed by our PAYLOAD_SECRET)
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) {
      return Response.json(
        { error: 'Server configuration error.' },
        { status: 500 },
      )
    }

    try {
      jwt.verify(token, secret)
    } catch {
      return Response.json(
        { error: 'Invalid or expired token.' },
        { status: 401 },
      )
    }

    // Validate redirect is relative path (prevent open redirect)
    const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

    // Set the cookie on this domain (no Domain attribute = current host only)
    const isProduction = process.env.NODE_ENV === 'production'
    const cookieStr = [
      `payload-token=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      isProduction ? 'Secure' : '',
      'Max-Age=1209600',
    ]
      .filter(Boolean)
      .join('; ')

    return new Response(null, {
      status: 302,
      headers: {
        Location: safeRedirect,
        'Set-Cookie': cookieStr,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token relay failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
