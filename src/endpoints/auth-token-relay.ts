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
import { jwtVerify } from 'jose'
import { getServerSideURL } from '@/utilities/getURL'

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

    // MUST use jose (same library as Payload CMS 3.x) for consistent verification.
    try {
      const secretKey = new TextEncoder().encode(secret)
      await jwtVerify(token, secretKey)
    } catch {
      return Response.json(
        { error: 'Invalid or expired token.' },
        { status: 401 },
      )
    }

    // Validate redirect is relative path (prevent open redirect)
    const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

    // Redirect through /api/auth/complete — a standalone Next.js route
    // handler that sets the cookie outside of Payload's pipeline.
    // For token-relay, we use the current host (custom domain) as the base URL.
    const hostHeader = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host') || ''
    const protoHeader = req.headers?.get?.('x-forwarded-proto') || 'https'
    const baseUrl = hostHeader
      ? `${protoHeader}://${hostHeader}`
      : getServerSideURL()

    const completeUrl = new URL('/api/auth/complete', baseUrl)
    completeUrl.searchParams.set('token', token)
    completeUrl.searchParams.set('redirect', safeRedirect)

    console.log('[Token Relay] Redirecting through /api/auth/complete:', {
      safeRedirect,
      completeUrl: completeUrl.toString(),
    })

    return new Response(null, {
      status: 302,
      headers: { Location: completeUrl.toString() },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token relay failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
