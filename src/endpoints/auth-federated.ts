/**
 * Federated identity endpoint — POST /api/auth/federated
 *
 * THE KEYSTONE for "one brain across portals."
 *
 * A native client (Nimue) or any node performs a native Google sign-in and
 * obtains a Google **id_token** (a Google-signed JWT). It POSTs that token here.
 * This endpoint:
 *   1. verifies the id_token's signature against Google's public JWKS,
 *   2. checks issuer + audience (must be one of our OAuth client IDs) + expiry,
 *   3. resolves (find-or-create) the local Users doc + mints a Payload JWT
 *      (shared with the web OAuth callback via resolveUserFromGoogleClaims).
 *
 * Returns JSON `{ token, user }`. The client stores `token` as a bearer and is
 * now authenticated to THIS node — no web-OAuth redirect, no per-node re-auth,
 * no ugly HTML sign-in page. Because every node runs the same JWKS check, the
 * same Google identity mints a local session anywhere.
 *
 * Security:
 *   - Signature verified against Google's rotating JWKS (createRemoteJWKSet).
 *   - issuer pinned to accounts.google.com.
 *   - audience pinned to our accepted client IDs (Web + Android).
 *   - expiry enforced by jwtVerify.
 */
import type { PayloadHandler } from 'payload'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { resolveUserFromGoogleClaims } from '@/endpoints/googleIdentity'
import { logError } from '@/utilities/logError'

// Google's OpenID Connect JWKS endpoint. createRemoteJWKSet caches keys and
// refreshes on rotation, so this is created once per module load.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

/** Accepted audiences: the Web client (server) + the Android client (Nimue). */
function acceptedAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((v): v is string => Boolean(v))
}

export const authFederatedHandler: PayloadHandler = async (req) => {
  try {
    let body: { id_token?: string; idToken?: string }
    try {
      // Payload parses JSON onto req.data; fall back to req.json() for safety.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body = ((req as any).data as typeof body) || (await req.json?.()) || {}
    } catch {
      body = {}
    }

    const idToken = body.id_token || body.idToken
    if (!idToken) {
      return Response.json(
        { error: 'Missing id_token in request body.' },
        { status: 400 },
      )
    }

    const audiences = acceptedAudiences()
    if (audiences.length === 0) {
      return Response.json(
        { error: 'Federated auth is not configured (no Google client IDs set).' },
        { status: 501 },
      )
    }

    // ----- Verify the Google id_token -----
    let claims: {
      email?: string
      name?: string
      sub?: string
      picture?: string
      email_verified?: boolean
    }
    try {
      const { payload: verified } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: GOOGLE_ISSUERS,
        audience: audiences,
      })
      claims = verified as typeof claims
    } catch (verifyErr) {
      const message =
        verifyErr instanceof Error ? verifyErr.message : 'verification failed'
      console.warn('[Federated Auth] id_token verification failed:', message)
      return Response.json(
        { error: 'Invalid or expired Google id_token.' },
        { status: 401 },
      )
    }

    if (!claims.email || !claims.sub) {
      return Response.json(
        { error: 'Google token missing required claims (email, sub).' },
        { status: 401 },
      )
    }

    // Require a verified email — an unverified Google email must not be able to
    // take over a local account keyed on that address.
    if (claims.email_verified === false) {
      return Response.json(
        { error: 'Google email is not verified.' },
        { status: 401 },
      )
    }

    // ----- Resolve local user + mint Payload JWT -----
    const { user, token, isNew } = await resolveUserFromGoogleClaims(req.payload, {
      email: claims.email,
      name: claims.name,
      sub: claims.sub,
      picture: claims.picture,
    })

    console.log('[Federated Auth] Minted session:', { userId: user.id, isNew })

    return Response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? '',
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
      isNew,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    void logError({
      level: 'warning',
      source: 'auth/federated',
      message: `Federated auth failed: ${message}`,
      details: err instanceof Error ? err.stack : String(err),
    })
    return Response.json({ error: message }, { status: 500 })
  }
}
